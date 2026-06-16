document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => nav?.classList.toggle('open'));

  document.querySelectorAll('[data-toast-close]').forEach((button) => button.addEventListener('click', () => button.closest('[data-toast]')?.remove()));
  setTimeout(() => document.querySelectorAll('[data-toast]').forEach((toast) => toast.classList.add('toast-hide')), 5000);


  document.querySelectorAll('[data-captcha-refresh]').forEach((button) => {
    button.addEventListener('click', () => {
      const box = button.closest('[data-captcha-box]');
      const image = box?.querySelector('[data-captcha-image]');
      const input = box?.querySelector('input[name="captchaText"]');
      if (!image) return;
      const url = new URL(image.src, window.location.origin);
      url.searchParams.set('_', Date.now().toString());
      image.src = url.toString();
      if (input) { input.value = ''; input.focus(); }
    });
  });

  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = 'Tersalin'; setTimeout(() => { button.textContent = 'Salin'; }, 1500); }
    catch { button.textContent = 'Gagal'; }
  }));

  document.querySelectorAll('form').forEach((form) => form.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    const button = form.querySelector('[data-submit-lock]');
    if (button) { button.disabled = true; button.textContent = 'Memproses...'; }
  }));
});
