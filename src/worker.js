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
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  const to = env.CONTACT_TO;
  const from = env.CONTACT_FROM;
  const origin = new URL(request.url).origin;

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) {
    return redirect(origin, "error");
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await overLimit(ip)) {
    return redirect(origin, "limited");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect(origin, "error");
  }

  if (String(form.get("company_url") || "").trim()) {
    return redirect(origin, "sent");
  }

  const token = String(form.get("cf-turnstile-response") || "");
  const turnstileOk = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
  if (!turnstileOk) {
    return redirect(origin, "error");
  }

  const name = oneLine(form.get("name"), 120);
  const email = oneLine(form.get("email"), 200);
  const organization = oneLine(form.get("organization"), 160);
  const message = String(form.get("message") || "").replace(/\r/g, "").trim().slice(0, 4000);
  if (!name || !email || !message || !email.includes("@")) {
    return redirect(origin, "error");
  }

  const raw = [
    `From: Placeholder Text <${from}>`,
    `To: ${to}`,
    `Reply-To: ${email}`,
    `Subject: Placeholder Text — ${name}`,
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
    return redirect(origin, "error");
  }
  return redirect(origin, "sent");
}

function redirect(_origin, code) {
  const copy = {
    sent: ["Message sent.", "We will reply from that inbox.", "success"],
    limited: ["Too many sends from this network.", "Wait a minute and try again.", "warning"],
    error: ["That message did not send.", "Check the fields and try again.", "danger"],
  };
  const [title, detail, kind] = copy[code] || copy.error;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/vendor/bootswatch/minty/bootstrap.min.css"><link rel="stylesheet" href="/theme/moss.css"></head><body><main class="container py-5"><div class="alert alert-${kind}" role="status"><h1 class="h4">${title}</h1><p class="mb-0">${detail}</p></div><a class="btn btn-primary" href="/#contact">Back</a></main></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
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
