# Serverless Contact Form Setup Guide

This guide explains how to deploy and configure the serverless contact form endpoint for GoE Technologies.

## Overview

The contact form solution consists of:
- **Serverless API endpoint** (`api/contact.js`) - Handles form submissions, validation, spam protection, and email delivery
- **Client-side handler** (`assets/contact-submit.js`) - Manages form submission, validation, and user feedback
- **Contact page** (`contact.html`) - The main contact form interface
- **Thank you page** (`thank-you.html`) - Shown after successful submission

## Required Environment Variables

The following environment variables must be configured in your hosting platform (Vercel, Netlify, etc.):

### SendGrid Configuration (Required)

```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM=noreply@yourdomain.com
CONTACT_TO=contact@yourdomain.com
```

**Setup Steps:**
1. Create a free SendGrid account at https://signup.sendgrid.com/
2. Generate an API key at https://app.sendgrid.com/settings/api_keys
   - Click "Create API Key"
   - Choose "Restricted Access"
   - Grant "Mail Send" permission only
3. Verify your sender email or domain at https://app.sendgrid.com/settings/sender_auth
   - For production, verify your domain (recommended)
   - For testing, you can use Single Sender Verification

### reCAPTCHA v3 (Optional but Recommended)

```bash
RECAPTCHA_SECRET=your_secret_key_here
```

**Setup Steps:**
1. Register your site at https://www.google.com/recaptcha/admin
2. Choose reCAPTCHA v3
3. Add your domain(s)
4. Copy the secret key to `RECAPTCHA_SECRET`
5. Update `contact.html` with your site key (replace `YOUR_RECAPTCHA_SITE_KEY_HERE` in two places)

### Rate Limiting (Optional)

```bash
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_MIN=60
```

These settings limit each IP address to 5 requests per 60 minutes. The default implementation uses in-memory storage (suitable for light traffic). For production with multiple serverless instances, see the Upstash Redis section below.

## Deployment Instructions

### Deploying to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy the project**:
   ```bash
   cd /path/to/your/project
   vercel
   ```

3. **Configure environment variables**:
   - Go to your project dashboard at https://vercel.com/dashboard
   - Navigate to Settings → Environment Variables
   - Add each required variable (SENDGRID_API_KEY, SENDGRID_FROM, CONTACT_TO, etc.)
   - Redeploy after adding variables:
     ```bash
     vercel --prod
     ```

### Deploying to Netlify

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy the project**:
   ```bash
   cd /path/to/your/project
   netlify deploy
   ```

3. **Configure environment variables**:
   - Go to your site settings at https://app.netlify.com
   - Navigate to Site settings → Environment variables
   - Add each required variable
   - Redeploy:
     ```bash
     netlify deploy --prod
     ```

4. **Create `netlify.toml`** (if needed):
   ```toml
   [build]
     publish = "."
   
   [functions]
     directory = "api"
   ```

## Testing the Endpoint

### Using curl

Test the contact endpoint with curl:

```bash
# Success case
curl -i -X POST https://your-site.vercel.app/api/contact \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "_replyto": "test@example.com",
    "message": "This is a test message"
  }'

# Expected response: HTTP 200
# {"ok":true}
```

### Test Cases

1. **Valid submission**:
   ```bash
   curl -X POST https://your-site.vercel.app/api/contact \
     -H 'Content-Type: application/json' \
     -d '{"name":"John Doe","_replyto":"john@example.com","message":"Hello!"}'
   ```

2. **Missing required field**:
   ```bash
   curl -X POST https://your-site.vercel.app/api/contact \
     -H 'Content-Type: application/json' \
     -d '{"name":"John Doe","message":"Hello!"}'
   ```
   Expected: HTTP 400 - "Email is required"

3. **Invalid email format**:
   ```bash
   curl -X POST https://your-site.vercel.app/api/contact \
     -H 'Content-Type: application/json' \
     -d '{"name":"John","_replyto":"invalid-email","message":"Hi"}'
   ```
   Expected: HTTP 400 - "Invalid email format"

4. **Honeypot triggered**:
   ```bash
   curl -X POST https://your-site.vercel.app/api/contact \
     -H 'Content-Type: application/json' \
     -d '{"name":"Bot","_replyto":"bot@example.com","website":"http://spam.com","message":"Spam"}'
   ```
   Expected: HTTP 400 - "Invalid submission"

### Browser Testing

1. Navigate to `https://your-site.vercel.app/contact.html`
2. Fill out the form with valid information
3. Submit the form
4. You should be redirected to `/thank-you.html`
5. Check the email inbox at `CONTACT_TO` for the message

