document.addEventListener('DOMContentLoaded', () => {
  const siteToggle = document.querySelector('[data-nav-toggle]');
  const siteClose = document.querySelector('[data-nav-close]');
  const siteNav = document.querySelector('[data-nav]');
  const siteOverlay = document.querySelector('[data-nav-overlay]');

  const setSiteNavOpen = (open) => {
    if (!siteNav) return;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const next = Boolean(open && mobile);
    siteNav.classList.toggle('open', next);
    siteNav.setAttribute('aria-hidden', mobile ? String(!next) : 'false');
    siteToggle?.setAttribute('aria-expanded', String(next));
    if (siteOverlay) siteOverlay.hidden = !next;
    document.body.classList.toggle('nav-open', next);
  };

  siteToggle?.addEventListener('click', () => setSiteNavOpen(!siteNav?.classList.contains('open')));
  siteClose?.addEventListener('click', () => setSiteNavOpen(false));
  siteOverlay?.addEventListener('click', () => setSiteNavOpen(false));
  siteNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    if (window.innerWidth <= 900) setSiteNavOpen(false);
  }));

  const adminSidebar = document.querySelector('[data-admin-sidebar]');
  const adminOpenButtons = document.querySelectorAll('[data-admin-open]');
  const adminClose = document.querySelector('[data-admin-close]');
  const adminOverlay = document.querySelector('[data-admin-overlay]');

  const setAdminSidebarOpen = (open) => {
    if (!adminSidebar) return;
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const next = Boolean(open && mobile);
    adminSidebar.classList.toggle('open', next);
    adminSidebar.setAttribute('aria-hidden', mobile ? String(!next) : 'false');
    adminOpenButtons.forEach((button) => button.setAttribute('aria-expanded', String(next)));
    if (adminOverlay) adminOverlay.hidden = !next;
    document.body.classList.toggle('admin-sidebar-open', next);
  };

  adminOpenButtons.forEach((button) => button.addEventListener('click', () => setAdminSidebarOpen(true)));
  adminClose?.addEventListener('click', () => setAdminSidebarOpen(false));
  adminOverlay?.addEventListener('click', () => setAdminSidebarOpen(false));
  adminSidebar?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    if (window.innerWidth <= 900) setAdminSidebarOpen(false);
  }));

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setSiteNavOpen(false);
    setAdminSidebarOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setSiteNavOpen(false);
    if (window.innerWidth > 900) setAdminSidebarOpen(false);
  });

  setSiteNavOpen(false);
  setAdminSidebarOpen(false);


  document.querySelectorAll('[data-toast-close]').forEach((button) => button.addEventListener('click', () => button.closest('[data-toast]')?.remove()));
  setTimeout(() => document.querySelectorAll('[data-toast]').forEach((toast) => toast.classList.add('toast-hide')), 5000);

  document.querySelectorAll('[data-confirm]').forEach((form) => form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm || 'Lanjutkan tindakan ini?')) event.preventDefault();
  }));

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


  document.querySelectorAll('[data-flash-expiry]').forEach((box) => {
    const output = box.querySelector('[data-flash-countdown]');
    const expiresAt = new Date(box.dataset.flashExpiry).getTime();
    const render = () => {
      const remaining = expiresAt - Date.now();
      if (!output) return;
      if (!Number.isFinite(remaining) || remaining <= 0) { output.textContent = 'Selesai'; return; }
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      output.textContent = `${days > 0 ? `${days}h ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    render(); setInterval(render, 1000);
  });

  const discountScope = document.querySelector('[data-discount-scope]');
  const discountProducts = document.querySelector('[data-discount-products]');
  const benefitType = document.querySelector('[data-benefit-type]');
  const orderDiscountFields = document.querySelector('[data-order-discount-fields]');
  const walletCreditFields = document.querySelector('[data-wallet-credit-fields]');
  const syncDiscountScope = () => {
    const isWalletCredit = benefitType?.value === 'wallet_credit';
    if (orderDiscountFields) orderDiscountFields.hidden = isWalletCredit;
    if (walletCreditFields) walletCreditFields.hidden = !isWalletCredit;
    if (discountProducts) discountProducts.hidden = isWalletCredit || discountScope?.value !== 'products';
  };
  discountScope?.addEventListener('change', syncDiscountScope);
  benefitType?.addEventListener('change', syncDiscountScope);
  syncDiscountScope();

  document.querySelectorAll('[data-payment-expiry]').forEach((box) => {
    const output = box.querySelector('[data-countdown]');
    const expiresAt = new Date(box.dataset.paymentExpiry).getTime();
    const render = () => {
      const remaining = expiresAt - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) { output.textContent = 'kedaluwarsa'; return; }
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      output.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    render(); setInterval(render, 1000);
  });

  const avatarInput = document.querySelector('[data-avatar-input]');
  const avatarPreview = document.querySelector('[data-avatar-preview]');
  const avatarFallback = document.querySelector('[data-avatar-fallback]');
  const avatarData = document.querySelector('[data-avatar-data]');
  const avatarRemoveValue = document.querySelector('[data-avatar-remove-value]');
  const avatarMessage = document.querySelector('[data-avatar-message]');
  const showAvatarMessage = (message, error = false) => {
    if (!avatarMessage) return;
    avatarMessage.textContent = message;
    avatarMessage.style.color = error ? 'var(--danger)' : 'var(--success)';
  };
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      avatarInput.value = '';
      showAvatarMessage('Gunakan file PNG, JPG, atau WebP.', true);
      return;
    }
    if (file.size > 750 * 1024) {
      avatarInput.value = '';
      showAvatarMessage('Ukuran foto maksimal 750 KB.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (avatarPreview) { avatarPreview.src = reader.result; avatarPreview.hidden = false; }
      if (avatarFallback) avatarFallback.hidden = true;
      if (avatarData) avatarData.value = reader.result;
      if (avatarRemoveValue) avatarRemoveValue.value = '0';
      showAvatarMessage('Foto siap disimpan. Klik Simpan perubahan.');
    };
    reader.onerror = () => showAvatarMessage('Foto tidak dapat dibaca.', true);
    reader.readAsDataURL(file);
  });
  document.querySelector('[data-avatar-remove]')?.addEventListener('click', () => {
    if (avatarPreview) { avatarPreview.src = ''; avatarPreview.hidden = true; }
    if (avatarFallback) avatarFallback.hidden = false;
    if (avatarData) avatarData.value = '';
    if (avatarRemoveValue) avatarRemoveValue.value = '1';
    if (avatarInput) avatarInput.value = '';
    showAvatarMessage('Foto akan dihapus setelah perubahan disimpan.');
  });
  const bio = document.querySelector('textarea[name="bio"]');
  const bioCount = document.querySelector('[data-bio-count]');
  bio?.addEventListener('input', () => { if (bioCount) bioCount.textContent = String(bio.value.length); });

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const currentPath = document.querySelector('meta[name="current-path"]')?.content || window.location.pathname;

  const productForm = document.querySelector('[data-product-form]');
  const productAiButton = document.querySelector('[data-ai-product-copy]');
  productAiButton?.addEventListener('click', async () => {
    const original = productAiButton.textContent;
    const name = productForm?.elements.name?.value?.trim();
    if (!name) { window.alert('Isi nama produk terlebih dahulu.'); productForm?.elements.name?.focus(); return; }
    const selected = productForm.elements.category?.selectedOptions?.[0];
    productAiButton.disabled = true; productAiButton.textContent = 'Membuat konten...';
    try {
      const response = await fetch('/admin/ai/product-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ name, categoryName: selected?.dataset.name || selected?.textContent || '', tags: productForm.elements.tags?.value || '', version: productForm.elements.version?.value || '1.0.0' })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Gagal membuat konten produk.');
      for (const key of ['shortDescription', 'description', 'instructions', 'changelog']) if (productForm.elements[key] && payload.data[key]) productForm.elements[key].value = payload.data[key];
      if (productForm.elements.tags && Array.isArray(payload.data.tags)) productForm.elements.tags.value = payload.data.tags.join(', ');
      productAiButton.textContent = payload.source === 'ai' ? 'Konten AI berhasil dibuat' : 'Template otomatis berhasil dibuat';
    } catch (error) { window.alert(error.message); productAiButton.textContent = 'Gagal, coba lagi'; }
    finally { productAiButton.disabled = false; setTimeout(() => { productAiButton.textContent = original; }, 2500); }
  });

  const chat = document.querySelector('[data-ai-chat]');
  const chatPanel = chat?.querySelector('[data-ai-panel]');
  const chatToggle = chat?.querySelector('[data-ai-toggle]');
  const chatMessages = chat?.querySelector('[data-ai-messages]');
  const chatForm = chat?.querySelector('[data-ai-form]');
  const setChatOpen = (open) => { chat?.classList.toggle('open', open); chatPanel?.setAttribute('aria-hidden', String(!open)); chatToggle?.setAttribute('aria-expanded', String(open)); if (open) chatForm?.elements.message?.focus(); };
  chatToggle?.addEventListener('click', () => setChatOpen(!chat.classList.contains('open')));
  chat?.querySelector('[data-ai-close]')?.addEventListener('click', () => setChatOpen(false));
  const appendMessage = (text, type) => { const node = document.createElement('div'); node.className = `ai-message ai-message-${type}`; node.textContent = text; chatMessages.appendChild(node); chatMessages.scrollTop = chatMessages.scrollHeight; return node; };
  chatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = chatForm.elements.message;
    const message = input.value.trim();
    if (!message) return;
    appendMessage(message, 'user'); input.value = ''; input.disabled = true;
    const loading = appendMessage('Sedang mencari informasi...', 'bot');
    try {
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ message, currentPath }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Chatbot gagal merespons.');
      loading.textContent = payload.reply;
    } catch (error) { loading.textContent = `${error.message} Silakan coba lagi.`; }
    finally { input.disabled = false; input.focus(); }
  });



  const supportPopup = document.querySelector('[data-support-popup]');
  if (supportPopup) {
    const supportPath = window.location.pathname;
    const closeButtons = supportPopup.querySelectorAll('[data-support-popup-close]');
    const titleNode = supportPopup.querySelector('[data-support-popup-title]');
    const descNode = supportPopup.querySelector('[data-support-popup-description]');
    const noteNode = supportPopup.querySelector('[data-support-popup-note]');
    const optionsNode = supportPopup.querySelector('[data-support-popup-options]');
    const openSupportPopup = () => { supportPopup.hidden = false; supportPopup.setAttribute('aria-hidden', 'false'); requestAnimationFrame(() => supportPopup.classList.add('is-open')); document.body.classList.add('support-popup-open'); };
    const closeSupportPopup = () => { supportPopup.classList.remove('is-open'); supportPopup.setAttribute('aria-hidden', 'true'); document.body.classList.remove('support-popup-open'); setTimeout(() => { supportPopup.hidden = true; }, 180); };
    closeButtons.forEach((button) => button.addEventListener('click', closeSupportPopup));
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && supportPopup.classList.contains('is-open')) closeSupportPopup(); });
    const renderProvider = (provider) => {
      const link = document.createElement('a');
      link.className = 'support-popup-option';
      link.href = provider.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const title = document.createElement('strong');
      title.textContent = provider.title;
      const desc = document.createElement('span');
      desc.textContent = provider.description;
      const cta = document.createElement('b');
      cta.textContent = provider.label || 'Buka panduan';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 12h14M13 6l6 6-6 6');
      icon.appendChild(path);
      cta.appendChild(icon);
      link.append(title, desc, cta);
      return link;
    };
    const shouldFetchSupportPopup = supportPath === '/' || supportPath === '/index.html';
    if (shouldFetchSupportPopup) {
      fetch('/api/support-popup', { headers: { accept: 'application/json' } })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (!payload?.enabled || !Array.isArray(payload.providers) || !payload.providers.length) return;
          if (payload.showOnHomeOnly && supportPath !== '/' && supportPath !== '/index.html') return;
          const cacheKey = `zyphra-support-popup:${payload.updatedAt || 'default'}`;
          if (payload.showOncePerSession && sessionStorage.getItem(cacheKey) === '1') return;
          if (titleNode) titleNode.textContent = payload.title || 'Terima kasih kepada support kami';
          if (descNode) descNode.textContent = payload.description || 'Website ini didukung oleh layanan pilihan.';
          if (noteNode) noteNode.textContent = payload.primaryNote || '';
          if (optionsNode) { optionsNode.innerHTML = ''; payload.providers.forEach((provider) => optionsNode.appendChild(renderProvider(provider))); }
          if (payload.showOncePerSession) sessionStorage.setItem(cacheKey, '1');
          setTimeout(openSupportPopup, 450);
        })
        .catch(() => {});
    }
  }

  document.querySelectorAll('form').forEach((form) => form.addEventListener('submit', (event) => {
    if (event.defaultPrevented || form.matches('[data-ai-form]')) return;
    const button = form.querySelector('[data-submit-lock]');
    if (button) { button.disabled = true; button.textContent = 'Memproses...'; }
  }));
});


// PWA registration
window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/public/sw.js').catch(() => {});
});
