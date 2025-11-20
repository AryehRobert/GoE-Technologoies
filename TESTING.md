# Testing Guide for Serverless Contact Form

This document provides step-by-step testing instructions for the serverless contact form implementation.

## Prerequisites

Before testing, ensure you have:
1. Deployed the site to Vercel or Netlify
2. Configured environment variables (see .env.example)
3. Verified your SendGrid sender email/domain
4. (Optional) Set up reCAPTCHA v3 keys

## Local Testing (Optional)

For local testing with Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Set up local environment variables
cp .env.example .env
# Edit .env with your actual values

# Run local development server
vercel dev
```

The site will be available at http://localhost:3000

## Testing Checklist

### 1. Environment Variable Configuration

Verify all required environment variables are set in your deployment platform:

- [ ] `SENDGRID_API_KEY` - Your SendGrid API key
- [ ] `SENDGRID_FROM` - Verified sender email
- [ ] `CONTACT_TO` - Recipient email address
- [ ] `RECAPTCHA_SECRET` - (Optional) reCAPTCHA secret key
- [ ] `RATE_LIMIT_MAX` - (Optional) Default: 5
- [ ] `RATE_LIMIT_WINDOW_MIN` - (Optional) Default: 60

### 2. API Endpoint Tests

Use curl to test the `/api/contact` endpoint:

#### Test 1: Valid Submission

```bash
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "_replyto": "test@example.com",
    "service": "web-development",
    "message": "This is a test message from curl"
  }'
```

**Expected Result:**
- HTTP 200 status
- Response: `{"ok":true}`
- Email received at `CONTACT_TO` address

#### Test 2: Missing Required Field (Name)

```bash
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "_replyto": "test@example.com",
    "message": "Missing name field"
  }'
```

**Expected Result:**
- HTTP 400 status
- Response: `{"ok":false,"error":"Name is required"}`

#### Test 3: Missing Required Field (Email)

```bash
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "message": "Missing email field"
  }'
```

**Expected Result:**
- HTTP 400 status
- Response: `{"ok":false,"error":"Email is required"}`

#### Test 4: Invalid Email Format

```bash
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "_replyto": "not-a-valid-email",
    "message": "Testing invalid email"
  }'
```

**Expected Result:**
- HTTP 400 status
- Response: `{"ok":false,"error":"Invalid email format"}`

#### Test 5: Honeypot Triggered (Spam Detection)

```bash
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Bot",
    "_replyto": "bot@spam.com",
    "website": "http://spam-site.com",
    "message": "Spam message"
  }'
```

**Expected Result:**
- HTTP 400 status
- Response: `{"ok":false,"error":"Invalid submission"}`

#### Test 6: Rate Limiting

Send multiple requests rapidly from the same IP:

```bash
for i in {1..10}; do
  echo "Request $i:"
  curl -i -X POST https://your-site.vercel.app/api/contact \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"Test $i\",\"_replyto\":\"test@example.com\",\"message\":\"Rate limit test $i\"}"
  echo ""
done
```

**Expected Result:**
- First 5 requests: HTTP 200 (or configured `RATE_LIMIT_MAX`)
- Subsequent requests: HTTP 429
- Response: `{"ok":false,"error":"Too many requests. Please try again later."}`

### 3. Browser Form Tests

#### Test 1: Successful Form Submission

1. Navigate to `https://your-site.vercel.app/contact.html`
2. Fill in all required fields:
   - Name: "John Doe"
   - Email: "john.doe@example.com"
   - Service: Select any option
   - Message: "This is a test message"
3. Click "Send Message"

**Expected Result:**
- Button shows "Sending..." during submission
- Success message appears: "Thank you! Your message has been sent successfully."
- After ~1.5 seconds, redirect to `/thank-you.html`
- Email received at `CONTACT_TO` address

#### Test 2: Client-Side Validation - Empty Name

1. Navigate to contact form
2. Leave "Name" field empty
3. Fill in email and message
4. Click "Send Message"

**Expected Result:**
- Error message: "Please enter your name."
- Form not submitted to server
- No redirect

#### Test 3: Client-Side Validation - Invalid Email

1. Navigate to contact form
2. Fill in name: "Test User"
3. Enter invalid email: "not-an-email"
4. Fill in message
5. Click "Send Message"

