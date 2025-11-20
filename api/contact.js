// api/contact.js
// Vercel-compatible serverless function for handling contact form submissions

// In-memory rate limiter (simple best-effort implementation)
const rateLimits = new Map();

// Optional: Upstash Redis rate limiter (commented out by default)
// Uncomment and configure for production use:
/*
const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
*/

/**
 * Simple email format validation
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * In-memory rate limiter
 * Uses IP address as key and tracks request timestamps
 */
function checkRateLimit(identifier, maxRequests, windowMinutes) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  
  if (!rateLimits.has(identifier)) {
    rateLimits.set(identifier, []);
  }
  
  const timestamps = rateLimits.get(identifier);
  
  // Remove timestamps outside the current window
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (validTimestamps.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Add current timestamp
  validTimestamps.push(now);
  rateLimits.set(identifier, validTimestamps);
  
  return true;
}

/**
 * Verify reCAPTCHA v3 token
 */
async function verifyRecaptcha(token, secret) {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secret}&response=${token}`,
    });
    
    const data = await response.json();
    console.log('reCAPTCHA verification response:', JSON.stringify(data));
    
    // Check if verification was successful and score is adequate (>= 0.4)
    if (!data.success) {
      return { valid: false, reason: 'reCAPTCHA verification failed' };
    }
    
    // If score is present, check it (v3 provides score between 0.0 and 1.0)
    if (data.score !== undefined && data.score < 0.4) {
      return { valid: false, reason: `reCAPTCHA score too low: ${data.score}` };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { valid: false, reason: 'reCAPTCHA verification error' };
  }
}

/**
 * Send email via SendGrid
 */
async function sendEmail(apiKey, from, to, subject, content) {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
          subject: subject,
        }],
        from: { email: from },
        content: [{
          type: 'text/plain',
          value: content,
        }],
      }),
    });
    
    console.log('SendGrid response status:', response.status);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('SendGrid error response:', errorBody);
      return { success: false, status: response.status, error: errorBody };
    }
    
    return { success: true, status: response.status };
  } catch (error) {
    console.error('SendGrid send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main handler function
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  
  try {
    const body = req.body;
    
    // Extract form fields
    const name = body.name || '';
    const replyto = body._replyto || body.email || '';
    const service = body.service || '';
    const message = body.message || '';
    const website = body.website || ''; // Honeypot field
    const recaptchaToken = body.recaptchaToken || '';
    const nextUrl = body._next || '';
    
    // 1. Honeypot validation - must be empty
    if (website !== '') {
      console.log('Honeypot triggered');
      return res.status(400).json({ ok: false, error: 'Invalid submission' });
    }
    
    // 2. Required field validation
    if (!name.trim()) {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }
    
    if (!replyto.trim()) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }
    
    if (!message.trim()) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }
    
    // 3. Email format validation
    if (!isValidEmail(replyto)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }
    
    // 4. Optional reCAPTCHA verification
    const recaptchaSecret = process.env.RECAPTCHA_SECRET;
    if (recaptchaSecret && recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, recaptchaSecret);
      if (!recaptchaResult.valid) {
        console.log('reCAPTCHA validation failed:', recaptchaResult.reason);
        return res.status(400).json({ ok: false, error: 'reCAPTCHA verification failed' });
      }
    }
    
    // 5. Rate limiting (best-effort in-memory)
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
    const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '60', 10);
    
    // Use IP address for rate limiting (Vercel provides x-forwarded-for or x-real-ip)
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    if (!checkRateLimit(clientIp, maxRequests, windowMinutes)) {
      console.log('Rate limit exceeded for IP:', clientIp);
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
    }
    
    /* Optional: Upstash Redis rate limiter for production
    try {
      const key = `rate_limit:${clientIp}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowMinutes * 60);
      }
      if (current > maxRequests) {
        console.log('Rate limit exceeded for IP:', clientIp);
        return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
      }
    } catch (redisError) {
      console.error('Redis rate limit error:', redisError);
      // Continue with the request if Redis fails
    }
    */
    
    // 6. Send email via SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFrom = process.env.SENDGRID_FROM;
    const contactTo = process.env.CONTACT_TO;
    
    if (!sendgridApiKey || !sendgridFrom || !contactTo) {
      console.error('Missing SendGrid configuration');
      return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }
    
    // Build email subject and content
    const subject = `Contact Form Submission from ${name}`;
    const emailContent = `
New contact form submission:

Name: ${name}
Email: ${replyto}
Service: ${service || 'Not specified'}

Message:
${message}

---
This message was sent via the contact form.
Reply to: ${replyto}
    `.trim();
    
    const sendResult = await sendEmail(sendgridApiKey, sendgridFrom, contactTo, subject, emailContent);
    
    if (!sendResult.success) {
      console.error('Failed to send email:', sendResult.error);
      return res.status(500).json({ ok: false, error: 'Failed to send message. Please try again.' });
    }
    
    console.log('Email sent successfully');
    
    // 7. Return success response
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ ok: false, error: 'An unexpected error occurred' });
  }
};
