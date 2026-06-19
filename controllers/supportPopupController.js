const { getStoreSettings, normalizeSupportPopup } = require('../services/settingService');
const { AppError } = require('../utils/errors');

function bool(value) { return value === 'on' || value === 'true' || value === true; }
function text(value, fallback = '', limit = 400) { return String(value || fallback).trim().slice(0, limit); }
function safeUrl(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('invalid protocol');
    return url.toString();
  } catch {
    throw new AppError('URL popup thanks support harus valid dan diawali http/https.', 400, 'INVALID_SUPPORT_POPUP_URL');
  }
}
function providerPayload(source, prefix, fallback) {
  return {
    enabled: bool(source[`${prefix}Enabled`]),
    title: text(source[`${prefix}Title`], fallback.title, 80),
    description: text(source[`${prefix}Description`], fallback.description, 220),
    label: text(source[`${prefix}Label`], fallback.label, 60),
    url: safeUrl(source[`${prefix}Url`], fallback.url)
  };
}
function publicPayload(settings) {
  const popup = normalizeSupportPopup(settings.supportPopup || {});
  const providers = [];
  if (popup.vercel?.enabled) providers.push({ key: 'vercel', ...popup.vercel });
  if (popup.pakasir?.enabled) providers.push({ key: 'pakasir', ...popup.pakasir });
  return {
    ok: true,
    enabled: Boolean(popup.enabled && providers.length),
    showOnHomeOnly: popup.showOnHomeOnly !== false,
    showOncePerSession: popup.showOncePerSession !== false,
    title: popup.title,
    description: popup.description,
    primaryNote: popup.primaryNote,
    updatedAt: settings.updatedAt,
    providers
  };
}

async function publicConfig(req, res) {
  const settings = await getStoreSettings();
  res.json(publicPayload(settings));
}
async function edit(req, res) {
  const settings = await getStoreSettings();
  res.render('admin/support-popup', { title: 'Popup thanks support', settings, popup: normalizeSupportPopup(settings.supportPopup || {}) });
}
async function update(req, res) {
  const settings = await getStoreSettings();
  const popup = normalizeSupportPopup(settings.supportPopup || {});
  settings.supportPopup = {
    enabled: bool(req.body.enabled),
    showOnHomeOnly: bool(req.body.showOnHomeOnly),
    showOncePerSession: bool(req.body.showOncePerSession),
    title: text(req.body.title, popup.title, 120),
    description: text(req.body.description, popup.description, 400),
    primaryNote: text(req.body.primaryNote, popup.primaryNote, 160),
    vercel: providerPayload(req.body, 'vercel', popup.vercel),
    pakasir: providerPayload(req.body, 'pakasir', popup.pakasir)
  };
  await settings.save();
  req.flash('success', 'Popup thanks support berhasil diperbarui.');
  res.redirect('/admin/support-popup');
}

module.exports = { publicConfig, edit, update };
