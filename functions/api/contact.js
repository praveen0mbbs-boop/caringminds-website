export async function onRequestPost({ request, env }) {
  try {
    // ---- 1) Parse JSON body ----
    const data = await request.json().catch(() => null);
    if (!data) return new Response("Invalid JSON body", { status: 400 });

    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const message = (data.message || "").trim();

    if (!name || !email || !message) {
      return new Response("Missing required fields: name, email, message", { status: 400 });
    }

    // Token may arrive under different keys depending on your frontend
    const token =
      (data.turnstile || "").trim() ||
      (data.token || "").trim() ||
      (data["cf-turnstile-response"] || "").trim();

    if (!token) {
      return new Response("Missing/invalid fields: turnstile", { status: 400 });
    }

    // ---- 2) Verify Turnstile ----
    if (!env.TURNSTILE_SECRET) {
      return new Response("Server misconfig: TURNSTILE_SECRET missing", { status: 500 });
    }

    const verifyResp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
        }),
      }
    );

    const verify = await verifyResp.json().catch(() => null);
    if (!verify || !verify.success) {
      // verify["error-codes"] can explain why (e.g. timeout-or-duplicate)
      const codes = verify?.["error-codes"] ? JSON.stringify(verify["error-codes"]) : "";
      return new Response(`Turnstile verification failed ${codes}`, { status: 403 });
    }

    // ---- 3) Send email via MailChannels ----
    const MAIL_TO = env.MAIL_TO || "info@caringmindsbh.com";
    const FROM_EMAIL = env.MAIL_FROM || "noreply@caringmindsbh.com";
    const FROM_NAME = env.MAIL_FROM_NAME || "Caring Minds Website";
    const SUBJECT_PREFIX = env.SUBJECT_PREFIX || "";

    const payload = {
      personalizations: [{ to: [{ email: MAIL_TO }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },

      // Reply-To lets you hit "Reply" in Outlook and respond to the sender
      reply_to: { email, name },

      subject: `${SUBJECT_PREFIX}New Contact Form Submission`,
      content: [
        {
          type: "text/plain",
          value:
`New message from caringmindsbh.com contact form

Name: ${name}
Email: ${email}

Message:
${message}
`,
        },
      ],
    };

    const mcResp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const mcText = await mcResp.text();

    if (!mcResp.ok) {
      // Return exact MailChannels error to the browser so we can fix quickly
      return new Response(`MailChannels error ${mcResp.status}: ${mcText}`, { status: 502 });
    }

    return new Response("Message sent successfully ✅", { status: 200 });
  } catch (err) {
    return new Response(`Server error: ${err?.message || err}`, { status: 500 });
  }
}
