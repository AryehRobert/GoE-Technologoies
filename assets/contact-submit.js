/**
 * Client-side Contact Form Handler
 * 
 * This script intercepts contact form submissions, performs client-side validation,
 * optionally executes reCAPTCHA v3, submits via AJAX to /api/contact,
 * and handles success/failure with redirect or mailto fallback.
 * 
 * Usage:
 * 1. Add class="contact-form" to your form element
 * 2. Add data-recaptcha-site-key attribute to form for reCAPTCHA v3 (optional)
 * 3. Add data-mailto attribute to form for mailto fallback (optional)
 * 4. Add hidden input name="_next" for success redirect URL (optional)
 * 5. Include this script: <script src="/assets/contact-submit.js"></script>
 * 6. Load reCAPTCHA if needed: <script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>
 */

(function() {
  'use strict';

  /**
   * Show status message to user with accessibility attributes
   */
  function showStatus(form, message, isError) {
    let statusDiv = form.querySelector('.form-status');
    
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.className = 'form-status';
      statusDiv.setAttribute('role', 'status');
      statusDiv.setAttribute('aria-live', 'polite');
      form.insertBefore(statusDiv, form.firstChild);
    }

    statusDiv.textContent = message;
    statusDiv.className = 'form-status ' + (isError ? 'status-error' : 'status-success');
    statusDiv.style.padding = '10px';
    statusDiv.style.marginBottom = '15px';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.border = '1px solid';
    
    if (isError) {
      statusDiv.style.backgroundColor = '#fee';
      statusDiv.style.borderColor = '#c33';
      statusDiv.style.color = '#c33';
      statusDiv.setAttribute('aria-live', 'assertive');
    } else {
      statusDiv.style.backgroundColor = '#efe';
      statusDiv.style.borderColor = '#3c3';
      statusDiv.style.color = '#3c3';
      statusDiv.setAttribute('aria-live', 'polite');
    }
  }

  /**
   * Clear status message
   */
  function clearStatus(form) {
    const statusDiv = form.querySelector('.form-status');
    if (statusDiv) {
      statusDiv.remove();
    }
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Basic client-side validation
   */
  function validateForm(formData) {
    const name = formData.get('name');
    const email = formData.get('_replyto');
    const message = formData.get('message');

    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Please enter your name' };
    }

    if (!email || email.trim().length === 0) {
      return { valid: false, error: 'Please enter your email address' };
    }

    if (!isValidEmail(email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    if (!message || message.trim().length === 0) {
      return { valid: false, error: 'Please enter a message' };
    }

    if (message.trim().length < 10) {
      return { valid: false, error: 'Message must be at least 10 characters' };
    }

    return { valid: true };
  }

  /**
   * Execute reCAPTCHA v3 and get token
   */
  function executeRecaptcha(siteKey) {
    return new Promise((resolve, reject) => {
      if (typeof grecaptcha === 'undefined') {
        console.warn('reCAPTCHA not loaded');
        resolve(null);
        return;
      }

      grecaptcha.ready(function() {
        grecaptcha.execute(siteKey, { action: 'submit_contact' })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Open mailto fallback
   */
  function openMailtoFallback(form, formData) {
    const mailto = form.getAttribute('data-mailto');
    
    if (!mailto) {
      showStatus(form, 'Unable to submit form. Please try again later.', true);
      return;
    }

    const name = formData.get('name') || '';
    const email = formData.get('_replyto') || '';
    const message = formData.get('message') || '';

    const subject = encodeURIComponent(`Contact from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    const mailtoUrl = `mailto:${mailto}?subject=${subject}&body=${body}`;

    console.log('Opening mailto fallback');
    showStatus(form, 'Opening your email client...', false);
    
    window.location.href = mailtoUrl;
  }

  /**
   * Submit form via AJAX
   */
  async function submitForm(form, formData, recaptchaToken) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';

    try {
      // Disable submit button and show loading state
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      clearStatus(form);

      // Prepare request data
      const requestData = {
        name: formData.get('name'),
        _replyto: formData.get('_replyto'),
        message: formData.get('message'),
        website: formData.get('website') || '', // honeypot
      };

      if (recaptchaToken) {
        requestData['g-recaptcha-response'] = recaptchaToken;
      }

      console.log('Submitting form to /api/contact');

      // Submit to serverless function
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Form submitted successfully');
        showStatus(form, result.message || 'Message sent successfully!', false);

        // Reset form
        form.reset();

        // Redirect if _next field exists
        const nextUrl = formData.get('_next') || form.getAttribute('data-next');
        if (nextUrl) {
          setTimeout(() => {
            window.location.href = nextUrl;
          }, 1500);
        }
      } else {
        // Server returned an error
        console.error('Server error:', result);
        const errorMessage = result.details || result.error || 'Failed to send message';
        showStatus(form, errorMessage, true);

        // Offer mailto fallback after a delay
        setTimeout(() => {
          if (form.hasAttribute('data-mailto')) {
            const fallbackMessage = document.createElement('p');
            fallbackMessage.style.marginTop = '10px';
            fallbackMessage.innerHTML = 'Having trouble? <a href="#" class="mailto-fallback">Click here to email us directly</a>';
            
            const statusDiv = form.querySelector('.form-status');
            if (statusDiv) {
              statusDiv.appendChild(fallbackMessage);
              
              const fallbackLink = fallbackMessage.querySelector('.mailto-fallback');
              fallbackLink.addEventListener('click', function(e) {
                e.preventDefault();
                openMailtoFallback(form, formData);
              });
            }
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Network error:', error);
      showStatus(form, 'Network error. Please check your connection and try again.', true);
      
      // Automatic fallback to mailto on network error
      if (form.hasAttribute('data-mailto')) {
        setTimeout(() => {
          openMailtoFallback(form, formData);
        }, 2000);
      }
    } finally {
      // Re-enable submit button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Client-side validation
    const validation = validateForm(formData);
    if (!validation.valid) {
      showStatus(form, validation.error, true);
      return;
    }

    // Execute reCAPTCHA if configured
    let recaptchaToken = null;
    const siteKey = form.getAttribute('data-recaptcha-site-key');
    
    if (siteKey && siteKey !== 'YOUR_RECAPTCHA_SITE_KEY') {
      try {
        console.log('Executing reCAPTCHA...');
        recaptchaToken = await executeRecaptcha(siteKey);
        console.log('reCAPTCHA token obtained');
      } catch (error) {
        console.error('reCAPTCHA error:', error);
        showStatus(form, 'reCAPTCHA verification failed. Please try again.', true);
        return;
      }
    }

    // Submit form
    await submitForm(form, formData, recaptchaToken);
  }

  /**
   * Initialize contact form handler
   */
  function init() {
    const forms = document.querySelectorAll('.contact-form');

    if (forms.length === 0) {
      console.warn('No contact forms found with class "contact-form"');
      return;
    }

    forms.forEach(function(form) {
      console.log('Initializing contact form handler');
      form.addEventListener('submit', handleSubmit);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
