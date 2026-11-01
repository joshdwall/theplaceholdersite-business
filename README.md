# Placeholder Text

Business site for [theplaceholdertext.com](https://theplaceholdertext.com/). This repository is the only publish source. It is not part of enVivo, joshdwall.com, or the other sites.

## UI

Bootstrap 5.3 and the Bootswatch Lux theme, vendored. See `VENDOR.md`.

## Contact routing

`config/contact.json` is the recipient.

```bash
node tools/set-contact-to.mjs someone@example.com
npx wrangler deploy
```

The new address must already be a verified Cloudflare Email Routing destination. Inbound mail to `info@theplaceholdertext.com` is forwarded there. The contact form sends to the same address.

## Deploy

```bash
npm install
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler deploy
```
