(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const csrfToken = $('meta[name="csrf-token"]')?.content || '';

  function toggleHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function setupPublicNav() {
    const button = $('[data-nav-toggle]');
    const nav = $('[data-nav]');
    const overlay = $('[data-nav-overlay]');
    const closeButton = $('[data-nav-close]');
    if (!button || !nav) return;

    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', String(open));
      toggleHidden(overlay, !open);
      if (open) nav.focus?.();
    };

    button.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    closeButton?.addEventListener('click', () => setOpen(false));
    overlay?.addEventListener('click', () => setOpen(false));
    $$('a', nav).forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupAdminNav() {
    const openButton = $('[data-admin-open]');
    const sidebar = $('[data-admin-sidebar]');
    const overlay = $('[data-admin-overlay]');
    const closeButton = $('[data-admin-close]');
    if (!openButton || !sidebar) return;

    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      document.body.classList.toggle('admin-sidebar-open', open);
      openButton.setAttribute('aria-expanded', String(open));
      toggleHidden(overlay, !open);
    };

    openButton.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    closeButton?.addEventListener('click', () => setOpen(false));
    overlay?.addEventListener('click', () => setOpen(false));
    $$('a', sidebar).forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupToasts() {
    $$('[data-toast]').forEach((toast) => {
      const close = () => {
        toast.classList.add('toast-hide');
        window.setTimeout(() => toast.remove(), 260);
      };
      $('[data-toast-close]', toast)?.addEventListener('click', close);
      window.setTimeout(close, 5200);
    });
  }

  function setupConfirmForms() {
    $$('form[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        const message = form.dataset.confirm || 'Lanjutkan tindakan ini?';
        if (!window.confirm(message)) event.preventDefault();
      });
    });
  }

  function setupSubmitLocks() {
    $$('form').forEach((form) => {
      form.addEventListener('submit', () => {
        $$('[data-submit-lock]', form).forEach((button) => {
          button.disabled = true;
          button.dataset.originalText = button.dataset.originalText || button.textContent.trim();
          button.textContent = 'Memproses...';
        });
      });
    });
  }

  function setupCopyButtons() {
    $$('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copy || '';
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          const original = button.textContent;
          button.textContent = 'Tersalin';
          window.setTimeout(() => {
            button.textContent = original;
          }, 1400);
        } catch (_) {
          window.prompt('Salin manual:', value);
        }
      });
    });
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function setupCountdowns() {
    const items = [
      ...$$('[data-payment-expiry]').map((box) => ({ box, target: $('[data-countdown]', box), date: box.dataset.paymentExpiry })),
      ...$$('[data-flash-expiry]').map((box) => ({ box, target: $('[data-flash-countdown]', box), date: box.dataset.flashExpiry }))
    ].filter((item) => item.target && item.date);

    if (!items.length) return;

    const tick = () => {
      const now = Date.now();
      items.forEach((item) => {
        const end = new Date(item.date).getTime();
        item.target.textContent = formatDuration(end - now);
      });
    };

    tick();
    window.setInterval(tick, 1000);
  }

  function setupCaptchaRefresh() {
    $$('[data-captcha-box]').forEach((box) => {
      const image = $('[data-captcha-image]', box);
      const button = $('[data-captcha-refresh]', box);
      if (!image || !button) return;

      button.addEventListener('click', () => {
        const url = new URL(image.getAttribute('src'), window.location.origin);
        url.searchParams.set('id', `${Date.now()}`);
        image.setAttribute('src', `${url.pathname}${url.search}`);
      });
    });
  }

  function setupBioCounter() {
    const textarea = $('textarea[name="bio"]');
    const counter = $('[data-bio-count]');
    if (!textarea || !counter) return;
    textarea.addEventListener('input', () => {
      counter.textContent = String(textarea.value.length);
    });
  }

  function setupAvatarPreview() {
    const input = $('[data-avatar-input]');
    const dataInput = $('[data-avatar-data]');
    const removeInput = $('[data-avatar-remove-value]');
    const preview = $('[data-avatar-preview]');
    const fallback = $('[data-avatar-fallback]');
    const removeButton = $('[data-avatar-remove]');
    const message = $('[data-avatar-message]');
    if (!input || !dataInput || !preview) return;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        if (message) message.textContent = 'Format foto harus PNG, JPG, atau WEBP.';
        input.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        if (message) message.textContent = 'Ukuran foto maksimal 2 MB.';
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        dataInput.value = String(reader.result || '');
        if (removeInput) removeInput.value = '0';
        preview.src = dataInput.value;
        preview.hidden = false;
        if (fallback) fallback.hidden = true;
        if (message) message.textContent = 'Foto siap disimpan.';
      };
      reader.readAsDataURL(file);
    });

    removeButton?.addEventListener('click', () => {
      dataInput.value = '';
      if (removeInput) removeInput.value = '1';
      preview.hidden = true;
      preview.removeAttribute('src');
      if (fallback) fallback.hidden = false;
      if (message) message.textContent = 'Foto akan dihapus setelah disimpan.';
    });
  }

  function setupDiscountForm() {
    const form = $('[data-discount-form]');
    if (!form) return;
    const benefitType = $('[data-benefit-type]', form);
    const orderFields = $('[data-order-discount-fields]', form);
    const walletFields = $('[data-wallet-credit-fields]', form);
    const scope = $('[data-discount-scope]', form);
    const products = $('[data-discount-products]', form);

    const syncBenefit = () => {
      const wallet = benefitType?.value === 'wallet_credit';
      if (orderFields) orderFields.hidden = wallet;
      if (walletFields) walletFields.hidden = !wallet;
    };
    const syncScope = () => {
      if (products) products.hidden = scope?.value !== 'products';
    };

    benefitType?.addEventListener('change', syncBenefit);
    scope?.addEventListener('change', syncScope);
    syncBenefit();
    syncScope();
  }

  function setupAiProductCopy() {
    const button = $('[data-ai-product-copy]');
    const form = $('[data-product-form]');
    if (!button || !form) return;

    button.addEventListener('click', async () => {
      const name = form.elements.name?.value?.trim();
      if (!name) {
        window.alert('Isi nama produk dulu.');
        return;
      }

      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Generate...';

      try {
        const response = await fetch('/api/ai/product-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
          body: JSON.stringify({
            name,
            category: form.elements.category?.selectedOptions?.[0]?.dataset?.name || '',
            price: form.elements.price?.value || '',
            version: form.elements.version?.value || ''
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Gagal generate deskripsi.');
        const data = result.data || result;
        if (form.elements.shortDescription && data.shortDescription) form.elements.shortDescription.value = data.shortDescription;
        if (form.elements.description && data.description) form.elements.description.value = data.description;
        if (form.elements.tags && Array.isArray(data.tags)) form.elements.tags.value = data.tags.join(', ');
        if (form.elements.instructions && data.instructions) form.elements.instructions.value = data.instructions;
        if (form.elements.changelog && data.changelog) form.elements.changelog.value = data.changelog;
      } catch (error) {
        window.alert(error.message || 'Gagal generate deskripsi.');
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  function setupAiChat() {
    const root = $('[data-ai-chat]');
    if (!root) return;
    const toggle = $('[data-ai-toggle]', root);
    const panel = $('[data-ai-panel]', root);
    const close = $('[data-ai-close]', root);
    const messages = $('[data-ai-messages]', root);
    const form = $('[data-ai-form]', root);
    const input = $('input[name="message"], textarea[name="message"]', form || root) || $('input, textarea', form || root);
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      root.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', String(!open));
      toggle.setAttribute('aria-expanded', String(open));
    };

    const addMessage = (text, type) => {
      if (!messages) return;
      const bubble = document.createElement('div');
      bubble.className = `ai-message ai-message-${type}`;
      bubble.textContent = text;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    };

    toggle.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
    close?.addEventListener('click', () => setOpen(false));

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input?.value?.trim();
      if (!message) return;
      input.value = '';
      addMessage(message, 'user');

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
          body: JSON.stringify({ message })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Assistant belum bisa menjawab.');
        addMessage(result.reply || result.message || 'Baik, saya bantu cek.', 'bot');
      } catch (error) {
        addMessage(error.message || 'Assistant sedang tidak tersedia.', 'bot');
      }
    });
  }

  function setupSupportPopup() {
    const shell = $('[data-support-popup]');
    if (!shell) return;
    const title = $('[data-support-popup-title]', shell);
    const description = $('[data-support-popup-description]', shell);
    const note = $('[data-support-popup-note]', shell);
    const options = $('[data-support-popup-options]', shell);
    const closeButtons = $$('[data-support-popup-close]', shell);
    const storageKey = 'tokozyphra-support-popup-closed';

    const close = () => {
      shell.classList.remove('is-open');
      shell.setAttribute('aria-hidden', 'true');
      shell.hidden = true;
      try {
        window.sessionStorage.setItem(storageKey, '1');
      } catch (_) {}
    };

    closeButtons.forEach((button) => button.addEventListener('click', close));

    fetch('/api/support-popup')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const data = payload?.data || payload;
        if (!data?.enabled) return;
        try {
          if (window.sessionStorage.getItem(storageKey) === '1') return;
        } catch (_) {}

        if (title && data.title) title.textContent = data.title;
        if (description && data.description) description.textContent = data.description;
        if (note && data.primaryNote) note.textContent = data.primaryNote;
        if (options) {
          options.innerHTML = '';
          (data.providers || []).filter((item) => item.enabled !== false).forEach((item) => {
            const link = document.createElement('a');
            link.className = 'support-popup-option';
            link.href = item.url || '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = `<strong>${item.title || 'Support'}</strong><span>${item.description || ''}</span><b>${item.label || 'Kunjungi'} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></b>`;
            options.appendChild(link);
          });
        }

        shell.hidden = false;
        shell.setAttribute('aria-hidden', 'false');
        window.setTimeout(() => shell.classList.add('is-open'), 80);
      })
      .catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupPublicNav();
    setupAdminNav();
    setupToasts();
    setupConfirmForms();
    setupSubmitLocks();
    setupCopyButtons();
    setupCountdowns();
    setupCaptchaRefresh();
    setupBioCounter();
    setupAvatarPreview();
    setupDiscountForm();
    setupAiProductCopy();
    setupAiChat();
    setupSupportPopup();
  });
})();
