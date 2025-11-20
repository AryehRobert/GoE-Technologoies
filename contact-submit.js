// Client-side submission handler: assets/contact-submit.js
// - Intercepts the form submit
// - Optionally runs reCAPTCHA v3 if you include the reCAPTCHA site script
// - POSTs JSON to /api/contact
// - On success: redirect to _next (hidden input) or data-next if present, otherwise show inline success
// - On failure: falls back to mailto using data-mailto from the form

document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('form.contact-form');
  if (!form) return;

  const statusEl = document.createElement('div');
  statusEl.className = 'form-status';
  form.appendChild(statusEl);

  function getNextUrl() {
    // priority: hidden input _next -> data-next attribute -> null
    const hidden = form.querySelector('input[name="_next"]');
    const dataNext = form.dataset.next;
    const val = hidden && hidden.value ? hidden.value.trim() : (dataNext ? dataNext.trim() : '');
    if (!val) return null;
    try { return new URL(val, location.origin).href; } catch (e) { return val; }
  }

  async function openMailtoFallback(formData) {
    const fallbackEmail = form.dataset.mailto || (document.querySelector('a[href^="mailto:"]')?.href?.replace(/^mailto:/i, '') || 'hello@goetech.com');
    const subject = encodeURIComponent('Website inquiry');
    const lines = [];
    for (const [k, v] of formData.entries()) {
      if (k === 'website') continue; // honeypot
      lines.push(`${k}: ${v}`);
    }
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:${encodeURIComponent(fallbackEmail)}?subject=${subject}&body=${body}`;
  }

  async function postToEndpoint(payload) {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      return { ok: true, json };
    } catch (err) {
      return { ok: false, error: err.message || 'Submit error' };
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    statusEl.textContent = '';
    const formData = new FormData(form);

    // Basic client-side validation
    const name = formData.get('name')?.toString().trim();
    const email = formData.get('_replyto')?.toString().trim() || formData.get('email')?.toString().trim();
    const message = formData.get('message')?.toString().trim();
    if (!name || !email || !message) {
      statusEl.textContent = 'Please complete all required fields.';
      statusEl.style.color = 'crimson';
      statusEl.setAttribute('role', 'alert');
      return;
    }

    statusEl.textContent = 'Sending…';
    statusEl.style.color = '';

    // reCAPTCHA v3 (optional)
    let recaptchaToken = '';
    if (window.grecaptcha && form.dataset.recaptchaSiteKey) {
      try {
        recaptchaToken = await grecaptcha.execute(form.dataset.recaptchaSiteKey, { action: 'submit' });
      } catch (err) {
        console.warn('reCAPTCHA client error', err);
      }
    }

    // Build payload
    const payload = {};
    formData.forEach((v, k) => { payload[k] = v; });
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;

    const result = await postToEndpoint(payload);
    if (result.ok) {
      const nextUrl = getNextUrl();
      if (nextUrl) {
        window.location.href = nextUrl;
        return;
      }
      statusEl.textContent = 'Thanks — your message was sent.';
      statusEl.style.color = 'green';
      form.reset();
    } else {
      statusEl.textContent = 'Unable to send via server — opening your email client...';
      statusEl.style.color = 'orange';
      // short delay so user sees the message
      setTimeout(() => openMailtoFallback(formData), 700);
    }
  });
});