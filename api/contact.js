/**
 * Vercel Serverless Contact Form Handler
 * 
 * This function receives contact form submissions, validates input,
 * applies rate limiting, and sends emails via SendGrid.
 * 
 * Required Environment Variables:
 * - SENDGRID_API_KEY: Your SendGrid API key
 * - SENDGRID_FROM: Verified sender email address
 * - CONTACT_TO: Recipient email address for contact submissions
 * 
 * Optional Environment Variables:
 * - RECAPTCHA_SECRET: Google reCAPTCHA v3 secret key
 * - RATE_LIMIT_MAX: Maximum requests per window (default: 5)
 * - RATE_LIMIT_WINDOW_MIN: Time window in minutes (default: 15)
 * 
 * For production rate limiting with Upstash Redis:
 * - UPSTASH_REDIS_REST_URL: Your Upstash Redis REST URL
 * - UPSTASH_REDIS_REST_TOKEN: Your Upstash Redis REST token
 */

const sgMail = require('@sendgrid/mail');

// In-memory rate limiter (resets on function cold start)
// For production, consider using Upstash Redis (see instructions below)
const rateLimitStore = new Map();

/**
 * Simple in-memory rate limiter
 * Note: This resets on serverless function cold starts
 * For persistent rate limiting, use Upstash Redis (see commented code below)
 */
function checkRateLimit(identifier) {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10);
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();

  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }

  const requests = rateLimitStore.get(identifier);
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
  
  return true;
}

/**
 * Upstash Redis Rate Limiter (uncomment to use)
 * 
 * Install: npm install @upstash/redis
 * 
 * Set environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 * 
 * Example usage:
 * 
 * const { Redis } = require('@upstash/redis');
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_REST_URL,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN,
 * });
 * 
 * async function checkRateLimitRedis(identifier) {
 *   const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
 *   const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10);
 *   const windowSeconds = windowMinutes * 60;
 *   const key = `ratelimit:${identifier}`;
 *   
 *   const count = await redis.incr(key);
 *   
 *   if (count === 1) {
 *     await redis.expire(key, windowSeconds);
 *   }
 *   
 *   return count <= maxRequests;
 * }
 */

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Verify reCAPTCHA v3 token
 */
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET;
  
  if (!secret) {
    console.log('reCAPTCHA verification skipped: RECAPTCHA_SECRET not configured');
    return true;
  }

  if (!token) {
    console.log('reCAPTCHA verification failed: No token provided');
    return false;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secret}&response=${token}`,
    });

    const data = await response.json();
    console.log('reCAPTCHA verification result:', {
      success: data.success,
      score: data.score,
      action: data.action,
    });

    // For reCAPTCHA v3, check score (0.0 - 1.0, higher is better)
    // Adjust threshold as needed (0.5 is typical)
    return data.success && (data.score >= 0.5);
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

/**
 * Main handler function
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log(`Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing contact form submission');
    
    const { name, _replyto, message, website, 'g-recaptcha-response': recaptchaToken } = req.body;

    // Honeypot check - if 'website' field is filled, it's likely a bot
    if (website) {
      console.log('Honeypot triggered - likely spam');
      // Return success to avoid revealing the honeypot
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    // Validate required fields
    if (!name || !_replyto || !message) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Name, email, and message are required'
      });
    }

    // Validate email format
    if (!isValidEmail(_replyto)) {
      console.log('Validation failed: Invalid email format');
      return res.status(400).json({ 
        error: 'Invalid email format',
        details: 'Please provide a valid email address'
      });
    }

    // Verify reCAPTCHA if configured
    if (process.env.RECAPTCHA_SECRET) {
      const recaptchaValid = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaValid) {
        console.log('reCAPTCHA verification failed');
        return res.status(400).json({ 
          error: 'reCAPTCHA verification failed',
          details: 'Please complete the reCAPTCHA challenge'
        });
      }
    }

    // Rate limiting
    const identifier = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    console.log(`Rate limit check for: ${identifier}`);
    
    if (!checkRateLimit(identifier)) {
      console.log('Rate limit exceeded');
      return res.status(429).json({ 
        error: 'Too many requests',
        details: 'Please try again later'
      });
    }

    // Configure SendGrid
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const sendGridFrom = process.env.SENDGRID_FROM;
    const contactTo = process.env.CONTACT_TO;

    if (!sendGridApiKey || !sendGridFrom || !contactTo) {
      console.error('SendGrid configuration missing:', {
        hasApiKey: !!sendGridApiKey,
        hasFrom: !!sendGridFrom,
        hasTo: !!contactTo,
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Email service is not properly configured'
      });
    }

    sgMail.setApiKey(sendGridApiKey);

    // Prepare email
    const emailData = {
      to: contactTo,
      from: sendGridFrom,
      replyTo: _replyto,
      subject: `Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${_replyto}\n\nMessage:\n${message}`,
      html: `
        <h2>Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${_replyto}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    };

    console.log('Sending email via SendGrid', {
      to: contactTo,
      from: sendGridFrom,
      replyTo: _replyto,
    });

    // Send email
    const [response] = await sgMail.send(emailData);
    
    console.log('SendGrid response:', {
      statusCode: response.statusCode,
      headers: response.headers,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('Email sent successfully');
      return res.status(200).json({ 
        success: true,
        message: 'Your message has been sent successfully'
      });
    } else {
      console.error('SendGrid returned non-success status:', response.statusCode);
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: 'Please try again or contact us directly'
      });
    }

  } catch (error) {
    console.error('Error processing contact form:', error);
    
    // Check if it's a SendGrid-specific error
    if (error.response) {
      console.error('SendGrid error details:', {
        statusCode: error.code,
        body: error.response?.body,
        headers: error.response?.headers,
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'An error occurred while processing your request'
    });
  }
};
