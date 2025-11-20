# GoE Technologies

A modern website with serverless contact form functionality powered by Vercel and SendGrid.

## Features

- **Serverless Contact Form**: Secure, scalable contact form using Vercel Functions
- **Email Delivery**: Reliable email sending via SendGrid API
- **Spam Protection**: 
  - Honeypot field for bot detection
  - Optional reCAPTCHA v3 integration
  - Rate limiting to prevent abuse
- **Client-side Validation**: Instant feedback for users
- **Graceful Fallbacks**: Falls back to mailto links if JavaScript fails
- **Responsive Design**: Works on all devices

## Setup

### Prerequisites

- Node.js (for local development)
- A Vercel account (for deployment)
- A SendGrid account with verified sender email
- (Optional) Google reCAPTCHA v3 site and secret keys

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AryehRobert/GoE-Technologoies.git
   cd GoE-Technologoies
   ```

2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

3. Configure your environment variables in `.env`:
   - `SENDGRID_API_KEY`: Your SendGrid API key (required)
   - `SENDGRID_FROM`: Verified sender email address (required)
   - `CONTACT_TO`: Email address to receive contact submissions (required)
   - `RECAPTCHA_SECRET`: Your reCAPTCHA v3 secret key (optional)
   - `RATE_LIMIT_MAX`: Maximum requests per window (default: 5)
   - `RATE_LIMIT_WINDOW_MIN`: Rate limit window in minutes (default: 60)

### SendGrid Setup

1. Create a SendGrid account at https://sendgrid.com
2. Verify your sender email address or domain
3. Create an API key with "Mail Send" permissions
4. Add the API key to your `.env` file

### reCAPTCHA Setup (Optional)

1. Register your site at https://www.google.com/recaptcha/admin
2. Choose reCAPTCHA v3
3. Add your domain(s)
4. Copy the site key and secret key
5. Add the secret key to your `.env` file
6. Uncomment the reCAPTCHA script section in `contact.html` and add your site key

### Deployment to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Add environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all required variables from `.env.example`

## Usage

### Contact Form

The contact form is available at `/contact.html`. Users can:
- Enter their name, email, and message
- Select a service they're interested in
- Submit the form to receive a confirmation

### API Endpoint

The contact form submits to `/api/contact` which:
- Validates all input fields
- Checks the honeypot field for spam
- Verifies reCAPTCHA token (if configured)
- Enforces rate limiting
- Sends email via SendGrid
- Returns JSON response

**Request Format:**
```json
{
  "name": "John Doe",
  "_replyto": "john@example.com",
  "service": "Web Development",
  "message": "I'm interested in your services",
  "website": "",
  "recaptchaToken": "token_here",
  "_next": "/thank-you.html"
}
```

**Success Response (200):**
```json
{
  "ok": true
}
```

**Error Response (4xx/5xx):**
```json
{
  "ok": false,
  "error": "Error message here"
}
```

### Rate Limiting

The API includes built-in rate limiting:
- Default: 5 requests per 60 minutes per email address
- Uses in-memory storage (suitable for single-instance deployments)
- For production with multiple instances, consider using Upstash Redis (see comments in `api/contact.js`)

### Security Features

1. **Honeypot Field**: Hidden `website` field catches bots
2. **Email Validation**: Server-side email format validation
3. **Rate Limiting**: Prevents spam and abuse
4. **reCAPTCHA v3**: Optional human verification with score threshold
5. **CORS Headers**: Configurable cross-origin access
6. **Input Sanitization**: All fields are validated and trimmed

## Development

### Local Testing

You can test the API locally using Vercel CLI:

```bash
vercel dev
```

This will start a local server at `http://localhost:3000` where you can test the contact form.

### File Structure

```
.
├── api/
│   └── contact.js          # Serverless function for contact form
├── assets/
│   └── contact-submit.js   # Client-side form handler
├── contact.html            # Contact form page
├── thank-you.html          # Success page
├── .env.example            # Environment variables template
└── README.md               # This file
```

## Troubleshooting

### Emails Not Sending

1. Check SendGrid API key is correct
2. Verify sender email in SendGrid dashboard
3. Check Vercel function logs for errors
4. Ensure environment variables are set in Vercel

### Rate Limiting Issues

1. Check rate limit configuration in environment variables
2. Consider using Upstash Redis for multi-instance deployments
3. Clear rate limit by restarting the function

### reCAPTCHA Failures

1. Verify site key matches your domain
2. Check secret key in environment variables
3. Ensure score threshold (0.4) is appropriate for your use case

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.