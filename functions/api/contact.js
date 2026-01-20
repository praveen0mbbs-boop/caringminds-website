export async function onRequestPost({ request, env }) {
  try {
    // Parse incoming form data
    const formData = await request.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");
    const token = formData.get("cf-turnstile-response");

    // Basic validation
    if (!name || !email || !message) {
      return new Response("Missing required fields", { status: 400 });
    }

    if (!token) {
      return new Response("Missing Turnstile token", { status: 403 });
    }

    if (!env.TURNSTILE_SECRET) {
      return new Response("Server misconfiguration (TURNSTILE_SECRET missing)", {
        status: 500,
      });
    }

    // Verify Turnstile token with Cloudflare
    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
        }),
      }
    );

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.success) {
      return new Response("Turnstile verification failed", { status: 403 });
    }

    // Send email using Cloudflare Email Routing binding
    if (!env.SEND_EMAIL) {
      return new Response("Email service not configured", { status: 500 });
    }

    await env.SEND_EMAIL.send({
      to: "info@caringmindsbh.com",
      from: "Contact Form <no-reply@caringmindsbh.com>",
      subject: "New Contact Form Submission",
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
}
