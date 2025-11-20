# Serverless Contact Form Documentation

This serverless contact form implementation replaces the previous Formspree-based solution with a custom endpoint that provides better control, debugging capabilities, and email deliverability.

## Features

- ✅ Serverless API endpoint (`/api/contact`)
- ✅ Client-side form validation and AJAX submission
- ✅ SendGrid email delivery
- ✅ Honeypot spam protection
- ✅ In-memory rate limiting (with Upstash Redis option)
- ✅ Optional Google reCAPTCHA v3 integration
- ✅ Mailto fallback for failed submissions
- ✅ Accessible status messages with ARIA attributes
- ✅ Success page with redirect

## Required Environment Variables

Set these environment variables in your deployment platform (Vercel, Netlify, etc.):

### SendGrid Configuration (Required)

```bash
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM=noreply@yourdomain.com
CONTACT_TO=contact@yourdomain.com
```

**Note:** You must verify your sender email or domain in SendGrid before sending emails.

### reCAPTCHA (Optional)

```bash
RECAPTCHA_SECRET=your_recaptcha_secret_key
```

If set, the endpoint will verify reCAPTCHA v3 tokens. If not set, reCAPTCHA verification is skipped.

### Rate Limiting (Optional)

```bash
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_MIN=15
```

Defaults: 5 requests per 15 minutes per IP address.

## Deployment Instructions

### Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Install dependencies**:
   ```bash
   npm install @sendgrid/mail
   ```

3. **Add environment variables** in Vercel dashboard:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all required variables from `.env.example`

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Deploy to Netlify

1. **Install Netlify CLI** (if not already installed):
   ```bash
   npm install -g netlify-cli
   ```

2. **Create `netlify.toml`** in project root:
   ```toml
   [build]
     functions = "api"

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

3. **Install dependencies**:
   ```bash
   npm install @sendgrid/mail
   ```

4. **Add environment variables** in Netlify dashboard:
   - Go to Site settings → Build & deploy → Environment
   - Add all required variables from `.env.example`

5. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

## Testing

### Test with cURL

Test the API endpoint directly:

```bash
# Valid submission
curl -i -X POST https://your-domain.com/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "_replyto": "test@example.com",
    "message": "This is a test message"
  }'

# Expected response (200 OK):
# {"success":true,"message":"Your message has been sent successfully"}
```

### Test honeypot (should succeed but not send email):

```bash
curl -i -X POST https://your-domain.com/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Bot",
    "_replyto": "bot@example.com",
    "message": "Spam",
    "website": "http://spam.com"
  }'

# Expected response (200 OK):
# {"success":true,"message":"Message received"}
```

### Test validation errors:

```bash
# Missing required field
curl -i -X POST https://your-domain.com/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User"
  }'

# Expected response (400 Bad Request):
# {"error":"Missing required fields","details":"Name, email, and message are required"}

# Invalid email format
curl -i -X POST https://your-domain.com/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "_replyto": "invalid-email",
    "message": "Test"
  }'

# Expected response (400 Bad Request):
# {"error":"Invalid email format","details":"Please provide a valid email address"}
```

### Test rate limiting:

```bash
# Send 6 requests rapidly (exceeds default limit of 5)
for i in {1..6}; do
  curl -i -X POST https://your-domain.com/api/contact \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"Test $i\",\"_replyto\":\"test@example.com\",\"message\":\"Test message $i\"}"
done

# 6th request should return (429 Too Many Requests):
# {"error":"Too many requests","details":"Please try again later"}
```

### Test in Browser

1. Navigate to `https://your-domain.com/contact.html`
2. Fill out the form with valid data
3. Submit the form
4. Verify:
   - Success message appears
   - Form redirects to `/thank-you.html`
   - Email is received at `CONTACT_TO` address
   - Reply-to is set to the submitted email

5. Test fallback:
   - Temporarily break the API (e.g., remove `SENDGRID_API_KEY`)
   - Submit form again
   - Verify mailto fallback opens