**Expected Result:**
- Error message: "Please enter a valid email address."
- Form not submitted to server

#### Test 4: reCAPTCHA Integration (if configured)

1. Ensure `data-recaptcha-site-key` in contact.html has your actual site key
2. Replace `YOUR_RECAPTCHA_SITE_KEY_HERE` in the script tag
3. Submit the form with valid data

**Expected Result:**
- reCAPTCHA badge visible in bottom-right corner
- reCAPTCHA verification happens automatically
- Form submits successfully if score >= 0.4
- Check browser console for any reCAPTCHA errors

#### Test 5: Mailto Fallback

To test the mailto fallback when API fails:

1. Temporarily break the API (e.g., invalid SendGrid key)
2. Submit the form
3. Wait for error message

**Expected Result:**
- Error message appears
- After ~2 seconds, mailto link opens in default email client
- Email is pre-filled with form data

### 4. Thank You Page Test

1. Navigate directly to `https://your-site.vercel.app/thank-you.html`

**Expected Result:**
- Page loads with success message
- Checkmark icon visible
- "Back to Home" button works
- "Email Us Directly" button opens mailto link

### 5. Accessibility Tests

#### Keyboard Navigation

1. Navigate to contact form
2. Use Tab key to move through form fields
3. Submit with Enter key

**Expected Result:**
- All fields are keyboard accessible
- Tab order is logical
- Form can be submitted with keyboard

#### Screen Reader

1. Use a screen reader (e.g., NVDA, JAWS, VoiceOver)
2. Navigate through the form

**Expected Result:**
- All labels are properly announced
- Required fields are indicated
- Status messages are announced (aria-live)
- Error messages are announced (role="alert")

### 6. SendGrid Delivery Test

After submitting a test form:

1. Log into SendGrid dashboard
2. Go to Activity Feed
3. Search for your test email

**Expected Result:**
- Email appears in Activity Feed
- Status: "Delivered" or "Processed"
- No bounces or spam reports

### 7. Error Handling Tests

#### Test 1: Invalid SendGrid API Key

1. Set `SENDGRID_API_KEY` to an invalid value
2. Submit form
3. Check serverless function logs

**Expected Result:**
- HTTP 500 response
- Error logged in function logs
- Client shows error message and mailto fallback

#### Test 2: Missing Environment Variable

1. Remove `CONTACT_TO` environment variable
2. Submit form

**Expected Result:**
- HTTP 500 response
- Error: "Server configuration error"
- Check function logs for "Missing SendGrid configuration"

## Production Testing Checklist

Before going live:

- [ ] All environment variables configured
- [ ] SendGrid domain authentication completed (SPF/DKIM)
- [ ] reCAPTCHA keys configured and working
- [ ] Rate limiting tested and appropriate limits set
- [ ] Successful form submission tested
- [ ] Email delivery confirmed
- [ ] Error handling verified
- [ ] Mailto fallback tested
- [ ] Thank you page working
- [ ] Accessibility tested
- [ ] Mobile responsive design tested
- [ ] HTTPS enabled
- [ ] Upstash Redis configured (for production scale)

## Monitoring

After deployment, monitor:

1. **Vercel/Netlify Logs** - Check for errors in serverless function
2. **SendGrid Activity Feed** - Monitor email delivery rates
3. **Rate Limit Triggers** - Watch for legitimate users being blocked
4. **Form Submission Volume** - Track usage patterns

## Troubleshooting

### Emails Not Sending

1. Check SendGrid API key is valid and has Mail Send permission
2. Verify `SENDGRID_FROM` email is verified in SendGrid
3. Check SendGrid Activity Feed for delivery status
4. Review serverless function logs for errors

### reCAPTCHA Not Working

1. Verify site key in contact.html matches reCAPTCHA console
2. Check secret key in environment variables
3. Ensure domain is registered in reCAPTCHA console
4. Check browser console for JavaScript errors

### Rate Limiting Issues

1. Review rate limit configuration (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MIN`)
2. For production, implement Upstash Redis rate limiting
3. Consider increasing limits for high-traffic sites

## Support

For issues or questions:
- Review README-contact-serverless.md for detailed setup instructions
- Check serverless function logs for errors
- Email: robertaryehceo@goetechnologies.org
