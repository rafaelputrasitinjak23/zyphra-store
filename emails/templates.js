const { rupiah, formatDate } = require('../utils/helpers');
const { env } = require('../config/env');

function shell(title, content) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#111827;color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;font-weight:700">${env.smtp.fromName}</div><div style="background:#fff;padding:28px 24px;border-radius:0 0 14px 14px;border:1px solid #e4e4e7"><h1 style="font-size:22px;margin:0 0 16px">${title}</h1>${content}<p style="margin-top:28px;color:#71717a;font-size:13px">Email otomatis dari ${env.smtp.fromName}. Jangan membalas email ini.</p></div></div></body></html>`;
}
function button(label, url) { return `<p style="margin:24px 0"><a href="${url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;display:inline-block">${label}</a></p>`; }
function otpTemplate({ name, code, purpose }) {
  const labels = { register: 'Verifikasi pendaftaran', password_reset: 'Reset password' };
  return shell(labels[purpose] || 'Kode OTP', `<p>Halo ${name || 'Pengguna'},</p><p>Gunakan kode berikut. Kode berlaku selama 10 menit dan hanya dapat digunakan satu kali.</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#f4f4f5;padding:18px;text-align:center;border-radius:10px">${code}</div><p>Jangan berikan kode ini kepada siapa pun.</p>`);
}
function loginTemplate({ name, ip, userAgent, device, time }) {
  return shell('Login berhasil', `<p>Halo ${name}, akun Anda baru saja digunakan untuk login.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #eee">Waktu</td><td>${formatDate(time)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">IP</td><td>${ip}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee">Perangkat</td><td>${device}</td></tr><tr><td style="padding:8px">User-agent</td><td style="word-break:break-all">${userAgent}</td></tr></table><p>Ubah password dan logout dari seluruh perangkat bila aktivitas ini bukan milik Anda.</p>`);
}
function simpleTemplate(title, name, message, action) {
  return shell(title, `<p>Halo ${name || 'Pengguna'},</p><p>${message}</p>${action ? button(action.label, action.url) : ''}`);
}
function invoiceTemplate({ order, actionUrl }) {
  const rows = order.items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${item.name} × ${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${rupiah(item.lineTotal)}</td></tr>`).join('');
  const discountRow = order.discountAmount > 0 ? `<tr><td style="padding:8px">${order.discountKind === 'voucher' ? 'Voucher' : 'Kode promo'} ${order.discountCodeText}</td><td style="text-align:right;color:#6d28d9">-${rupiah(order.discountAmount)}</td></tr>` : '';
  const itemsSubtotal = order.itemsSubtotal || (order.subtotal + (order.discountAmount || 0));
  return shell(`Invoice ${order.invoiceNumber}`, `<p>Nomor pesanan: <strong>${order.orderNumber}</strong></p><table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding:8px">Subtotal produk</td><td style="text-align:right">${rupiah(itemsSubtotal)}</td></tr>${discountRow}<tr><td style="padding:8px">Subtotal setelah diskon</td><td style="text-align:right">${rupiah(order.subtotal)}</td></tr><tr><td style="padding:8px">Fee pengguna</td><td style="text-align:right">${rupiah(order.userFee)}</td></tr><tr><td style="padding:8px;font-weight:bold">Total</td><td style="text-align:right;font-weight:bold">${rupiah(order.total)}</td></tr><tr><td style="padding:8px">Status</td><td style="text-align:right">${order.paymentStatus}</td></tr></table>${actionUrl ? button('Lihat pesanan', actionUrl) : ''}`);
}
module.exports = { otpTemplate, loginTemplate, simpleTemplate, invoiceTemplate };
