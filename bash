cat > pr-body.txt <<'EOF'
Summary:
Adds a Vercel serverless endpoint (/api/contact) and client-side handler (assets/contact-submit.js) to replace Formspree and provide better control, deliverability and logging. Includes a thank-you page and README with deploy & testing instructions.

Files added:
- api/contact.js
- assets/contact-submit.js
- contact.html (updated)
- thank-you.html
- .env.example
- README-contact-serverless.md

Testing steps:
1. Set env vars in your deployment: SENDGRID_API_KEY, SENDGRID_FROM, CONTACT_TO, optional RECAPTCHA_SECRET, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MIN.
2. Deploy the branch or push to your hosting and run:
   curl -i -X POST https://<your-deploy-url>/api/contact -H 'Content-Type: application/json' -d '{"name":"Test","_replyto":"test@example.com","message":"hello"}'
3. In a browser, submit the site contact form — on success the client should redirect to /thank-you.html. On failure the script will open a mailto fallback.

Notes:
- Uses a best-effort in-memory rate limiter; for production-grade limits enable Upstash Redis (see README).
- Ensure SENDGRID_FROM is verified in SendGrid; add SPF/DKIM records for deliverability.
- Do not commit API keys to the repository.
EOF
