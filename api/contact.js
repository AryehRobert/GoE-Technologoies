// Vercel-compatible serverless function for handling contact form submissions
// Exposed at /api/contact

// In-memory rate limiter (for best-effort rate limiting)
// For production, consider using Upstash Redis or similar
const rateLimitStore = new Map();

// Default configuration
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MIN = parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '60', 10);

/**
 * Rate limiter using in-memory storage
 * For production, consider using Upstash Redis:
 * 
 * import { Ratelimit } from "@upstash/ratelimit";
 * import { Redis } from "@upstash/redis";
 * 
 * const redis = Redis.fromEnv();
 * const ratelimit = new Ratelimit({
 *   redis,
 *   limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, `${RATE_LIMIT_WINDOW_MIN} m`),
 * });
 * 
 * Then in handler:
 * const { success } = await ratelimit.limit(identifier);
 * if (!success) return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MIN * 60 * 1000;
  
  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }
  
  const requests = rateLimitStore.get(identifier);
  // Clean old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitStore.set(identifier, validRequests);
  
  return true;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Verify reCAPTCHA v3 token with Google
 */
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    return { success: true }; // Skip if not configured
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
    
    // Check success and score threshold (0.4 minimum)
    if (data.success && data.score >= 0.4) {
      return { success: true, score: data.score };
    }
    
    return { success: false, score: data.score, errors: data['error-codes'] };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email via SendGrid
 */
async function sendEmail(formData) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;
  const to = process.env.CONTACT_TO;
  
  if (!apiKey || !from || !to) {
    throw new Error('SendGrid configuration missing');
  }
  
  const emailBody = `
New contact form submission:

Name: ${formData.name}
Email: ${formData._replyto || formData.email}
Service: ${formData.service || 'N/A'}
Message:
${formData.message}
`.trim();
  
  const payload = {
    personalizations: [{
      to: [{ email: to }],
    }],
    from: { email: from },
    reply_to: { email: formData._replyto || formData.email },
    subject: `Contact Form: ${formData.service || 'General Inquiry'}`,
    content: [{
      type: 'text/plain',
      value: emailBody,
    }],
  };
  
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Log response for debugging
    console.log('SendGrid response status:', response.status);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('SendGrid error body:', errorBody);
      throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid send error:', error);
    throw error;
  }
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  
  try {
    const body = req.body;
    
    // Honeypot validation - website field must be empty
    if (body.website && body.website.trim() !== '') {
      return res.status(400).json({ ok: false, error: 'Spam detected' });
    }
    
    // Required field validation
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }
    
    const email = body._replyto || body.email;
    if (!email || !email.trim()) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }
    
    if (!body.message || !body.message.trim()) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }
    
    // Email format validation
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }
    
    // Rate limiting (use email as identifier)
    const identifier = email.toLowerCase();
    if (!checkRateLimit(identifier)) {
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded. Please try again later.' });
    }
    
    // reCAPTCHA verification (if token provided and secret configured)
    if (body.recaptchaToken && process.env.RECAPTCHA_SECRET) {
      const recaptchaResult = await verifyRecaptcha(body.recaptchaToken);
      if (!recaptchaResult.success) {
        console.log('reCAPTCHA verification failed:', recaptchaResult);
        return res.status(400).json({ ok: false, error: 'reCAPTCHA verification failed' });
      }
    }
    
    // Send email
    await sendEmail({
      name: body.name.trim(),
      _replyto: email.trim(),
      email: email.trim(),
      service: body.service ? body.service.trim() : '',
      message: body.message.trim(),
    });
    
    // Success response
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again later.' });
  }
}
