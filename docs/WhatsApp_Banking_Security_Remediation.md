# WhatsApp Banking — Security Remediation Guide

**Document version:** 1.0  
**Date:** June 2025  
**Application:** WhatsApp Banking React (SPA)  
**Audience:** Development team, backend team, DevOps / IT, security review  

This document describes the security issues identified in the WhatsApp Banking flow and the recommended fixes. It covers both the **Interakt webhook backend** and the **React frontend**.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current architecture and trust boundaries](#2-current-architecture-and-trust-boundaries)
3. [Issue 1 — Interakt webhook not verified](#3-issue-1--interakt-webhook-not-verified)
4. [Issue 2 — Sensitive banking data logged in browser](#4-issue-2--sensitive-banking-data-logged-in-browser)
5. [Issue 3 — URL parameters used as customer identity (IDOR risk)](#5-issue-3--url-parameters-used-as-customer-identity-idor-risk)
6. [Issue 4 — Channel Manager credentials exposed in browser](#6-issue-4--channel-manager-credentials-exposed-in-browser)
7. [Recommended target architecture](#7-recommended-target-architecture)
8. [Implementation plan (phased rollout)](#8-implementation-plan-phased-rollout)
9. [React app changes](#9-react-app-changes)
10. [Backend / BFF changes](#10-backend--bff-changes)
11. [Configuration and secrets](#11-configuration-and-secrets)
12. [Testing and verification](#12-testing-and-verification)
13. [Security checklist before production](#13-security-checklist-before-production)

---

## 1. Executive summary

Four security concerns were identified:

| # | Issue | Severity | Where to fix |
|---|-------|----------|--------------|
| 1 | Interakt webhook accepts forged POST requests | **Critical** | Backend (`/whatsapp/api/`) |
| 2 | Full API responses logged in browser console | **High** | React app |
| 3 | `customerId` and `mobile` trusted from URL query string | **High** | Backend + React |
| 4 | Channel Manager password, secret key, and checksum logic in frontend bundle | **Critical** | Backend (BFF) |

**Important:** The Interakt webhook signature check **cannot** be implemented in the React app. React runs in the customer's browser. Webhook verification must happen on the server that receives Interakt callbacks.

The long-term fix is to introduce a **Backend-for-Frontend (BFF)** that:

- Verifies Interakt webhooks
- Issues short-lived signed session tokens
- Holds Channel Manager credentials and checksum logic
- Proxies all banking API calls on behalf of the React app

---

## 2. Current architecture and trust boundaries

### 2.1 Current flow (simplified)

```
Customer (WhatsApp)
        │
        ▼
Interakt webhook ──POST──▶ /whatsapp/api/          ← No signature check today
        │
        ▼
WhatsApp link with customerId + mobile in URL
        │
        ▼
React SPA (browser)
        │
        ├── Reads customerId/mobile from URL
        ├── Builds Channel Manager checksum in JS
        └── Calls /dmCmsService/rest/endpoints/* directly
```

### 2.2 Files involved (React app)

| File | Current behaviour |
|------|-------------------|
| `src/config/apiConfig.ts` | Exposes `VITE_API_SECRET_KEY`, `VITE_API_PASSWORD`, `VITE_API_USERNAME` to the browser |
| `src/services/bankingApi.ts` | Generates checksums and calls Channel Manager directly; logs full API responses |
| `src/services/requestCache.ts` | Logs cached API data to console |
| `src/utils/linkParams.ts` | Reads `customerId` and `mobile` from URL query string |
| `src/hooks/useServiceFlow.ts` | Trusts URL identity; optional `token` path exists but raw URL params still work |

### 2.3 Trust boundary rule

Anything shipped in the React production bundle (`dist/assets/*.js`) is **public**. Attackers can:

- View source and bundled strings
- Replay API calls with extracted credentials
- Forge URLs with arbitrary `customerId` and `mobile`

---

## 3. Issue 1 — Interakt webhook not verified

### 3.1 Problem

The endpoint `/whatsapp/api/` currently accepts any POST request that matches the expected Interakt JSON structure. It does not verify whether the request actually came from Interakt.

**Impact:** Anyone who knows the public webhook URL can forge a payload with any mobile number and trigger banking flows.

### 3.2 Fix required

Use **Interakt webhook signature verification**.

Interakt sends a header:

```http
Interakt-Signature: sha256=<hmac>
```

The backend must:

1. Add config: `INTERAKT_WEBHOOK_SECRET` (server-side only).
2. Read the **raw request body** before JSON parsing.
3. Compute `HmacSHA256(rawBody, INTERAKT_WEBHOOK_SECRET)`.
4. Compare the result with the `Interakt-Signature` header using **constant-time comparison**.
5. Reject missing or invalid signatures with **401** or **403**.
6. Keep a clearly controlled **dev-only bypass** for local replay/testing, if needed.

### 3.3 Reference implementation (Node.js / Express)

**Middleware — capture raw body before JSON parser:**

```javascript
app.use('/whatsapp/api', express.raw({ type: 'application/json' }));
```

**Verification function:**

```javascript
const crypto = require('crypto');

function verifyInteraktSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const received = signatureHeader.slice('sha256='.length);
  const expected = crypto
    .createHmac('sha256', process.env.INTERAKT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison (both buffers must be same length)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(received, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}
```

**Webhook handler:**

```javascript
app.post('/whatsapp/api/', (req, res) => {
  const signature = req.headers['interakt-signature'];
  const rawBody = req.body; // Buffer from express.raw()

  const allowUnsigned =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_UNSIGNED_INTERAKT_WEBHOOKS === 'true';

  if (!allowUnsigned && !verifyInteraktSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  // ... process verified webhook ...
});
```

### 3.4 Dev-only bypass (controlled)

| Environment variable | When set | Effect |
|---------------------|----------|--------|
| `ALLOW_UNSIGNED_INTERAKT_WEBHOOKS=true` | Non-production only | Skip signature check for local Postman/curl replay |
| `INTERAKT_WEBHOOK_SECRET` | Always in prod | Required; webhook rejected if missing |

**Never** enable `ALLOW_UNSIGNED_INTERAKT_WEBHOOKS` in production.

### 3.5 After verification — issue a session token

Once the webhook is verified, the backend should:

1. Extract customer mobile and intended service from the Interakt payload.
2. Resolve `customerId` via Channel Manager (server-side).
3. Create a **short-lived signed token** (see [Section 5](#5-issue-3--url-parameters-used-as-customer-identity-idor-risk)).
4. Send the WhatsApp reply / link containing only `?token=<opaque-token>` — not raw `customerId` and `mobile`.

---

## 4. Issue 2 — Sensitive banking data logged in browser

### 4.1 Problem

The React app logs full banking API responses and cache contents to the browser console. Examples in the current codebase:

| Location | Log statement | Risk |
|----------|---------------|------|
| `src/services/bankingApi.ts` | `console.log('API DATA:', data)` | Full account balances, nominee details, OTP-related responses |
| `src/services/requestCache.ts` | `console.log('Fetcher Success:', data)` | Cached sensitive API data |
| `src/services/bankingApi.ts` | `console.log('Creating PPS Cheque Entry with:', ...)` | Transaction details |
| `src/pages/OpenFD/index.tsx` | `console.log('Deposite Type===', ...)` | Form / account context |

Anyone with browser DevTools (or a compromised device) can read this data.

### 4.2 Fix required

| Action | Detail |
|--------|--------|
| Remove production logs | Delete all `console.log` / `console.debug` that print API payloads, account numbers, or customer data |
| Dev-only logging | Wrap any remaining debug logs in `if (import.meta.env.DEV) { ... }` |
| Mask if needed | If logging is unavoidable in dev, log only endpoint name and masked identifiers |
| Build-time strip | Add Vite `esbuild.drop: ['console', 'debugger']` for production builds as a safety net |

**Vite config (production safety net):**

```typescript
// vite.config.ts
export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
```

> **Note:** Build-time stripping is a backup. Sensitive logs must be removed from source — stripping does not prevent memory inspection or network tab exposure.

### 4.3 Files to update

- [ ] `src/services/bankingApi.ts` — remove `console.log('API DATA:', data)` and similar
- [ ] `src/services/requestCache.ts` — remove or gate all cache debug logs
- [ ] `src/pages/OpenFD/index.tsx` — remove form debug logs
- [ ] `src/pages/Nominee/index.tsx` — review `console.error` messages for sensitive detail
- [ ] `src/utils/pmPremium.ts` — review error logging

---

## 5. Issue 3 — URL parameters used as customer identity (IDOR risk)

### 5.1 Problem

Current WhatsApp links use query parameters as customer identity:

```
https://<host>:6443/?service=openfd&customerId=R00047&mobile=9908360790
```

The React app reads `customerId` and `mobile` directly from the URL (`src/utils/linkParams.ts`, `src/hooks/useServiceFlow.ts`) and uses them to load accounts and start banking flows.

**Impact:** If Channel Manager does not independently verify that the session is authorized for that customer, an attacker can change URL parameters and access another customer's data or initiate transactions (**IDOR — Insecure Direct Object Reference**).

### 5.2 Fix required

Replace URL identity parameters with a **server-issued, short-lived token**.

**Unsafe (current):**

```
/?service=openfd&customerId=R00047&mobile=9908360790
```

**Safe (target):**

```
/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5.3 Token design

The backend creates the token after a verified Interakt webhook (or other trusted channel). Token payload should include:

| Claim | Example | Purpose |
|-------|---------|---------|
| `customerId` | `R00047` | Resolved server-side from mobile |
| `mobile` | `9908360790` | From verified webhook |
| `service` | `openfd` | Allowed service for this link |
| `subservice` | `PMJJBY` | For PM Social only |
| `exp` | Unix timestamp | Short TTL (e.g. 15–30 minutes) |
| `jti` | UUID | One-time use / replay prevention |
| `iat` | Unix timestamp | Issued at |

**Signing:** Use HMAC-SHA256 or RS256. Secret/key must live **only on the server**.

**Storage (optional):** Store `jti` in Redis with TTL; reject reuse.

### 5.4 React app behaviour (target)

1. Read `token` from URL (not `customerId` / `mobile`).
2. Call backend `GET /api/session/validate?token=...` or `POST /api/session/validate`.
3. Backend returns: `{ customerId, mobileNo, customerName, service, subservice, expiresAt }`.
4. If token is missing, expired, or invalid → show: *"Invalid or expired link. Please request a new link from your bank."*
5. **Remove** production support for `customerId` + `mobile` URL params (keep dev-only fallback via `VITE_DEV_CUSTOMER_ID` / `VITE_DEV_MOBILE_NO` for local testing).

### 5.5 Backend validation on every API call

Even after token validation at page load, every BFF endpoint must:

- Accept session token (cookie or `Authorization` header)
- Re-validate expiry and signature
- Ensure requested `customerId` / account belongs to the session
- Reject mismatched account numbers (e.g. user tries to debit another customer's account)

---

## 6. Issue 4 — Channel Manager credentials exposed in browser

### 6.1 Problem

`src/config/apiConfig.ts` bundles Channel Manager credentials into the frontend via Vite environment variables:

```typescript
secretKey: envOrDefault('VITE_API_SECRET_KEY', '...'),
username:  envOrDefault('VITE_API_USERNAME', 'MOBILE'),
password:  envOrDefault('VITE_API_PASSWORD', '...'),
```

`src/services/bankingApi.ts` uses these values to:

- Build `checkSum` via `generateChecksum(...)`
- Send `passwd`, `uname`, `vendor` in every API payload

**Impact:** An attacker can extract credentials from the production JS bundle and call Channel Manager endpoints directly, bypassing the React UI and any client-side controls.

### 6.2 Fix required

Move **all** Channel Manager integration to the backend (BFF).

| Today (browser) | Target (server) |
|-----------------|-----------------|
| React → `/dmCmsService/rest/endpoints/getAcctsbalanceModuleWise` | React → `/api/accounts` → BFF → Channel Manager |
| React builds checksum | BFF builds checksum |
| `VITE_API_SECRET_KEY` in bundle | `CHANNEL_MANAGER_SECRET_KEY` in server env only |
| `VITE_API_PASSWORD` in bundle | `CHANNEL_MANAGER_PASSWORD` in server env only |

### 6.3 BFF API surface (example)

| React calls | BFF responsibility |
|-------------|-------------------|
| `POST /api/session/validate` | Validate link token; return session |
| `GET /api/accounts` | `getAcctsbalanceModuleWise` + session check |
| `POST /api/otp/send` | `sendotp` + rate limit |
| `POST /api/otp/validate` | `validateotp` |
| `POST /api/pps/create` | `createPPSChequeEntry` |
| `POST /api/nominee/register` | `nomineeRegistration` |
| `POST /api/fd/open` | `openFDAccount` |
| `POST /api/pm/enroll` | `doProcessPMJJBYSBY` / `doProcessAPYPolicy` |

React `bankingApi.ts` becomes a thin client that calls `/api/*` with the session token — no checksum, no passwords.

### 6.4 Nginx routing (example)

```nginx
# React static files
location / {
    root /usr/local/WhatsApp_Banking_React/dist;
    try_files $uri $uri/ /index.html;
}

# BFF — new backend service
location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Channel Manager — remove direct browser access in production
# location /dmCmsService/ { ... }  ← restrict to BFF server IP only
```

---

## 7. Recommended target architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Interakt (WhatsApp Business)                                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ POST /whatsapp/api/
                                │ Header: Interakt-Signature: sha256=...
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Webhook + BFF Server (new or existing backend)                          │
│  • Verify Interakt HMAC signature                                        │
│  • Resolve customer from mobile (Channel Manager)                        │
│  • Issue short-lived signed token                                        │
│  • Proxy all banking APIs with server-held credentials                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
          WhatsApp link         │  /api/* (session token)
          ?token=...            │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Customer browser — React SPA (dist/)                                    │
│  • No Channel Manager secrets                                            │
│  • No customerId/mobile in URL (production)                              │
│  • No sensitive console logging                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Channel Manager — 10.2.0.121:8182 / dmCmsService                        │
│  (accessible only from BFF server, not public internet)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation plan (phased rollout)

### Phase 1 — Quick wins (React only, 1–2 days)

| Task | Owner | Priority |
|------|-------|----------|
| Remove all sensitive `console.log` from `bankingApi.ts`, `requestCache.ts`, pages | Frontend | P0 |
| Add Vite production `drop: ['console']` | Frontend | P1 |
| Document that default credentials in `apiConfig.ts` must not be used in production | Frontend / Security | P1 |

**Risk reduction:** Stops casual data leakage via DevTools. Does **not** fix credential exposure or IDOR.

### Phase 2 — Interakt webhook hardening (backend, 2–3 days)

| Task | Owner | Priority |
|------|-------|----------|
| Add `INTERAKT_WEBHOOK_SECRET` to server config | Backend / DevOps | P0 |
| Implement raw-body HMAC verification | Backend | P0 |
| Return 401/403 on invalid signature | Backend | P0 |
| Add controlled dev bypass flag | Backend | P2 |
| Issue signed link token after verified webhook | Backend | P0 |

### Phase 3 — Token-based links (backend + React, 3–5 days)

| Task | Owner | Priority |
|------|-------|----------|
| Implement `POST /api/session/validate` | Backend | P0 |
| Update React `useServiceFlow` to require `token` in production | Frontend | P0 |
| Deprecate `customerId` + `mobile` URL params in production | Frontend | P0 |
| Update WhatsApp link templates in `deploy/WHATSAPP-URLS.md` | DevOps | P1 |

### Phase 4 — BFF for Channel Manager (backend + React, 1–2 weeks)

| Task | Owner | Priority |
|------|-------|----------|
| Create BFF service with all banking endpoints | Backend | P0 |
| Move checksum + credentials to BFF | Backend | P0 |
| Refactor React `bankingApi.ts` to call `/api/*` | Frontend | P0 |
| Remove `VITE_API_SECRET_KEY`, `VITE_API_PASSWORD` from build | Frontend / DevOps | P0 |
| Restrict `/dmCmsService/` proxy to BFF IP only | DevOps | P0 |
| Rotate exposed Channel Manager credentials | Security / CBS | P0 |

---

## 9. React app changes

### 9.1 Remove sensitive logging

**Before (`bankingApi.ts`):**

```typescript
const data = await parseApiResponse<T>(response, endpoint);
console.log('API DATA:', data);  // REMOVE
```

**After:**

```typescript
const data = await parseApiResponse<T>(response, endpoint);
if (import.meta.env.DEV) {
  console.debug('[API]', endpoint, response.status);
}
```

### 9.2 Token-only identity in production

**Before (`useServiceFlow.ts`):** accepts `customerId` + `mobile` from URL.

**After (pseudocode):**

```typescript
const token = searchParams.get('token');

if (import.meta.env.PROD) {
  if (!token) {
    setError('Invalid or expired link.');
    setStatus('error');
    return;
  }
  const session = await validateSessionToken(token);
  // use session.customerId, session.mobileNo, session.service
} else {
  // dev: allow URL params or VITE_DEV_* fallback
}
```

### 9.3 Thin API client (after BFF exists)

**Before:** React calls Channel Manager directly with checksum.

**After:**

```typescript
export async function fetchAccounts(sessionToken: string) {
  const res = await fetch('/api/accounts', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error('Failed to load accounts');
  return res.json();
}
```

---

## 10. Backend / BFF changes

### 10.1 New services / endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/whatsapp/api/` | POST | Interakt webhook (signature verified) |
| `/api/session/validate` | POST | Validate link token; return session |
| `/api/accounts` | GET | List accounts for session customer |
| `/api/otp/send` | POST | Send OTP |
| `/api/otp/validate` | POST | Validate OTP |
| `/api/pps/create` | POST | Create PPS entry |
| `/api/nominee/register` | POST | Nominee registration |
| `/api/fd/open` | POST | Open FD |
| `/api/pm/enroll` | POST | PM scheme enrollment |

### 10.2 BFF responsibilities

- Hold `CHANNEL_MANAGER_SECRET_KEY`, `CHANNEL_MANAGER_PASSWORD`, `CHANNEL_MANAGER_USERNAME`
- Generate checksum server-side (same algorithm as current `generateChecksum`)
- Validate session token on every request
- Enforce account ownership (session `customerId` must match requested operations)
- Rate-limit OTP and sensitive endpoints
- Log server-side audit trail (masked) — never log full PAN, OTP, or passwords

---

## 11. Configuration and secrets

### 11.1 Server-only secrets (never in React / Vite)

| Variable | Used by | Notes |
|----------|---------|-------|
| `INTERAKT_WEBHOOK_SECRET` | Webhook handler | From Interakt dashboard |
| `SESSION_TOKEN_SECRET` | BFF | Signs link/session JWTs |
| `CHANNEL_MANAGER_SECRET_KEY` | BFF | Replaces `VITE_API_SECRET_KEY` |
| `CHANNEL_MANAGER_PASSWORD` | BFF | Replaces `VITE_API_PASSWORD` |
| `CHANNEL_MANAGER_USERNAME` | BFF | Replaces `VITE_API_USERNAME` |

### 11.2 React build env (safe to expose)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | Should be `/api` or empty (same-origin BFF) — **not** direct Channel Manager URL |
| `VITE_BANK_CODE` | Non-secret bank code (if needed for display only) |

### 11.3 Dev-only (never in production build)

| Variable | Purpose |
|----------|---------|
| `VITE_DEV_CUSTOMER_ID` | Local testing without token |
| `VITE_DEV_MOBILE_NO` | Local testing without token |
| `ALLOW_UNSIGNED_INTERAKT_WEBHOOKS` | Local webhook replay |

### 11.4 Credential rotation

Because `VITE_API_SECRET_KEY` and `VITE_API_PASSWORD` have been present in frontend builds, **rotate Channel Manager credentials** after the BFF is deployed and direct browser access to `/dmCmsService/` is blocked.

---

## 12. Testing and verification

### 12.1 Interakt webhook

| Test | Expected result |
|------|-----------------|
| POST without `Interakt-Signature` | 401 or 403 |
| POST with wrong signature | 401 or 403 |
| POST with valid signature | 200; token/link generated |
| Replay same webhook twice | Second call handled per business rules (idempotent or rejected) |
| Dev bypass with flag in non-prod | Works only when explicitly enabled |

### 12.2 React / session

| Test | Expected result |
|------|-----------------|
| Open `/?customerId=X&mobile=Y` in production | Error — link invalid |
| Open `/?token=<valid>` | Service loads for correct customer |
| Open `/?token=<expired>` | Error — link expired |
| Tamper token payload | Error — invalid token |
| Change account in API request to another customer | BFF returns 403 |

### 12.3 Credential exposure

| Test | Expected result |
|------|-----------------|
| Search production JS bundle for `SECRET_KEY`, `passwd`, checksum salt | Not found |
| Call `/dmCmsService/` directly from browser in production | Blocked or 403 (BFF only) |
| Browser console during banking flow | No account balances or full API JSON |

### 12.4 Tools

- `curl` / Postman for webhook signature tests
- Browser DevTools → Network + Console
- `grep` / strings on `dist/assets/*.js` for secret patterns

---

## 13. Security checklist before production

### Webhook

- [ ] `INTERAKT_WEBHOOK_SECRET` configured on server
- [ ] Raw body used for HMAC verification
- [ ] Constant-time signature comparison
- [ ] 401/403 on invalid/missing signature
- [ ] Dev bypass disabled in production

### React app

- [ ] No `console.log` of API responses or PII
- [ ] Production links use `token` only (no `customerId`/`mobile` in URL)
- [ ] No `VITE_API_SECRET_KEY` or `VITE_API_PASSWORD` in production build
- [ ] `useDisableInspect` or equivalent considered (defence in depth, not a security boundary)

### BFF / backend

- [ ] All Channel Manager calls go through BFF
- [ ] Session validated on every API request
- [ ] Account ownership enforced
- [ ] OTP endpoints rate-limited
- [ ] Audit logging enabled (server-side)

### Infrastructure

- [ ] `/dmCmsService/` not directly reachable from public internet
- [ ] Channel Manager credentials rotated after migration
- [ ] TLS enforced on port 6443
- [ ] Secrets stored in secure config (not in Git)

---

## Related documents

- [WhatsApp_Banking_Deployment_Specification.md](./WhatsApp_Banking_Deployment_Specification.md) — architecture and deployment
- [deploy/WHATSAPP-URLS.md](../deploy/WHATSAPP-URLS.md) — link templates (update after token migration)
- [deploy/DEPLOY-UAT.md](../deploy/DEPLOY-UAT.md) — UAT deployment steps

---

*End of document*
