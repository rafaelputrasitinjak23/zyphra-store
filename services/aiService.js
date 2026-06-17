const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');

function normalizeText(value, max = 12000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function extractAiText(payload) {
  if (typeof payload === 'string') return normalizeText(payload);
  if (!payload || typeof payload !== 'object') return '';

  const directKeys = ['answer', 'response', 'result', 'text', 'content', 'message', 'output'];
  for (const key of directKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return normalizeText(value);
    if (value && typeof value === 'object') {
      const nested = extractAiText(value);
      if (nested) return nested;
    }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractAiText(item);
      if (nested) return nested;
    }
  }

  if (payload.data !== undefined) {
    const nested = extractAiText(payload.data);
    if (nested) return nested;
  }

  return '';
}

function parseJsonFromText(text) {
  const cleaned = normalizeText(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

async function askAi({ prompt, system, temperature = env.ai.temperature }) {
  if (!env.ai.enabled) throw new AppError('Fitur AI sedang dinonaktifkan.', 503, 'AI_DISABLED');
  const safePrompt = normalizeText(prompt, 1800);
  const safeSystem = normalizeText(system, 10000);
  if (!safePrompt) throw new AppError('Pesan AI tidak boleh kosong.', 400, 'AI_PROMPT_EMPTY');

  try {
    const { data } = await axios.get(`${env.ai.baseUrl}${env.ai.path}`, {
      params: { prompt: safePrompt, system: safeSystem, temperature },
      timeout: env.ai.timeoutMs,
      maxContentLength: 1024 * 1024,
      headers: { Accept: 'application/json,text/plain;q=0.9' }
    });
    const text = extractAiText(data);
    if (!text) throw new Error('Respons AI kosong atau formatnya tidak dikenali.');
    return { text, raw: data };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new AppError(`Layanan AI gagal merespons: ${message}`, 502, 'AI_REQUEST_FAILED');
  }
}

function fallbackProductCopy({ name, category, tags, version }) {
  const productName = normalizeText(name, 150) || 'Produk Digital';
  const categoryName = normalizeText(category, 80) || 'produk digital';
  const cleanTags = Array.isArray(tags) ? tags.map((tag) => normalizeText(tag, 35)).filter(Boolean).slice(0, 10) : [];
  const tagText = cleanTags.length ? cleanTags.join(', ') : categoryName;
  const productVersion = normalizeText(version, 30) || '1.0.0';
  return {
    shortDescription: `${productName} adalah ${categoryName} siap pakai yang dirancang agar mudah dipasang, dipahami, dan dikembangkan sesuai kebutuhan proyek Anda.`.slice(0, 300),
    description: `${productName} merupakan ${categoryName} yang dibuat untuk membantu mempercepat proses pengembangan. Produk disusun dengan struktur yang rapi, mudah dipelajari, dan cocok digunakan sebagai dasar proyek maupun kebutuhan produksi setelah disesuaikan.\n\nFitur utama:\n- Struktur file rapi dan mudah dikembangkan\n- Dokumentasi penggunaan yang jelas\n- Cocok untuk pemula maupun developer berpengalaman\n- Mendukung penyesuaian sesuai kebutuhan proyek\n- Produk digital tersedia setelah pembayaran terverifikasi\n\nTeknologi atau topik terkait: ${tagText}.\n\nPastikan membaca kebutuhan sistem dan instruksi penggunaan sebelum menjalankan produk.`,
    tags: cleanTags.length ? cleanTags : [categoryName.toLowerCase(), 'digital', 'source code'],
    instructions: `1. Download file dari halaman Produk Saya setelah pembayaran berhasil.\n2. Ekstrak file ke folder kerja.\n3. Baca README atau dokumentasi yang tersedia.\n4. Isi konfigurasi environment bila diperlukan.\n5. Instal dependency dan jalankan sesuai petunjuk produk.`,
    changelog: `Versi ${productVersion}\n- Rilis produk\n- Struktur awal dan dokumentasi penggunaan\n- Penyempurnaan stabilitas dasar`
  };
}

function sanitizeProductCopy(value, fallback) {
  const tags = Array.isArray(value?.tags)
    ? value.tags.map((tag) => normalizeText(tag, 35)).filter(Boolean).slice(0, 12)
    : fallback.tags;
  return {
    shortDescription: normalizeText(value?.shortDescription, 300) || fallback.shortDescription,
    description: normalizeText(value?.description, 12000) || fallback.description,
    tags,
    instructions: normalizeText(value?.instructions, 5000) || fallback.instructions,
    changelog: normalizeText(value?.changelog, 5000) || fallback.changelog
  };
}

module.exports = { askAi, extractAiText, parseJsonFromText, fallbackProductCopy, sanitizeProductCopy };
