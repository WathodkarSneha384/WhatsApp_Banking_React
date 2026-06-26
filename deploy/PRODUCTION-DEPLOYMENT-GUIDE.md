# WhatsApp Banking React — Production Deployment Guide

**Document version:** 1.0  
**Application:** WhatsApp Banking React (SPA)  
**Audience:** Development team, DevOps / IT, server administrators  

This is the **single reference document** for deploying the frontend to production.  
You deploy only the **built `dist/` folder** — not the source code (`src/`).

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Roles and responsibilities](#2-roles-and-responsibilities)
3. [Prerequisites](#3-prerequisites)
4. [Server and network requirements](#4-server-and-network-requirements)
5. [Step 1 — Build on developer machine](#5-step-1--build-on-developer-machine)
6. [Step 2 — Upload files to server](#6-step-2--upload-files-to-server)
7. [Step 3 — Configure Nginx](#7-step-3--configure-nginx)
8. [Step 4 — SSL certificate](#8-step-4--ssl-certificate)
9. [Step 5 — Start / restart services](#9-step-5--start--restart-services)
10. [Step 6 — Verify deployment](#10-step-6--verify-deployment)
11. [WhatsApp public URLs](#11-whatsapp-public-urls)
12. [Updating a release (re-deploy)](#12-updating-a-release-re-deploy)
13. [Rollback](#13-rollback)
14. [Troubleshooting](#14-troubleshooting)
15. [Security checklist](#15-security-checklist)
16. [Quick reference](#16-quick-reference)

---

## 1. Architecture overview

```
 Customer (WhatsApp in-app browser)
              │
              │  HTTPS :6443
              ▼
 ┌────────────────────────────────────────────┐
 │  Production App Server                    │
 │  IP: 10.2.0.30                             │
 │  Public: 223.30.224.244 / bank domain      │
 │                                            │
 │  Nginx                                      │
 │   ├── /  →  Static React SPA (dist/)       │
 │   └── /dmCmsService/  →  proxy to API      │
 └────────────────────────────────────────────┘
              │
              │  TCP :8182 (outbound only)
              ▼
 ┌────────────────────────────────────────────┐
 │  Banking API Server                         │
 │  IP: 10.2.0.121                             │
 │  Service: dmCmsService                      │
 └────────────────────────────────────────────┘
```

| Component | Value |
|-----------|--------|
| App server (internal) | `10.2.0.30` |
| App server (public IP) | `223.30.224.244` |
| Bank domain (example) | `apiuat.ahmednagardccbank.in` |
| HTTPS port | `6443` |
| SPA files on server | `/usr/local/WhatsApp_Banking_React/dist/` |
| Nginx config | `/etc/nginx/conf.d/whatsapp-banking.conf` |
| Banking API | `http://10.2.0.121:8182/dmCmsService/` |

The React app calls APIs using the **same origin** path `/dmCmsService/rest/endpoints/...`. Nginx proxies those requests to the banking server. No API URL is hardcoded to `10.2.0.121` in the browser.

---

## 2. Roles and responsibilities

| Role | Responsibility |
|------|----------------|
| **Developer** | Build `dist/`, provide release notes, verify on UAT before production |
| **DevOps / IT** | Server access, Nginx, SSL, firewall, upload `dist/`, restart Nginx |
| **Network team** | Open HTTPS inbound to app server; allow outbound `10.2.0.30 → 10.2.0.121:8182` |
| **CBS / API team** | Whitelist app server IP on `dmCmsService` port `8182` |
| **WhatsApp / CRM team** | Configure quick links with production URL + `customerId` + `mobile` |

---

## 3. Prerequisites

### On developer machine (Windows)

| Item | Requirement |
|------|-------------|
| Node.js | v18+ recommended |
| npm | Comes with Node.js |
| Git | Clone/pull latest `main` branch |
| Project path | e.g. `C:\Users\<user>\Downloads\WhatsAppBanking\WhatsApp_Banking_React` |

### On production server (Linux)

| Item | Requirement |
|------|-------------|
| OS | RHEL 8+ / Ubuntu 22.04 (64-bit) |
| Nginx | Installed and enabled |
| Disk path | `/usr/local/WhatsApp_Banking_React/` |
| SSH / SFTP access | For IT team (e.g. `root@10.2.0.30`) |
| SSL certificate | Bank-issued `.crt` + `.key` (or `.pem` + `private.key`) |

### What to deploy (and what NOT to deploy)

| Deploy to server | Do NOT deploy |
|------------------|---------------|
| `dist/*` (built SPA) | `src/` (source code) |
| `deploy/nginx-whatsapp-banking.conf` | `.env` (secrets — used only at build time) |
| `deploy/setup-server.sh` | `node_modules/` |
| | Git repository |

---

## 4. Server and network requirements

### Firewall — inbound to app server (`10.2.0.30`)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| **6443** | HTTPS | Internet / customer networks | WhatsApp banking SPA |
| **80** | HTTP | Optional | Redirect to HTTPS |
| **22** | SSH | Bank admin subnet only | Server maintenance |

### Firewall — outbound from app server

| Destination | Port | Purpose |
|-------------|------|---------|
| `10.2.0.121` | **8182** | dmCmsService banking APIs |
| DNS | 53 | Name resolution |
| Patch servers | 443 | OS updates |

### CBS team action (`10.2.0.121`)

Allow **inbound TCP 8182** from source **`10.2.0.30`** only.

> **Important:** Port `8182` must NOT be opened to the public internet on the app server.

---

## 5. Step 1 — Build on developer machine

### 5.1 Get latest code

```powershell
cd C:\Users\<user>\Downloads\WhatsAppBanking\WhatsApp_Banking_React
git pull origin main
```

### 5.2 Configure environment (build-time only)

Copy the example file and set **production** API values:

```powershell
copy deploy\env.example .env
```

Edit `.env`:

```env
VITE_BANK_CODE=068
VITE_API_VENDOR=MOBILE
VITE_API_USERNAME=MOBILE
VITE_API_PASSWORD=<production_password>
VITE_API_SECRET_KEY=<production_secret_key>
VITE_API_CHANNEL=WB

# MUST be empty for production — app uses Nginx proxy /dmCmsService
VITE_API_BASE=
```

> These values are embedded into the JS bundle at build time.  
> Do not commit `.env` to Git. Share credentials only through a secure channel.

### 5.3 Install dependencies (first time or after package changes)

```powershell
npm install
```

### 5.4 Create production build

```powershell
npm run build
```

**Expected output:** folder `dist/` containing:

```
dist/
├── index.html
└── assets/
    ├── index-<hash>.js
    ├── index-<hash>.css
    ├── OpenFD-<hash>.js
    ├── PPS-<hash>.js
    ├── Nominee-<hash>.js
    └── PMSocial-<hash>.js
```

If build fails, fix TypeScript errors before proceeding. Do not deploy a failed build.

### 5.5 Optional — test build locally

```powershell
npm run preview
```

Open `http://localhost:4173/?service=openfd&customerId=<id>&mobile=<mobile>`  
(Local dev may need VPN for API calls unless Nginx proxy is configured.)

---

## 6. Step 2 — Upload files to server

### Option A — WinSCP (recommended for Windows team)

1. Connect to server: `root@10.2.0.30` (or bank-provided credentials).
2. On **server**, ensure folders exist:
   - `/usr/local/WhatsApp_Banking_React/dist/`
   - `/usr/local/WhatsApp_Banking_React/deploy/`
3. On **local machine**, open:
   - `...\WhatsApp_Banking_React\dist`
4. Select **all files inside `dist`** (not the folder itself) and upload to server:
   - `/usr/local/WhatsApp_Banking_React/dist/`
5. Upload deploy files to:
   - `/usr/local/WhatsApp_Banking_React/deploy/`
   - Files: `nginx-whatsapp-banking.conf`, `setup-server.sh`, `myapp.conf` (if using bank domain)

**WinSCP tip:** Use *Synchronize* or *Upload and delete* so old hashed JS/CSS files are removed after a new release.

### Option B — WinSCP automated script

Edit path in `deploy/winscp-deploy.txt` if your local folder differs, then run:

```powershell
& "C:\Program Files (x86)\WinSCP\WinSCP.com" /script="C:\Users\<user>\Downloads\WhatsAppBanking\WhatsApp_Banking_React\deploy\winscp-deploy.txt"
```

### Option C — SCP from Linux / Mac

```bash
scp -r dist/* root@10.2.0.30:/usr/local/WhatsApp_Banking_React/dist/
scp deploy/nginx-whatsapp-banking.conf deploy/setup-server.sh root@10.2.0.30:/usr/local/WhatsApp_Banking_React/deploy/
```

---

## 7. Step 3 — Configure Nginx

Nginx serves the React SPA and proxies banking API calls.

### 7.1 Choose config file

Two configs are provided in `deploy/`:

| File | Use when |
|------|----------|
| `nginx-whatsapp-banking.conf` | IP-based access (`223.30.224.244:6443`) |
| `myapp.conf` | Bank domain (`apiuat.ahmednagardccbank.in`) + IP |

For production with a bank domain, prefer **`myapp.conf`** and adjust `server_name` and SSL paths.

### 7.2 Example — production with domain (`myapp.conf`)

Key settings:

```nginx
server {
    listen 6443 ssl;
    server_name 223.30.224.244 apiuat.ahmednagardccbank.in;

    ssl_certificate     /etc/nginx/ssl/datavsn.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;

    root /usr/local/WhatsApp_Banking_React/dist;
    index index.html;

    # React Router — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Banking API proxy
    location /dmCmsService/ {
        proxy_pass http://10.2.0.121:8182/dmCmsService/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name apiuat.ahmednagardccbank.in 223.30.224.244;
    return 301 https://$host:6443$request_uri;
}
```

### 7.3 Install config on server

SSH into the server and run:

```bash
# Using automated script
chmod +x /usr/local/WhatsApp_Banking_React/deploy/setup-server.sh
bash /usr/local/WhatsApp_Banking_React/deploy/setup-server.sh
```

**Or manually** (if using `myapp.conf`):

```bash
sudo cp /usr/local/WhatsApp_Banking_React/deploy/myapp.conf /etc/nginx/conf.d/whatsapp-banking.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

> `nginx -t` must show `syntax is ok` and `test is successful` before restart.

---

## 8. Step 4 — SSL certificate

Place bank-issued certificate files on the server:

| File | Example path |
|------|----------------|
| Certificate | `/etc/nginx/ssl/datavsn.pem` or `/etc/ssl/certs/whatsapp-banking.crt` |
| Private key | `/etc/nginx/ssl/private.key` or `/etc/ssl/private/whatsapp-banking.key` |

```bash
sudo chmod 600 /etc/nginx/ssl/private.key
sudo chown root:root /etc/nginx/ssl/*
```

Update `ssl_certificate` and `ssl_certificate_key` paths in the Nginx config to match actual file locations.

After certificate update:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. Step 5 — Start / restart services

```bash
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## 10. Step 6 — Verify deployment

### 10.1 Server-side checks (SSH)

```bash
# Nginx config valid
sudo nginx -t

# Static files present
ls -la /usr/local/WhatsApp_Banking_React/dist/
ls -la /usr/local/WhatsApp_Banking_React/dist/assets/

# HTTP response from localhost
curl -Ik https://127.0.0.1:6443/ --insecure
curl -Ik https://127.0.0.1:6443/dmCmsService/ --insecure
```

### 10.2 Browser checks (from VPN or public network)

Open each service with test `customerId` and `mobile`:

| Service | Test URL |
|---------|----------|
| Open FD | `https://223.30.224.244:6443/?service=openfd&customerId=<id>&mobile=<mobile>` |
| PPS | `https://223.30.224.244:6443/?service=pps&customerId=<id>&mobile=<mobile>` |
| Nominee | `https://223.30.224.244:6443/?service=nominee&customerId=<id>&mobile=<mobile>` |
| PMJJBY | `https://223.30.224.244:6443/?service=pmsocial&subservice=PMJJBY&customerId=<id>&mobile=<mobile>` |
| PMSBY | `https://223.30.224.244:6443/?service=pmsocial&subservice=PMSBY&customerId=<id>&mobile=<mobile>` |
| PMAPY | `https://223.30.224.244:6443/?service=pmsocial&subservice=PMAPY&customerId=<id>&mobile=<mobile>` |

Replace host with `apiuat.ahmednagardccbank.in` if using bank domain.

### 10.3 Functional checklist

- [ ] Page loads without blank screen
- [ ] Account dropdown loads (API proxy working)
- [ ] OTP send and verify works
- [ ] Each service completes end-to-end on a test account
- [ ] Browser DevTools → Network: API calls go to `/dmCmsService/...` (not direct to `10.2.0.121`)
- [ ] No mixed-content (HTTP) errors

---

## 11. WhatsApp public URLs

Base URL (production — update when bank provides final domain):

```
https://223.30.224.244:6443/
```

or

```
https://apiuat.ahmednagardccbank.in:6443/
```

### Required query parameters

| Parameter | Required | Example | Notes |
|-----------|----------|---------|-------|
| `service` | Yes | `openfd` | `pps` \| `nominee` \| `pmsocial` \| `openfd` |
| `customerId` | Yes | `R00047` | From WhatsApp / bank CRM |
| `mobile` | Yes | `9908360790` | Customer registered mobile |
| `subservice` | PM Social only | `PMJJBY` | `PMJJBY` \| `PMSBY` \| `PMAPY` |

### Link templates for WhatsApp Business

```
https://<HOST>:6443/?service=openfd&customerId={customerId}&mobile={mobile}
https://<HOST>:6443/?service=pps&customerId={customerId}&mobile={mobile}
https://<HOST>:6443/?service=nominee&customerId={customerId}&mobile={mobile}
https://<HOST>:6443/?service=pmsocial&subservice=PMJJBY&customerId={customerId}&mobile={mobile}
https://<HOST>:6443/?service=pmsocial&subservice=PMSBY&customerId={customerId}&mobile={mobile}
https://<HOST>:6443/?service=pmsocial&subservice=PMAPY&customerId={customerId}&mobile={mobile}
```

Replace `<HOST>` with production domain or IP.  
WhatsApp team should use **dynamic** `customerId` and `mobile` per customer — not hardcoded test values.

---

## 12. Updating a release (re-deploy)

Standard release process:

1. Developer: `git pull` → update `.env` if credentials changed → `npm run build`
2. IT: upload new `dist/*` to server (delete old assets if not using sync)
3. IT: `sudo nginx -t && sudo systemctl reload nginx` (reload only if Nginx config changed)
4. QA: smoke test all 4 services
5. Communicate release to WhatsApp team if URLs changed

**No server restart is required** for frontend-only updates — only replace `dist/` files.

---

## 13. Rollback

1. Keep previous `dist/` backup on server, e.g.:
   ```bash
   cp -r /usr/local/WhatsApp_Banking_React/dist /usr/local/WhatsApp_Banking_React/dist.backup.YYYYMMDD
   ```
2. To rollback:
   ```bash
   rm -rf /usr/local/WhatsApp_Banking_React/dist
   cp -r /usr/local/WhatsApp_Banking_React/dist.backup.YYYYMMDD /usr/local/WhatsApp_Banking_React/dist
   ```
3. Hard-refresh browser or clear cache when testing.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blank white page | `dist/` not uploaded or wrong path | Check `root` in Nginx points to `/usr/local/WhatsApp_Banking_React/dist` |
| 404 on page refresh | Missing SPA fallback | Ensure `try_files $uri $uri/ /index.html;` in `location /` |
| API calls fail / CORS errors | Nginx proxy not configured | Verify `location /dmCmsService/` block and `proxy_pass` URL |
| 502 Bad Gateway on API | Cannot reach `10.2.0.121:8182` | Check firewall outbound rule; confirm CBS whitelisted `10.2.0.30` |
| SSL certificate error | Wrong cert path or expired cert | Update paths in Nginx; renew certificate |
| Old UI after deploy | Browser cache | Hard refresh (Ctrl+Shift+R) or test in incognito |
| `nginx -t` fails | Syntax error in config | Fix config file; compare with `deploy/myapp.conf` |
| Accounts not loading | API credentials wrong in build | Rebuild with correct `.env` and re-upload `dist/` |

### Useful log commands

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
sudo systemctl status nginx
```

---

## 15. Security checklist

Before production go-live:

- [ ] Only `dist/` deployed — no `src/`, `.env`, or Git repo on server
- [ ] HTTPS enforced on port `6443`
- [ ] Port `8182` not exposed to internet on app server
- [ ] SSH restricted to admin IPs
- [ ] Production API credentials in `.env` at build time (not stored on server as plain text)
- [ ] WhatsApp links use production host, not localhost or dev IP
- [ ] SSL certificate valid and not expiring within 30 days
- [ ] Previous `dist` backup taken before each release

> **Future improvement:** Move API password, secret key, and checksum generation to a backend (BFF) so they are not embedded in the browser bundle. See `docs/WhatsApp_Banking_Deployment_Specification.md` section 9.

---

## 16. Quick reference

| Item | Value |
|------|--------|
| Build command | `npm run build` |
| Output folder | `dist/` |
| Server app path | `/usr/local/WhatsApp_Banking_React/dist/` |
| Nginx config | `/etc/nginx/conf.d/whatsapp-banking.conf` |
| App server | `10.2.0.30` |
| Public IP | `223.30.224.244` |
| Domain | `apiuat.ahmednagardccbank.in` |
| HTTPS port | `6443` |
| API backend | `http://10.2.0.121:8182/dmCmsService/` |
| Test Nginx | `sudo nginx -t` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Reload Nginx | `sudo systemctl reload nginx` |

---

## Support contacts (fill in)

| Team | Contact | Responsibility |
|------|---------|----------------|
| Development | _________________ | Build issues, app bugs |
| DevOps / IT | _________________ | Server, Nginx, SSL |
| Network | _________________ | Firewall rules |
| CBS / API | _________________ | dmCmsService on 10.2.0.121 |
| WhatsApp / CRM | _________________ | Customer quick links |

---

*End of document*
