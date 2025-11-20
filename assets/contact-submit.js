// Client-side contact form handler
// Intercepts form.contact-form submit and sends via AJAX

(function() {
  'use strict';
  
  /**
   * Validate email format
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Show form status message
   */
  function showStatus(form, message, isError) {
    // Remove existing status
    const existingStatus = form.querySelector('.form-status');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // Create new status element
    const statusEl = document.createElement('div');
    statusEl.className = 'form-status';
    statusEl.textContent = message;
    
    if (isError) {
      statusEl.setAttribute('role', 'alert');
      statusEl.style.color = 'red';
    } else {
      statusEl.style.color = 'green';
    }
    
    // Insert at the beginning of the form
    form.insertBefore(statusEl, form.firstChild);
  }
  
  /**
   * Get absolute URL from relative or absolute path
   */
  function getAbsoluteUrl(url) {
    if (!url) return null;
    
    // If already absolute, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Make relative URL absolute
    const a = document.createElement('a');
    a.href = url;
    return a.href;
  }
  
  /**
   * Fallback to mailto link
   */
  function fallbackToMailto(form) {
    const mailto = form.dataset.mailto || document.querySelector('a[href^="mailto:"]');
    
    if (mailto) {
      const mailtoHref = typeof mailto === 'string' ? mailto : mailto.href;
      window.location.href = mailtoHref;
    }
  }
  
  /**
   * Handle form submission
   */
  async function handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    
    // Disable submit button
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent || submitButton.value;
      if (submitButton.tagName === 'BUTTON') {
        submitButton.textContent = 'Sending...';
      } else {
        submitButton.value = 'Sending...';
      }
    }
    
    try {
      // Get form data
      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      
      // Client-side validation
      if (!data.name || !data.name.trim()) {
        showStatus(form, 'Please enter your name', true);
        return;
      }
      
      const email = data._replyto || data.email;
      if (!email || !email.trim()) {
        showStatus(form, 'Please enter your email', true);
        return;
      }
      
      if (!isValidEmail(email)) {
        showStatus(form, 'Please enter a valid email address', true);
        return;
      }
      
      if (!data.message || !data.message.trim()) {
        showStatus(form, 'Please enter a message', true);
        return;
      }
      
      // Handle reCAPTCHA if configured
      const recaptchaSiteKey = form.dataset.recaptchaSiteKey;
      if (recaptchaSiteKey && typeof grecaptcha !== 'undefined') {
        try {
          const token = await grecaptcha.execute(recaptchaSiteKey, { action: 'contact' });
          data.recaptchaToken = token;
        } catch (error) {
          console.error('reCAPTCHA error:', error);
          showStatus(form, 'reCAPTCHA verification failed. Please try again.', true);
          return;
        }
      }
      
      // Send to API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok && result.ok) {
        // Success - check for redirect
        const nextUrl = data._next || form.dataset.next;
        
        if (nextUrl) {
          // Redirect to thank you page
          const absoluteUrl = getAbsoluteUrl(nextUrl);
          window.location.href = absoluteUrl;
        } else {
          // Show success message inline
          showStatus(form, 'Thank you! Your message has been sent successfully.', false);
          form.reset();
        }
      } else {
        // Error response
        const errorMessage = result.error || 'An error occurred. Please try again.';
        showStatus(form, errorMessage, true);
        
        // Fallback to mailto after a delay
        setTimeout(() => {
          fallbackToMailto(form);
        }, 3000);
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      showStatus(form, 'Network error. Please check your connection and try again.', true);
      
      // Fallback to mailto
      setTimeout(() => {
        fallbackToMailto(form);
      }, 3000);
      
    } finally {
      // Re-enable submit button
      if (submitButton) {
        submitButton.disabled = false;
        const originalText = submitButton.dataset.originalText;
        if (submitButton.tagName === 'BUTTON') {
          submitButton.textContent = originalText;
        } else {
          submitButton.value = originalText;
        }
      }
    }
  }
  
  /**
   * Initialize form handler
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    // Find all contact forms
    const forms = document.querySelectorAll('form.contact-form');
    
    forms.forEach(form => {
      form.addEventListener('submit', handleSubmit);
    });
  }
  
  // Initialize
  init();
})();
