/**
 * Cloudflare Pages Function: /api/contact
 *
 * 1) Accepts POST from your HTML form
 * 2) Verifies Cloudflare Turnstile token server-side
 * 3) Sends an email to info@caringmindsbh.com via MailChannels
 *
 * Pages -> Settings -> Environment variables:
 *   TURNSTILE_SECRET   (required)
 *   MAIL_FROM          (optional) default: noreply@caringmindsbh.com
 *   MAIL_FROM_NAME     (optional) default: Caring Minds Website
 *   MAIL_TO            (optional) default: info@caringmindsbh.com
 *   SUBJECT_PREFIX     (optional) default: Website Contact
 */

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeText(s) {
  return String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

async function verifyTurnstile({ secret, token, remoteip }) {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteip) form.append('remoteip', remoteip);

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });

  if (!resp.ok) {
    return { ok: false, error: `turnstile_http_${resp.status}` };
  }

  const data = await resp.json();
  return { ok: !!data.success, data };
}

async function sendMailchannels({ fromEmail, fromName, toEmail, subject, textBody, replyToEmail }) {
  const payload = {
    personalizations: [
      {
        to: [{ email: toEmail }],
      },
    ],
    from: {
      email: fromEmail,
      name: fromName,
    },
    subject,
    content: [{ type: 'text/plain', value: textBody }],
  };

  // If you want replies to go to the visitor who filled the form:
  if (replyToEmail) {
    payload.reply_to = { email: replyToEmail };
  }

  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // MailChannels returns 202 for accepted
  if (resp.status === 202) return { ok: true };

  const text = await resp.text().catch(() => '');
  return { ok: false, error: `mailchannels_${resp.status}`, detail: text.slice(0, 500) };
}

function wantsJson(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('application/json');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.TURNSTILE_SECRET) {
    return new Response('Server missing TURNSTILE_SECRET env var.', { status: 500 });
  }

  const contentType = request.headers.get('content-type') || '';

  let name = '';
  let email = '';
  let message = '';
  let token = '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    name = body.name;
    email = body.email;
    message = body.message;
    token = body['cf-turnstile-response'] || body.turnstileToken;
  } else {
    // Works with regular <form method="POST">
    const form = await request.formData();
    name = form.get('name');
    email = form.get('email');
    message = form.get('message');
    token = form.get('cf-turnstile-response');
  }

  name = escapeText(name);
  email = escapeText(email);
  message = escapeText(message);
  token = escapeText(token);

  // Basic validation
  const errors = [];
  if (!name) errors.push('name');
  if (!isValidEmail(email)) errors.push('email');
  if (!message) errors.push('message');
  if (!token) errors.push('turnstile');

  if (errors.length) {
    const payload = { ok: false, error: 'validation', fields: errors };
    if (wantsJson(request)) {
      return Response.json(payload, { status: 400 });
    }
    return new Response('Missing/invalid fields: ' + errors.join(', '), { status: 400 });
  }

  // Turnstile verify
  const remoteip = request.headers.get('cf-connecting-ip') || undefined;
  const ver = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token,
    remoteip,
  });

  if (!ver.ok) {
    const payload = { ok: false, error: 'turnstile_failed', detail: ver.error || ver.data };
    if (wantsJson(request)) {
      return Response.json(payload, { status: 403 });
    }
    return new Response('Turnstile verification failed.', { status: 403 });
  }

  // Email compose
  const toEmail = env.MAIL_TO || 'info@caringmindsbh.com';
  const fromEmail = env.MAIL_FROM || 'noreply@caringmindsbh.com';
  const fromName = env.MAIL_FROM_NAME || 'Caring Minds Website';
  const subjectPrefix = env.SUBJECT_PREFIX || 'Website Contact';

  const subject = `${subjectPrefix}: ${name}`;
  const textBody = [
    'New website contact form submission',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    'Message:',
    message,
    '',
    `Time (UTC): ${new Date().toISOString()}`,
    `IP: ${remoteip || 'unknown'}`,
  ].join('\n');

  const sent = await sendMailchannels({
    fromEmail,
    fromName,
    toEmail,
    subject,
    textBody,
    replyToEmail: email,
  });

  if (!sent.ok) {
    const payload = { ok: false, error: sent.error, detail: sent.detail };
    if (wantsJson(request)) {
      return Response.json(payload, { status: 502 });
    }
    return new Response('Email send failed. ' + sent.error, { status: 502 });
  }

  // If normal form submission, redirect back to /contact/ with a flag.
  if (!wantsJson(request)) {
    return Response.redirect(`${new URL(request.url).origin}/contact/?sent=1`, 303);
  }

  return Response.json({ ok: true });
}

// Optional: nice message for GET /api/contact
export async function onRequestGet() {
  return new Response('OK. POST the form to this endpoint.', { status: 200 });
}
