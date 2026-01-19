export async function onRequestPost({ request, env }) {
  const form = await request.formData();

  const token = form.get("cf-turnstile-response");
  if (!token) {
    return new Response("Missing Turnstile token", { status: 400 });
  }

  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
      }),
    }
  );

  const verify = await verifyRes.json();
  if (!verify.success) {
    return new Response("Turnstile verification failed", { status: 403 });
  }

  const name = form.get("name") || "Unknown";
  const email = form.get("email") || "No email provided";
  const message = form.get("message") || "";

  await env.SEND_EMAIL.send({
    to: "info@caringmindsbh.com",
    from: "no-reply@caringmindsbh.com",
    subject: `Website Contact Form – ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
  });

  return new Response("OK", { status: 200 });
}
