const net = require('net');
const { AppError } = require('./errors');
function isPrivateIp(host) {
  if (!net.isIP(host)) return false;
  return host === '127.0.0.1' || host === '::1' || host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.startsWith('169.254.');
}
function assertSafeExternalUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new AppError('URL file digital tidak valid.', 400, 'INVALID_FILE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || isPrivateIp(url.hostname)) throw new AppError('URL file digital harus berupa HTTPS publik.', 400, 'UNSAFE_FILE_URL');
  return url.toString();
}
module.exports = { assertSafeExternalUrl, isPrivateIp };
