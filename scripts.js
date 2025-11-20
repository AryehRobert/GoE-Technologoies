// Small site JS: year insertion, simple form helper
document.addEventListener('DOMContentLoaded', function () {
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // If Formspree is not configured, show mailto fallback on submit
  var forms = document.querySelectorAll('form.contact-form');
  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      // If action is a placeholder, let it fall back to mailto
      var action = form.getAttribute('action') || '';
      if (action.indexOf('formspree.io/f/{your-id}') !== -1) {
        // Prevent default and open mail client as a fallback
        e.preventDefault();
        var name = form.querySelector('input[name="name"]').value || '';
        var company = form.querySelector('input[name="company"]').value || '';
        var email = form.querySelector('input[name="email"]').value || '';
        var service = form.querySelector('select[name="service"]').value || '';
        var message = form.querySelector('textarea[name="message"]').value || '';
        var body = encodeURIComponent(
          'Name: ' + name + '\nCompany: ' + company + '\nEmail: ' + email + '\nService: ' + service + '\n\n' + message
        );
        window.location.href = 'mailto:hello@goetech.com?subject=' + encodeURIComponent('GoE site inquiry') + '&body=' + body;
      }
    });
  });
});