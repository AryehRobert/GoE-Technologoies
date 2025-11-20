// assets/contact-submit.js
// Client-side form handler for contact form submissions

(function() {
  'use strict';
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    const form = document.querySelector('.contact-form');
    if (!form) {
      console.warn('Contact form not found');
      return;
    }
    
    // Append status message element
    let statusEl = form.querySelector('.form-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.className = 'form-status';
      statusEl.setAttribute('aria-live', 'polite');
      form.appendChild(statusEl);
    }
    
    form.addEventListener('submit', handleSubmit);
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const statusEl = form.querySelector('.form-status');
    
    // Clear previous status
    statusEl.textContent = '';
    statusEl.removeAttribute('role');
    statusEl.className = 'form-status';
    
    // Get form data
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
      data[key] = value;
    });
    
    // Basic client-side validation
    const name = (data.name || '').trim();
    const email = (data._replyto || data.email || '').trim();
    const message = (data.message || '').trim();
    
    if (!name) {
      showError(statusEl, 'Please enter your name.');
      return;
    }
    
    if (!email) {
      showError(statusEl, 'Please enter your email address.');
      return;
    }
    
    if (!isValidEmail(email)) {
      showError(statusEl, 'Please enter a valid email address.');
      return;
    }
    
    if (!message) {
      showError(statusEl, 'Please enter a message.');
      return;
    }
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }
    
    try {
      // Optional reCAPTCHA v3 flow
      const recaptchaSiteKey = form.dataset.recaptchaSiteKey;
      if (recaptchaSiteKey && window.grecaptcha) {
        try {
          const token = await window.grecaptcha.execute(recaptchaSiteKey, { action: 'contact' });
          data.recaptchaToken = token;
        } catch (recaptchaError) {
          console.error('reCAPTCHA error:', recaptchaError);
          // Continue without reCAPTCHA token if it fails
        }
      }
      
      // Send POST request to serverless function
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok && result.ok) {
        // Success!
        showSuccess(statusEl, 'Thank you! Your message has been sent successfully.');
        
        // Handle redirect
        const nextUrl = data._next || form.dataset.next;
        if (nextUrl) {
          // Resolve to absolute URL relative to current site
          const absoluteUrl = new URL(nextUrl, window.location.origin).href;
          setTimeout(() => {
            window.location.href = absoluteUrl;
          }, 1500);
        } else {
          // Reset form
          form.reset();
        }
      } else {
        // Server returned an error
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      showError(statusEl, error.message || 'An error occurred. Please try again.');
      
      // Fallback: open mailto link
      setTimeout(() => {
        openMailtoFallback(form, data);
      }, 2000);
    } finally {
      // Restore button state
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  }
  
  function showError(statusEl, message) {
    statusEl.textContent = message;
    statusEl.className = 'form-status error';
    statusEl.setAttribute('role', 'alert');
  }
  
  function showSuccess(statusEl, message) {
    statusEl.textContent = message;
    statusEl.className = 'form-status success';
    statusEl.removeAttribute('role');
  }
  
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  function openMailtoFallback(form, data) {
    // Get mailto address from form dataset or existing mailto link
    let mailtoEmail = form.dataset.mailto;
    
    if (!mailtoEmail) {
      // Try to find mailto link in the form
      const mailtoLink = form.querySelector('a[href^="mailto:"]');
      if (mailtoLink) {
        const match = mailtoLink.href.match(/mailto:([^?]+)/);
        if (match) {
          mailtoEmail = match[1];
        }
      }
    }
    
    if (mailtoEmail) {
      // Build mailto URL with form contents
      const subject = encodeURIComponent(`Contact from ${data.name || 'Website Visitor'}`);
      const body = encodeURIComponent(
        `Name: ${data.name || ''}\n` +
        `Email: ${data._replyto || data.email || ''}\n` +
        `Service: ${data.service || ''}\n\n` +
        `Message:\n${data.message || ''}`
      );
      
      const mailtoUrl = `mailto:${mailtoEmail}?subject=${subject}&body=${body}`;
      
      console.log('Opening mailto fallback');
      window.location.href = mailtoUrl;
    }
  }
})();