## reCAPTCHA v3 Setup

1. **Get reCAPTCHA keys**:
   - Visit https://www.google.com/recaptcha/admin
   - Register your site for reCAPTCHA v3
   - Copy Site Key and Secret Key

2. **Configure client**:
   - In `contact.html`, replace `YOUR_RECAPTCHA_SITE_KEY` with your Site Key
   - Uncomment the reCAPTCHA script tag at the bottom

3. **Configure server**:
   - Add `RECAPTCHA_SECRET` environment variable with your Secret Key

4. **Test**:
   - Submit form normally
   - Check server logs for reCAPTCHA verification results

## SendGrid Setup & Deliverability

### Initial Setup

1. **Create SendGrid account**: https://signup.sendgrid.com/
2. **Create API key**:
   - Go to Settings → API Keys
   - Create new API key with "Mail Send" permissions
   - Copy key and add to `SENDGRID_API_KEY`

3. **Verify sender**:
   - Go to Settings → Sender Authentication
   - Verify single sender OR authenticate domain
   - Use verified email in `SENDGRID_FROM`

### Improve Deliverability

For production use, configure SPF and DKIM:

1. **Domain Authentication**:
   - Go to Settings → Sender Authentication → Authenticate Your Domain
   - Follow instructions to add DNS records
   - This adds SPF and DKIM records to your domain

2. **SPF Record** (if not using domain authentication):
   ```
   v=spf1 include:sendgrid.net ~all
   ```

3. **DKIM** is automatically handled by SendGrid domain authentication

4. **Monitor reputation**:
   - Check SendGrid dashboard for bounces/spam reports
   - Maintain list hygiene
   - Use double opt-in for mailing lists (if applicable)

### Troubleshooting SendGrid

Check logs for detailed error messages:

```bash
# Vercel logs
vercel logs

# Netlify logs
netlify logs:function contact
```

Common issues:
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Sender not verified
- **400 Bad Request**: Check email format/content
- Emails going to spam: Set up domain authentication

## Upstash Redis Rate Limiting

For production-grade persistent rate limiting across serverless instances:

1. **Create Upstash account**: https://console.upstash.com/

2. **Create Redis database**:
   - Select a region close to your deployment
   - Copy REST URL and Token

3. **Install Upstash Redis**:
   ```bash
   npm install @upstash/redis
   ```

4. **Configure environment**:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
   ```

5. **Update `api/contact.js`**:
   - Uncomment the Upstash Redis code section
   - Replace `checkRateLimit()` calls with `checkRateLimitRedis()`

6. **Deploy and test** as normal

## File Structure

```
├── api/
│   └── contact.js          # Serverless function handler
├── assets/
│   └── contact-submit.js   # Client-side form handler
├── contact.html            # Contact form page
├── thank-you.html          # Success page
├── .env.example            # Environment variables template
└── README-contact-serverless.md  # This file
```

## Security Features

1. **Honeypot**: Hidden field catches bots
2. **Rate Limiting**: Prevents abuse (per-IP)
3. **Email Validation**: Client and server-side
4. **reCAPTCHA v3**: Optional bot detection
5. **CORS Headers**: Configured for your domain
6. **Input Sanitization**: All inputs validated

## Accessibility

- ARIA attributes for status messages (`role="status"`, `aria-live`)
- Keyboard navigation support
- Clear error messages
- Required field indicators
- Focus management

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for `fetch` if needed)

## Maintenance

- Monitor SendGrid usage and billing
- Check rate limiting effectiveness
- Review spam/honeypot catches
- Update dependencies regularly:
  ```bash
  npm update @sendgrid/mail
  ```

## Support

For issues or questions:
- Check SendGrid status: https://status.sendgrid.com/
- Review Vercel logs: `vercel logs`
- Test locally with `vercel dev`

## License

Proprietary - GoE Technologies
