# Caring Minds Website (Cloudflare Pages + Turnstile + Email)

This repo is ready to deploy to **Cloudflare Pages**.

It keeps your GoDaddy-built **Contact** page HTML as-is (fonts/styles/scripts) and wires the form to a secure server-side endpoint:

- `/contact/` → static page (`public/contact/index.html`)
- `/api/contact` → Pages Function (`functions/api/contact.js`)
  - verifies **Cloudflare Turnstile**
  - sends email to `info@caringmindsbh.com` via **MailChannels**

---

## Repo structure

```
public/
  index.html
  contact/
    index.html
functions/
  api/
    contact.js
```

---

## Cloudflare setup

### 1) Turnstile
Cloudflare Dashboard → **Turnstile**

- Mode: **Managed**
- Add domains:
  - `caringmindsbh.com`
  - `*.pages.dev`
- Copy the **Secret Key** (you’ll add it below)

> Your HTML already includes a Turnstile widget block + a hidden `cf-turnstile-response` field.

### 2) Pages environment variables
Cloudflare Dashboard → Pages → (your project) → **Settings → Environment variables**

Add:
- `TURNSTILE_SECRET` = your Turnstile secret key

Optional:
- `MAIL_TO` = `info@caringmindsbh.com`
- `MAIL_FROM` = `noreply@caringmindsbh.com`
- `MAIL_FROM_NAME` = `Caring Minds Website`
- `SUBJECT_PREFIX` = `Website Contact`

### 3) Deploy
1. Push this repo to GitHub
2. Cloudflare Pages → **Create project** → connect the repo
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Output directory: `public`

---

## DNS / email deliverability note (recommended)

MailChannels works best when your domain has an SPF record that authorizes it.

If you already have an SPF record, add this include:

```
include:relay.mailchannels.net
```

Important: you should have **only one** SPF record for your domain.

---

## Local testing (optional)

```bash
npm i -g wrangler
wrangler pages dev public --compatibility-date=2025-01-01
```

Open:
- http://localhost:8788/contact/
