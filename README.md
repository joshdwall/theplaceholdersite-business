# ThePlaceholderText

Business site for [theplaceholdertext.com](https://theplaceholdertext.com/). This repository is the only publish source. It is not part of enVivo, joshdwall.com, or the other sites.

## Look

`public/config/site.json` is the page config. The worker reads it on every request and writes the name, tagline, font, and hero image into the HTML. Edit the file and refresh. There is no rebuild.

Change the wordmark font by setting `font` to one of `bricolage`, `literata`, or `source-serif`.

To use any other CSS stack, add `fontFamily`. That wins over `font`. A new font file also needs `fontStylesheet` pointing at a file under `/vendor/fonts/`.

```json
"fontFamily": "Georgia, serif"
```

On this machine, `npx wrangler dev` shows the edit on the next refresh. The public site shows it after `npx wrangler deploy`, then a refresh.

The hero photograph is public domain: Marianne Gagnon, “Mossy rock texture.” Swap it with `hero.image`.

## UI

The page is custom CSS in `public/theme/moss.css`. The layout follows the same shape as Roboyo, Vumi Studio, and Celonis: one claim, one photograph, then the work in plain rows. The name, font, and hero image still come from `public/config/site.json`. See `VENDOR.md`.

## Contact routing

`config/contact.json` is the recipient.

```bash
node tools/set-contact-to.mjs someone@example.com
npx wrangler deploy
```

The new address must already be a verified Cloudflare Email Routing destination. Inbound mail to `info@theplaceholdertext.com` is forwarded there. The contact form sends to the same address.

## Deploy / promote (cloud-only Done)

**SSOT:** GitHub Actions workflow **Promote ThePlaceholderText** in this repo (`push` to `main`, or `workflow_dispatch` with `confirm_production=promote-production`).

```bash
npm ci
npm run preview          # versions upload (non-prod)
npm run promote -- --confirm   # production deploy + live verify
npm run verify           # HTTPS checks against theplaceholdertext.com
```

Credentials: repo Actions secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (preferred), or Infisical Universal Auth reading `/cloudflare`.

Laptop `wrangler deploy` is bootstrap/debug only — not Done. enVivo **Standalone worker promote** remains a fallback bootstrap that can copy CLOUDFLARE_* into this repo’s Actions secrets.