## SendGrid Deliverability Best Practices

To ensure your emails are delivered successfully:

### 1. Domain Authentication (Highly Recommended)

Configure SPF and DKIM records for your domain:

1. Go to SendGrid Settings → Sender Authentication
2. Click "Authenticate Your Domain"
3. Follow the wizard to add DNS records to your domain
4. Verify the records

**Example DNS records:**
```
Type: TXT
Host: @
Value: v=spf1 include:sendgrid.net ~all

Type: CNAME
Host: s1._domainkey
Value: s1.domainkey.u12345678.wl123.sendgrid.net

Type: CNAME
Host: s2._domainkey
Value: s2.domainkey.u12345678.wl123.sendgrid.net
```

### 2. Monitor Deliverability

- Check SendGrid's Activity Feed for delivery status
- Watch for bounces and spam reports
- Keep your sender reputation high

### 3. Email Content Tips

- Use a clear subject line
- Avoid spam trigger words
- Include proper unsubscribe links (if sending marketing emails)
- Keep HTML and text content balanced

## Upstash Redis for Production Rate Limiting

The in-memory rate limiter works for single-instance deployments, but for production with auto-scaling, use Upstash Redis for distributed rate limiting.

### Setup Steps

1. **Create Upstash Redis database**:
   - Sign up at https://console.upstash.com/
   - Create a new Redis database
   - Copy the REST URL and token

2. **Add environment variables**:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

3. **Install Upstash Redis SDK**:
   ```bash
   npm install @upstash/redis
   ```

4. **Uncomment Upstash code in `api/contact.js`**:
   - Uncomment the `require('@upstash/redis')` line at the top
   - Uncomment the Upstash rate limiting block (marked with comments)

## Security Checklist

Before going to production, ensure:

- [ ] Environment variables are configured (not in code)
- [ ] SendGrid API key has minimal permissions (Mail Send only)
- [ ] Domain authentication (SPF/DKIM) is configured
- [ ] reCAPTCHA v3 is enabled with your site key
- [ ] Rate limiting is properly configured
- [ ] Honeypot field is in place and hidden
- [ ] HTTPS is enabled on your domain
- [ ] CORS is configured if needed
- [ ] Email validation is working
- [ ] Error messages don't expose sensitive information
- [ ] Consider adding CSRF protection for additional security

## Troubleshooting

### Email Not Sending

1. **Check SendGrid API key**:
   - Verify the key is correct and has Mail Send permission
   - Check the API key hasn't expired

2. **Check sender verification**:
   - Ensure `SENDGRID_FROM` is verified in SendGrid
   - Check SendGrid Activity Feed for errors

3. **Check logs**:
   - Vercel: View function logs in the dashboard
   - Netlify: Check function logs in the dashboard
   - Look for SendGrid error responses

### reCAPTCHA Not Working

1. Verify the site key is correct in `contact.html`
2. Check that the secret key matches in environment variables
3. Ensure the domain is registered in reCAPTCHA console
4. Check browser console for JavaScript errors

### Rate Limiting Issues

1. For single IP getting blocked, increase `RATE_LIMIT_MAX`
2. For production, implement Upstash Redis
3. Check logs to see rate limit triggers

### Form Not Submitting

1. Check browser console for JavaScript errors
2. Verify `/api/contact` endpoint is accessible
3. Check network tab for failed requests
4. Ensure `contact-submit.js` is loaded correctly

## Monitoring and Maintenance

### What to Monitor

1. **Email delivery rate** - Check SendGrid dashboard
2. **API error rate** - Monitor serverless function logs
3. **Rate limit triggers** - Watch for legitimate users being blocked
4. **Spam submissions** - Track honeypot and reCAPTCHA rejections

### Regular Maintenance

1. Review and update rate limit thresholds
2. Check for spam patterns and adjust reCAPTCHA score threshold
3. Monitor SendGrid sender reputation
4. Keep dependencies updated
5. Review and rotate API keys periodically

## Migration Notes

This implementation replaces the previous Formspree integration with a self-hosted serverless solution, providing:

- Full control over email content and formatting
- Better spam protection with multiple layers
- Custom validation logic
- No third-party service dependencies (except SendGrid for delivery)
- Integrated rate limiting
- Graceful fallback to mailto links

The mailto fallback ensures that even if the serverless function fails, users can still contact you via their email client.

## Support

For issues or questions:
- Email: robertaryehceo@goetechnologies.org
- GitHub Issues: [Your Repository URL]

## License

[Your License Here]
