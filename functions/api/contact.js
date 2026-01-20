export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const message = (data.message || "").trim();

    if (!name || !email || !message) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Turnstile validation
    const token =
      (data.turnstile || "").trim() ||
      (data.token || "").trim() ||
      (data["cf-turnstile-response"] || "").trim();

    if (!token) {
      return new Response("Missing/invalid fields: turnstile", { status: 400 });
    }

    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
        }),
      }
    ).then((res) => res.json());

    if (!verify.success) {
      return new Response("Turnstile verification failed", { status: 403 });
    }

    // Resend email
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      return new Response("RESEND_API_KEY missing", { status: 500 });
    }

    const payload = {
      from: "noreply@caringmindsbh.com",
      to: "info@caringmindsbh.com",
      subject: "New Contact Form Submission",
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(`Resend error: ${res.status} ${text}`, { status: 502 });
    }

    return new Response("Message sent successfully", { status: 200 });
  } catch (err) {
    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
}
