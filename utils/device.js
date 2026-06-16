function getClientInfo(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || '').split(',')[0].trim();
  const userAgent = String(req.headers['user-agent'] || 'Tidak diketahui').slice(0, 500);
  let device = 'Perangkat tidak diketahui';
  if (/android/i.test(userAgent)) device = 'Android';
  else if (/iphone|ipad/i.test(userAgent)) device = 'iPhone/iPad';
  else if (/windows/i.test(userAgent)) device = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) device = 'macOS';
  else if (/linux/i.test(userAgent)) device = 'Linux';
  return { ip, userAgent, device };
}
module.exports = { getClientInfo };
