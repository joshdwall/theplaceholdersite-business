import { EmailMessage } from "cloudflare:email";

const MAX_BODY = 20_000;
const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 3;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.theplaceholdertext.com") {
      url.hostname = "theplaceholdertext.com";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return handleContact(request, env);
    }
    return renderAsset(request, env);
  },
};

async function handleContact(request, env) {
  const to = env.CONTACT_TO;
  const from = env.CONTACT_FROM;

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) {
    return redirect(request, env, "error");
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await overLimit(ip)) {
    return redirect(request, env, "limited");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect(request, env, "error");
  }

  if (String(form.get("company_url") || "").trim()) {
    return redirect(request, env, "sent");
  }

  const token = String(form.get("cf-turnstile-response") || "");
  const turnstileOk = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
  if (!turnstileOk) {
    return redirect(request, env, "error");
  }

  const name = oneLine(form.get("name"), 120);
  const email = oneLine(form.get("email"), 200);
  const organization = oneLine(form.get("organization"), 160);
  const message = String(form.get("message") || "").replace(/\r/g, "").trim().slice(0, 4000);
  if (!name || !email || !message || !email.includes("@")) {
    return redirect(request, env, "error");
  }

  const site = await loadSite(env, request);
  const brand = headerName(site.name);
  const raw = [
    `From: "${brand}" <${from}>`,
    `To: ${to}`,
    `Reply-To: ${email}`,
    `Subject: ${brand} — ${name}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Organization: ${organization || "(none)"}`,
    "",
    message,
  ].join("\r\n");

  try {
    await env.SEND_EMAIL.send(new EmailMessage(from, to, raw));
  } catch {
    return redirect(request, env, "error");
  }
  return redirect(request, env, "sent");
}

async function redirect(request, env, code) {
  const copy = {
    sent: ["Message sent.", "We will reply from that inbox.", "success"],
    limited: ["Too many sends from this network.", "Wait a minute and try again.", "warning"],
    error: ["That message did not send.", "Check the fields and try again.", "danger"],
  };
  const [title, detail, kind] = copy[code] || copy.error;
  const site = await loadSite(env, request);
  const html = applyHtml(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>__FONT_LINK__<style>:root{--brand-font:__FONT_FAMILY__}</style><link rel="stylesheet" href="/theme/moss.css"></head><body><main class="page-main"><div class="note${kind === "success" ? "" : kind === "warning" ? " note-warn" : " note-bad"}" role="status"><h1>${title}</h1><p>${detail}</p></div><p class="intro"><a class="button" href="/#contact">Back to __SITE_NAME__</a></p></main></body></html>`,
    site,
  );
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}

const FALLBACK_SITE = {
  name: "ThePlaceholderText",
  tagline: "We Fit Your Need.",
  summary: "ThePlaceholderText turns the work your staff already do into automations they will use.",
  font: "bricolage",
  fonts: {
    bricolage: {
      family: '"Bricolage Grotesque", "Segoe UI", sans-serif',
      stylesheet: "/vendor/fonts/bricolage-grotesque/font.css",
    },
  },
  hero: {
    image: "/media/moss-rocks.jpg",
    alt: "Lush green moss growing over forest rocks",
    credit: "Photograph by Marianne Gagnon. Public domain.",
  },
};

async function renderAsset(request, env) {
  const url = new URL(request.url);
  const response = await env.ASSETS.fetch(request);
  const type = response.headers.get("content-type") || "";
  if (url.pathname === "/config/site.json") {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-cache");
    return new Response(response.body, { status: response.status, headers });
  }
  if (!type.includes("text/html")) return response;
  const site = await loadSite(env, request);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-cache");
  headers.delete("content-length");
  return new Response(applyHtml(await response.text(), site), { status: response.status, headers });
}

async function loadSite(env, request) {
  try {
    const url = new URL("/config/site.json", request.url);
    const res = await env.ASSETS.fetch(new Request(url));
    if (!res.ok) return FALLBACK_SITE;
    const json = await res.json();
    return json && typeof json === "object" ? json : FALLBACK_SITE;
  } catch {
    return FALLBACK_SITE;
  }
}

function resolveFont(site) {
  if (typeof site.fontFamily === "string" && site.fontFamily.trim()) {
    return { family: site.fontFamily, stylesheet: site.fontStylesheet || "" };
  }
  const choice = site.fonts && site.fonts[site.font];
  if (choice && choice.family) return choice;
  return FALLBACK_SITE.fonts.bricolage;
}

function applyHtml(html, site) {
  const font = resolveFont(site);
  const href = fontHref(font.stylesheet);
  const link = href ? `<link rel="stylesheet" href="${esc(href)}" />` : "";
  const hero = site.hero || FALLBACK_SITE.hero;
  const pairs = [
    ["__FONT_LINK__", link],
    ["__FONT_FAMILY__", cssFamily(font.family)],
    ["__SITE_NAME__", esc(site.name || FALLBACK_SITE.name)],
    ["__SITE_TAGLINE__", esc(site.tagline || FALLBACK_SITE.tagline)],
    ["__SITE_SUMMARY__", esc(site.summary || FALLBACK_SITE.summary)],
    ["__HERO_IMAGE__", esc(assetPath(hero.image, FALLBACK_SITE.hero.image))],
    ["__HERO_ALT__", esc(hero.alt || FALLBACK_SITE.hero.alt)],
    ["__HERO_CREDIT__", esc(hero.credit || "")],
  ];
  let out = html;
  for (const [token, value] of pairs) out = out.replaceAll(token, value);
  return out;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssFamily(value) {
  const family = String(value || FALLBACK_SITE.fonts.bricolage.family).replace(/[<>{};\r\n]/g, "");
  return family.trim() || FALLBACK_SITE.fonts.bricolage.family;
}

function fontHref(value) {
  const path = String(value || "");
  if (!path.startsWith("/vendor/fonts/") || /["'<>\s]/.test(path)) return "";
  return path;
}

function assetPath(value, fallback) {
  const path = String(value || "");
  if (!path.startsWith("/") || /["'()\\\s<>]/.test(path)) return fallback;
  return path;
}

function headerName(value) {
  return String(value || FALLBACK_SITE.name).replace(/[\r\n"]/g, "").slice(0, 80) || FALLBACK_SITE.name;
}

function oneLine(value, max) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

async function overLimit(ip) {
  const key = new Request(`https://theplaceholdertext.com/__contact-limit/${ip}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) : 0;
  if (count >= MAX_PER_WINDOW) return true;
  await cache.put(
    key,
    new Response(String(count + 1), {
      headers: { "Cache-Control": `max-age=${WINDOW_SECONDS}` },
    }),
  );
  return false;
}

async function verifyTurnstile(token, ip, secret) {
  if (!token || !secret) return false;
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.success === true;
}
