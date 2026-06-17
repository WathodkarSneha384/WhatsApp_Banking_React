# WhatsApp Banking React Application
## Deployment & Architecture Specification

**Document Version:** 1.0  
**Date:** June 2025  
**Application:** WhatsApp Banking React SPA  
**Repository:** WhatsApp Banking React (`whatsapp-banking`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Application Flow](#3-application-flow)
4. [Application Components](#4-application-components)
5. [Prerequisites](#5-prerequisites)
6. [Infrastructure Requirements](#6-infrastructure-requirements)
7. [Hardware Configuration](#7-hardware-configuration)
8. [Firewall & Network Rules](#8-firewall--network-rules)
9. [Security Components](#9-security-components)
10. [Deployment Dependencies](#10-deployment-dependencies)
11. [Deployment Steps](#11-deployment-steps)
12. [Implementation Checklist](#12-implementation-checklist)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

The WhatsApp Banking React application is a single-page application (SPA) built with **React 19**, **TypeScript**, and **Vite**. It provides banking services delivered via WhatsApp quick links:

| Service | Description |
|---------|-------------|
| **PPS** | Positive Payment System — pre-register cheque details |
| **Nominee** | Nominee registration / update |
| **PM Social** | PMJJBY, PMSBY, PMAPY scheme enrollment |
| **Open FD** | Fixed deposit opening |

The application is deployed on a **Linux application server (10.2.0.30)** and communicates with the bank's **dmCmsService** API at **10.2.0.121:8182**.

---

## 2. Architecture Diagram

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL ZONE                                      │
│  ┌──────────────────────┐          ┌─────────────────────────────────────┐  │
│  │ WhatsApp Business    │          │ Customer Mobile Browser             │  │
│  │ Platform (Meta/Bank) │─────────▶│ (WhatsApp in-app WebView)           │  │
│  └──────────────────────┘          └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ HTTPS
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              APPLICATION SERVER — 10.2.0.30 (Linux)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Nginx / Apache — Reverse Proxy + TLS Termination                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                              │                                     │
│         ▼                              ▼                                     │
│  ┌──────────────────┐        ┌──────────────────────────────────────────┐  │
│  │ React SPA        │        │ Backend-for-Frontend (Recommended)       │  │
│  │ (Static dist/)   │        │ /api/validate-token                      │  │
│  │                  │        │ /dmCmsService proxy + secret management  │  │
│  └──────────────────┘        └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ Outbound TCP :8182
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BANK INTERNAL NETWORK                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  dmCmsService — 10.2.0.121:8182                                      │   │
│  │  Banking REST APIs (OTP, Accounts, PPS, Nominee, PM Schemes)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                              │                                     │
│         ▼                              ▼                                     │
│  ┌──────────────┐              ┌──────────────────┐                         │
│  │ OTP Service  │              │ Core Banking /   │                         │
│  │              │              │ CBS (backend)    │                         │
│  └──────────────┘              └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Recommended Production Security Architecture

```
 Customer Browser
       │
       │ HTTPS
       ▼
   [ WAF ]  (optional, recommended)
       │
       ▼
   [ Nginx ]  — TLS + reverse proxy
       │
       ├──▶ React SPA (static files)
       │
       └──▶ BFF (Node.js / Java)
                 │
                 │ Secrets + SHA-256 checksum (server-side)
                 ▼
            dmCmsService (10.2.0.121:8182)
```

### 2.3 Network Topology Summary

```
  [ Customer ] ──HTTPS──▶ [ 10.2.0.30 Firewall ] ──▶ [ Nginx + React SPA ]
                                                          │
                                                          │ 8182 (outbound)
                                                          ▼
                                              [ 10.2.0.121 Firewall ]
                                                          │
                                                          ▼
                                              [ dmCmsService :8182 ]
```

---

## 3. Application Flow

### 3.1 Sequence — Customer Journey

```
WhatsApp          Customer           Web App              BFF (opt.)         dmCmsService
   │                 │                  │                    │                  │
   │── quick link ──▶│                  │                    │                  │
   │                 │── open URL ─────▶│                    │                  │
   │                 │                  │── validate token ▶│                  │
   │                 │                  │◀── customer data ──│                  │
   │                 │                  │── API request ────▶│── signed POST ──▶│
   │                 │                  │◀── JSON response ──│◀── JSON ─────────│
   │                 │                  │                    │                  │
   │                 │                  │  [ OTP: sendotp → validateotp ]      │
   │                 │                  │  [ Business action: createPPS, etc. ]│
   │                 │◀── success ──────│                    │                  │
```

### 3.2 URL Entry Points

| Parameter | Example | Purpose |
|-----------|---------|---------|
| `service` | `pps`, `nominee`, `pmsocial`, `openfd` | Select banking service |
| `subservice` | `PMJJBY`, `PMSBY`, `PMAPY` | PM Social scheme (required for pmsocial) |
| `token` | Signed token string | Production entry via WhatsApp link |
| `customerId` | Customer CIF/ID | Dev/UAT fallback |
| `mobile` | Registered mobile | Dev/UAT fallback |

**Example URLs:**

```
https://banking.yourbank.com/?service=pps&token=<signed-token>
https://banking.yourbank.com/?service=pmsocial&subservice=PMJJBY&token=<signed-token>
```

### 3.3 PPS Service Flow (Current Implementation)

```
Select Service → Enter Details → Review → Verify OTP → Submit → Done
```

OTP verification occurs **after review** and **before final submission** to dmCmsService.

---

## 4. Application Components

### 4.1 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.x |
| Language | TypeScript | 6.x |
| Build tool | Vite | 8.x |
| Routing | React Router DOM | 7.x |
| Checksum | jsSHA (SHA-256) | 3.x |
| Web server | Nginx / Apache | Latest stable |

### 4.2 Key Source Modules

| Module | Path | Role |
|--------|------|------|
| Flow Router | `src/components/FlowRouter/index.tsx` | Service routing, lazy loading |
| Service Flow Hook | `src/hooks/useServiceFlow.ts` | URL parsing, token validation |
| Session Timeout | `src/hooks/useSessionTimeout.ts` | 30-minute session expiry |
| Banking API | `src/services/bankingApi.ts` | All dmCmsService API calls |
| Request Cache | `src/services/requestCache.ts` | Cached/deduplicated fetches |

### 4.3 Banking API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `validatemobileno` | Customer profile lookup |
| Account balance API | Account dropdown list |
| `getppsparameters` | PPS min/max cheque amount limits |
| `getrelations` | Nominee relationship master |
| `getpreinsamount` | PMJJBY/PMSBY insurance premium |
| `sendotp` | Send 5-digit OTP to registered mobile |
| `validateotp` | Validate OTP before transaction |
| `createPPSChequeEntry` | Submit Positive Payment entry |
| `verifyexistingnominees` | Check existing nominees |
| `nomineeregistration` | Register/update nominee |
| `doProcessPMJJBYSBY` | PMJJBY/PMSBY enrollment |

**API Base Path:** `/dmCmsService/rest/endpoints/`  
**Backend Target:** `http://10.2.0.121:8182`  
**Channel Code:** `WB` (WhatsApp Banking)

---

## 5. Prerequisites

### 5.1 Software Requirements — Build Server / 10.2.0.30

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20 LTS or 22 LTS | Build SPA (`npm run build`) |
| **npm** | 10+ | Package management |
| **Nginx** (or Apache) | Latest stable | Static hosting + reverse proxy |
| **OpenSSL / Certbot** | — | TLS certificate management |
| **Git** | Latest | Source code deployment |
| **BFF runtime** (recommended) | Node 20+ or Java 17+ | Token validation, API proxy, secrets |

### 5.2 Build Commands

```bash
git clone <repository-url>
cd whatsapp-banking
npm ci
npm run build
# Output directory: dist/
```

### 5.3 Runtime Requirements

| Scenario | Node.js at runtime? |
|----------|---------------------|
| Static SPA + Nginx only | **No** (not recommended for production) |
| SPA + Nginx + BFF | **Yes** (Node or Java for BFF) |

### 5.4 Operating System

| OS | Version |
|----|---------|
| RHEL | 8+ |
| Ubuntu Server | 22.04 LTS (64-bit) |
| Other | Any enterprise Linux with Nginx support |

---

## 6. Infrastructure Requirements

### 6.1 Server Roles

| Server | IP | Role |
|--------|-----|------|
| **Application Server** | **10.2.0.30** | React SPA + Nginx (+ BFF) |
| **Banking API Server** | **10.2.0.121** | dmCmsService (existing CBS layer) |

### 6.2 Directory Layout (10.2.0.30)

```
/var/www/whatsapp-banking/          → SPA static files (dist/ output)
/etc/nginx/conf.d/
    whatsapp-banking.conf           → Nginx site configuration
/opt/whatsapp-banking-bff/          → BFF application (recommended)
/var/log/nginx/                     → Access and error logs
/etc/ssl/certs/                     → TLS certificates
```

### 6.3 Nginx Responsibilities

1. Serve React SPA with `try_files` for client-side routing.
2. Terminate TLS (HTTPS).
3. Reverse proxy `/dmCmsService/` → `http://10.2.0.121:8182/dmCmsService/`.
4. Reverse proxy `/api/` → BFF service (localhost).
5. Enforce security headers (HSTS, X-Frame-Options, CSP).

### 6.4 Nginx Configuration (Reference)

```nginx
server {
    # Configure HTTPS listener per bank SSL/TLS policy
    server_name banking.yourbank.com;

    ssl_certificate     /etc/ssl/certs/banking.crt;
    ssl_certificate_key /etc/ssl/private/banking.key;

    root /var/www/whatsapp-banking;
    index index.html;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # React SPA — client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Banking API proxy
    location /dmCmsService/ {
        proxy_pass http://10.2.0.121:8182/dmCmsService/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    # Token validation BFF
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 6.5 DNS & Public URL

| Item | Requirement |
|------|-------------|
| Public hostname | e.g. `banking.yourbank.com` |
| DNS A record | Points to **10.2.0.30** (or load balancer VIP) |
| SSL certificate | Bank CA or trusted public CA |
| WhatsApp link base URL | Must match SSL certificate CN/SAN |

---

## 7. Hardware Configuration

### 7.1 Server Overview

| Server | IP | Role | Provisioned by |
|--------|-----|------|----------------|
| WA-Banking-App-01 | **10.2.0.30** | React SPA + Nginx + BFF | Bank IT (this project) |
| CBS-API (existing) | **10.2.0.121** | dmCmsService | Bank CBS team (existing) |

---

### 7.2 Application Server — 10.2.0.30

#### A. Minimum (UAT / Low Traffic — up to ~50 concurrent users)

| Component | Specification |
|-----------|---------------|
| Server type | VM or bare metal |
| **CPU** | 2 vCPU / 2 cores |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |
| **Network** | 1 Gbps NIC |
| OS partition | 20 GB |
| App partition | 10 GB |
| Log partition | 20 GB |

#### B. Recommended (Production — 100–500 concurrent users)

| Component | Specification |
|-----------|---------------|
| Server type | Virtual Machine (recommended) |
| **CPU** | **4 vCPU / 4 cores @ 2.4 GHz+** |
| **RAM** | **8 GB** |
| **Storage** | **100 GB SSD** (NVMe preferred) |
| **Network** | 1 Gbps NIC |
| OS partition | 30 GB |
| Application partition | 20 GB |
| Logs & backup partition | 50 GB |

#### C. High Availability (500+ concurrent users / 24×7 critical)

| Component | Specification |
|-----------|---------------|
| App servers | 2 nodes: 10.2.0.30 + 10.2.0.31 (standby) |
| CPU per node | 4–8 vCPU |
| RAM per node | 16 GB |
| Storage per node | 100–200 GB SSD/NVMe |
| Load balancer | Separate VM: 2 vCPU, 4 GB RAM, 20 GB disk |

---

### 7.3 Detailed Hardware Breakdown — 10.2.0.30

#### Processor

| Item | Detail |
|------|--------|
| Minimum | 2 cores |
| **Recommended** | **4 cores** |
| Primary usage | Nginx, optional BFF, SSL termination |
| Note | CPU is rarely the bottleneck; backend API latency is the typical constraint |

#### Memory (RAM)

| Service | Approx. RAM |
|---------|-------------|
| Linux OS | 512 MB – 1 GB |
| Nginx | 50 – 200 MB |
| Node.js BFF | 256 – 512 MB |
| Java Spring BFF | 512 MB – 1 GB |
| Buffer / cache | 1 – 2 GB |
| **Total recommended** | **8 GB** |

#### Storage

| Mount Point | Size | Purpose |
|-------------|------|---------|
| `/` | 30 GB | OS, packages |
| `/var/www/whatsapp-banking` | 5 GB | Static SPA build |
| `/var/log` | 20–40 GB | Nginx, BFF, audit logs (30-day retention) |
| `/opt` | 10 GB | BFF application |
| Swap | 2–4 GB | Safety buffer (optional on VM) |

**Disk type:** SSD mandatory; NVMe preferred.

#### Network

| Item | Specification |
|------|---------------|
| NIC speed | 1 Gbps minimum |
| IP address | 10.2.0.30 (static) |
| DNS | Bank internal DNS servers |
| Latency to 10.2.0.121 | < 5 ms (same datacenter/VLAN) |

---

### 7.4 Optional Dedicated BFF Server

| Option | CPU | RAM | Storage | Notes |
|--------|-----|-----|---------|-------|
| Co-located on 10.2.0.30 | Included above | Included | Included | Simplest — recommended for initial deployment |
| Dedicated BFF VM | 2 vCPU | 4 GB | 30 GB SSD | Better isolation of API secrets |

---

### 7.5 Development / Staging Servers (Optional)

| Environment | CPU | RAM | Storage | Example IP |
|-------------|-----|-----|---------|------------|
| Development | 2 vCPU | 4 GB | 40 GB | 10.2.0.29 |
| UAT / Staging | 2–4 vCPU | 4–8 GB | 50 GB | 10.2.0.32 |

---

### 7.6 Banking API Server — 10.2.0.121 (Reference Only)

| Item | Detail |
|------|--------|
| IP | 10.2.0.121 |
| Port | 8182 |
| Hardware | As per existing CBS/dmCmsService standard |
| Action required | Whitelist **10.2.0.30** as allowed source on port **8182** |

---

### 7.7 Hardware Summary — IT Request Form

| # | Server Name | IP | Role | CPU | RAM | Disk | OS |
|---|-------------|-----|------|-----|-----|------|-----|
| 1 | **WA-Banking-App-01** | **10.2.0.30** | React SPA + Nginx + BFF | **4 vCPU** | **8 GB** | **100 GB SSD** | RHEL 8+ / Ubuntu 22.04 |
| 2 | WA-Banking-App-02 (optional HA) | 10.2.0.31 | Standby node | 4 vCPU | 8 GB | 100 GB SSD | Same |
| 3 | CBS-API (existing) | 10.2.0.121 | dmCmsService | Bank standard | Bank standard | Bank standard | Bank standard |

**Standard IT provisioning request:**

```
Server Name    : WA-Banking-App-01
IP Address     : 10.2.0.30
OS             : RHEL 8 / Ubuntu 22.04 LTS (64-bit)
CPU            : 4 vCPU
RAM            : 8 GB
Storage        : 100 GB SSD
Network        : 1 Gbps, static IP
Firewall IN    : HTTPS
Firewall OUT   : TCP 8182 to 10.2.0.121
Purpose        : WhatsApp Banking React web application
```

---

### 7.8 Backup & DR

| Item | Requirement |
|------|-------------|
| Backup storage | 50 GB network share for configs + build artifacts |
| Backup scope | Nginx config, BFF config, SSL certs, `dist/` builds |
| DR server | Mirror of 10.2.0.30 at DR site (same hardware specs) if required |
| RTO / RPO | Define with bank (suggested: RTO 4 hrs, RPO 24 hrs) |

---

## 8. Firewall & Network Rules

### 8.1 Inbound Rules — 10.2.0.30

| Protocol | Source | Purpose | Required |
|----------|--------|---------|----------|
| **HTTPS** | Internet / customer IP ranges | SPA access | **Yes** |
| **SSH** | Bank admin subnet only | Server maintenance | Admin only |

> Do **not** open inbound access on port 8182. Port 8182 is only required as **outbound** from 10.2.0.30 to 10.2.0.121.

### 8.2 Outbound Rules — 10.2.0.30

| Destination | Protocol | Purpose | Required |
|-------------|----------|---------|----------|
| **10.2.0.121** | TCP **8182** | dmCmsService banking APIs | **Yes** |
| Internet / patch servers | **HTTPS** | OS updates, SSL cert renewal | Recommended |
| DNS servers | UDP/TCP **53** | Name resolution | **Yes** |

### 8.3 Inbound Rules — 10.2.0.121 (CBS Team Action)

| Source | Port | Protocol | Purpose |
|--------|------|----------|---------|
| **10.2.0.30** | **8182** | TCP | Allow dmCmsService API calls from app server |

### 8.4 Internal Ports — Do Not Expose on Firewall

| Port | Service | Exposure |
|------|---------|----------|
| 3000 / 8080 | BFF (Node/Java) | Localhost / Nginx proxy only |
| 5173 | Vite dev server | Development only — never in production |

### 8.5 Firewall Rule Summary

```
# ── INBOUND to 10.2.0.30 ──────────────────────────────────
ALLOW  HTTPS  FROM  <Customer / Public IP ranges>
ALLOW  SSH    FROM  <Bank Admin subnet only>

# ── OUTBOUND from 10.2.0.30 ───────────────────────────────
ALLOW  TCP 8182 TO    10.2.0.121
ALLOW  HTTPS   TO    <Update / CA servers>
ALLOW  UDP/TCP 53 TO  <DNS servers>

# ── INBOUND to 10.2.0.121 (CBS team) ─────────────────────
ALLOW  TCP 8182 FROM  10.2.0.30

# ── DENY ──────────────────────────────────────────────────
DENY   TCP 8182 INBOUND TO 10.2.0.30
DENY   ALL other inbound by default
```

---

## 9. Security Components

### 9.1 Security Matrix

| Component | Current State | Production Requirement |
|-----------|---------------|------------------------|
| **TLS / HTTPS** | HTTP in dev | **Mandatory** |
| **Token-based entry** | `?token=` → `/api/validate-token` | Implement signed, time-bound tokens on BFF |
| **API credentials** | Hardcoded in frontend (`SECRET_KEY`, `PASSWORD`) | **Move to BFF** — never expose in browser |
| **Checksum (SHA-256)** | Generated client-side (`jssha`) | Generate server-side on BFF |
| **OTP verification** | 5-digit via `sendotp` / `validateotp` | Rate-limit on BFF; lock after N failures |
| **Session timeout** | 30 minutes (`sessionStorage`) | Retain; optionally sync with server session |
| **CORS** | Not configured | Restrict to bank domain via Nginx/BFF |
| **Input validation** | Client-side (PPS amounts, dates) | Duplicate validation on BFF |
| **Logging** | Console logs in browser | Centralized server logs; no PII or secrets |
| **WAF** | Not configured | Recommended in front of HTTPS |
| **Account masking** | Last 4 digits shown in UI | Retain |

### 9.2 Known Production Blockers (Current Code)

| Issue | Risk | Resolution |
|-------|------|------------|
| `SECRET_KEY` and `PASSWORD` in `bankingApi.ts` | Critical — exposed in browser bundle | Move to BFF |
| `/api/validate-token` is a stub | High — no real token validation | Implement on BFF |
| Direct browser → dmCmsService | Medium — bypasses server controls | Proxy all API calls via BFF/Nginx |

### 9.3 Session Management

| Setting | Value |
|---------|-------|
| Timeout | 30 minutes |
| Storage | `sessionStorage` (client-side) |
| Expiry action | Redirect to `/?session=expired` |
| Key | `wa_banking_session_start` |

### 9.4 OTP Security

| Setting | Value |
|---------|-------|
| OTP length | 5 digits |
| OTP type (current) | `TDACCOUNTOPEN` |
| Send endpoint | `sendotp` |
| Validate endpoint | `validateotp` |
| Delivery | SMS to registered mobile via bank OTP gateway |

---

## 10. Deployment Dependencies

### 10.1 Hard Dependencies

| Dependency | Detail |
|------------|--------|
| **dmCmsService** | Must be reachable at `10.2.0.121:8182` from `10.2.0.30` |
| **WhatsApp quick-link generator** | Bank system must issue URLs with valid signed `token` |
| **OTP SMS gateway** | Behind bank `sendotp` API — must be operational |
| **SSL certificate** | Valid cert matching public banking URL |
| **DNS / public URL** | e.g. `banking.yourbank.com` → `10.2.0.30` |
| **Nginx** | Configured for SPA routing + API reverse proxy |
| **Firewall rules** | As defined in Section 8 |
| **CBS whitelist** | `10.2.0.30` allowed on `10.2.0.121:8182` |

### 10.2 Recommended Dependencies

| Dependency | Detail |
|------------|--------|
| **BFF service** | Token validation, secret management, API proxy |
| **Centralized logging** | Nginx access/error logs, BFF audit logs |
| **Monitoring / alerting** | Uptime, API latency, 5xx error rate |
| **WAF** | Web Application Firewall in front of HTTPS |
| **Backup schedule** | Daily config + build artifact backup |

### 10.3 External Dependencies

| System | Role |
|--------|------|
| WhatsApp Business Platform | Delivers secure quick links to customers |
| Bank OTP / SMS gateway | Sends 5-digit OTP to registered mobile |
| Bank CA / SSL provider | TLS certificate for public URL |
| Core Banking System (CBS) | Backend processing via dmCmsService |

---

## 11. Deployment Steps

### Step 1 — Server Provisioning

- Provision Linux VM per Section 7 hardware specs.
- Assign static IP **10.2.0.30**.
- Apply OS hardening per bank security policy.

### Step 2 — Firewall Configuration

- Apply inbound/outbound rules from Section 8.
- Request CBS team to whitelist `10.2.0.30` on `10.2.0.121:8182`.

### Step 3 — Software Installation

```bash
# Install Node.js (for build)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs nginx git

# Or on Ubuntu:
sudo apt update && sudo apt install -y nodejs npm nginx git
```

### Step 4 — Build & Deploy SPA

```bash
git clone <repository-url> /opt/whatsapp-banking-src
cd /opt/whatsapp-banking-src
npm ci
npm run build
sudo cp -r dist/* /var/www/whatsapp-banking/
sudo chown -R nginx:nginx /var/www/whatsapp-banking
```

### Step 5 — Configure Nginx

```bash
sudo cp docs/nginx-whatsapp-banking.conf /etc/nginx/conf.d/whatsapp-banking.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### Step 6 — Deploy BFF (Recommended)

- Deploy Node.js or Java BFF to `/opt/whatsapp-banking-bff/`.
- Implement `/api/validate-token` endpoint.
- Move `SECRET_KEY`, `PASSWORD`, checksum generation to BFF.
- Configure as systemd service; bind to `127.0.0.1:3000`.

### Step 7 — SSL Certificate

```bash
# Using bank CA certificate:
sudo cp banking.crt /etc/ssl/certs/
sudo cp banking.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/banking.key
sudo systemctl restart nginx
```

### Step 8 — Verification Testing

Test all service flows using UAT URLs:

```
https://banking.yourbank.com/?service=pps&customerId=<id>&mobile=<mobile>
https://banking.yourbank.com/?service=pmsocial&subservice=PMJJBY&customerId=<id>&mobile=<mobile>
https://banking.yourbank.com/?service=nominee&customerId=<id>&mobile=<mobile>
https://banking.yourbank.com/?service=openfd&customerId=<id>&mobile=<mobile>
```

Verify:
- [ ] HTTPS loads without certificate errors
- [ ] All 4 services open correctly
- [ ] Account dropdown populates from API
- [ ] OTP send and validate works
- [ ] PPS: Review → OTP → Submit flow completes
- [ ] Session timeout redirects after 30 minutes
- [ ] API errors display user-friendly messages

---

## 12. Implementation Checklist

### Infrastructure Team

- [ ] Provision server 10.2.0.30 (4 vCPU, 8 GB RAM, 100 GB SSD)
- [ ] Install RHEL 8+ or Ubuntu 22.04 LTS
- [ ] Configure static IP 10.2.0.30
- [ ] Open inbound HTTPS on 10.2.0.30
- [ ] Open outbound TCP 8182 from 10.2.0.30 to 10.2.0.121
- [ ] Configure DNS A record for public banking URL
- [ ] Provision SSL certificate
- [ ] Restrict SSH (port 22) to admin subnet only

### CBS / API Team

- [ ] Whitelist 10.2.0.30 as allowed source on 10.2.0.121:8182
- [ ] Confirm all API endpoints are available in production
- [ ] Confirm OTP type `TDACCOUNTOPEN` is correct for all services
- [ ] Provide production `SECRET_KEY`, `USERNAME`, `PASSWORD`, `VENDOR` values

### Application Team

- [ ] Build and deploy SPA to `/var/www/whatsapp-banking/`
- [ ] Configure Nginx (SPA routing + API proxy)
- [ ] Implement BFF with `/api/validate-token`
- [ ] Move API secrets from frontend to BFF
- [ ] Test all service flows end-to-end
- [ ] Configure centralized logging
- [ ] Set up monitoring and alerting

### WhatsApp / Integration Team

- [ ] Configure WhatsApp quick-link base URL
- [ ] Implement signed token generation for production links
- [ ] Test link delivery and in-app browser opening
- [ ] Confirm session timeout behavior with WhatsApp WebView

---

## 13. Appendix

### 13.1 Service Flow Steps

| Service | Steps |
|---------|-------|
| PPS | Select Service → Enter Details → Review → Verify OTP → Submit → Done |
| Nominee | Select Account → Verify OTP → Nominee Details → Review → Done |
| PM Social | Fill Details → Review → Verify OTP → Done |
| Open FD | FD Details → Review → Verify OTP → Done |

### 13.2 Environment Comparison

| Item | Development | UAT | Production |
|------|-------------|-----|------------|
| Server | Local machine | 10.2.0.32 | **10.2.0.30** |
| API target | 10.2.0.121:8182 (Vite proxy) | 10.2.0.121:8182 | 10.2.0.121:8182 |
| HTTPS | No | Yes | Yes |
| BFF | No | Recommended | **Required** |
| Secrets in frontend | Yes (dev only) | No | **No** |
| Token validation | URL params fallback | BFF | BFF |

### 13.3 Vite Dev Proxy (Development Only)

```typescript
// vite.config.ts — development proxy only, not used in production
server: {
  proxy: {
    '/dmCmsService': {
      target: 'http://10.2.0.121:8182',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

Production uses Nginx reverse proxy instead.

### 13.4 Contact & Ownership

| Area | Owner |
|------|-------|
| Application server (10.2.0.30) | Bank IT / Infrastructure |
| dmCmsService (10.2.0.121) | CBS / Core Banking team |
| Firewall rules | Network / Security team |
| WhatsApp integration | Digital / WhatsApp team |
| Application code | Development team |

---

*End of Document*
