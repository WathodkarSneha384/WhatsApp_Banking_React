# Deploy WhatsApp Banking React to 10.2.0.30 (UAT)

## What gets deployed

| Item | Server path |
|------|-------------|
| Built SPA (`dist/`) | `/usr/local/WhatsApp_Banking_React/dist/` |
| Nginx config | `/etc/nginx/conf.d/whatsapp-banking.conf` |
| API proxy target | `http://10.2.0.121:8182/dmCmsService/` |

## Option A — WinSCP manual upload

1. Connect WinSCP as `root@10.2.0.30` (you already have this session).
2. On the **right (server)**, open `/usr/local/WhatsApp_Banking_React/`.
3. Create folder `dist` if it does not exist.
4. On the **left (local)**, open:
   `C:\Users\Sneha\Downloads\WhatsAppBanking\WhatsApp_Banking_React\dist`
5. Select **all files inside `dist`** (not the folder itself) and drag to server `dist/`.
6. Upload the `deploy` folder to `/usr/local/WhatsApp_Banking_React/deploy/`.
7. In WinSCP: **Commands → Open Terminal** (or use PuTTY) and run:

```bash
chmod +x /usr/local/WhatsApp_Banking_React/deploy/setup-server.sh
bash /usr/local/WhatsApp_Banking_React/deploy/setup-server.sh
```

## Option B — WinSCP script (automated)

1. In WinSCP, save your `root@10.2.0.30` session (with password stored if allowed).
2. Run from PowerShell:

```powershell
& "C:\Program Files (x86)\WinSCP\WinSCP.com" /script="C:\Users\Sneha\Downloads\WhatsAppBanking\WhatsApp_Banking_React\deploy\winscp-deploy.txt"
```

Adjust the WinSCP.com path if installed elsewhere.

## Verify

```bash
nginx -t
systemctl status nginx
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/dmCmsService/
```

Open in browser (on VPN):

```
https://223.30.224.244:6443/?service=openfd&customerId=R00047&mobile=9908360790
```

See `deploy/WHATSAPP-URLS.md` for all 4 service link templates.

## SSL (when bank cert is ready)

1. Copy cert/key to `/etc/ssl/certs/` and `/etc/ssl/private/`.
2. Uncomment the HTTPS `server` block in `deploy/nginx-whatsapp-banking.conf`.
3. Re-run `setup-server.sh` or copy config and `nginx -t && systemctl restart nginx`.

## Rebuild locally after code changes

```powershell
cd C:\Users\Sneha\Downloads\WhatsAppBanking\WhatsApp_Banking_React
npm run build
```

Then re-upload `dist/*` to the server.
