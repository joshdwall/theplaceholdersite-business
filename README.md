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

Bootstrap 5.3 and Bootswatch Minty, plus `public/theme/moss.css`. See `VENDOR.md`.

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
