# UAT / Production deployment

**Use the full team guide:** [`PRODUCTION-DEPLOYMENT-GUIDE.md`](./PRODUCTION-DEPLOYMENT-GUIDE.md)

That document covers build, upload, Nginx, SSL, verification, WhatsApp URLs, rollback, and troubleshooting.

## Quick UAT reference

| Item | Value |
|------|--------|
| Server | `10.2.0.30` |
| Upload path | `/usr/local/WhatsApp_Banking_React/dist/` |
| API proxy | `http://10.2.0.121:8182/dmCmsService/` |
| Public URL | `https://223.30.224.244:6443/` |

```powershell
npm run build
# Upload dist/* via WinSCP, then on server:
bash /usr/local/WhatsApp_Banking_React/deploy/setup-server.sh
```

See also: [`WHATSAPP-URLS.md`](./WHATSAPP-URLS.md)
