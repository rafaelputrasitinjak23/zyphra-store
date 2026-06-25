const net = require('net');
const dns = require('dns').promises;
const https = require('https');
const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('./errors');

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 192 && b === 0 && parts[2] === 2)
    || (a === 198 && b >= 18 && b <= 19)
    || (a === 198 && b === 51 && parts[2] === 100)
    || (a === 203 && b === 0 && parts[2] === 113)
    || a >= 224;
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('2001:db8:')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice(7);
    return net.isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

function isPrivateIp(host) {
  const family = net.isIP(host);
  if (family === 4) return isPrivateIpv4(host);
  if (family === 6) return isPrivateIpv6(host);
  return false;
}

function hostAllowed(hostname) {
  if (!env.downloadAllowedHosts.length) return true;
  const host = hostname.toLowerCase();
  return env.downloadAllowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function assertSafeExternalUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new AppError('URL file digital tidak valid.', 400, 'INVALID_FILE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') {
    throw new AppError('URL file digital harus berupa HTTPS publik.', 400, 'UNSAFE_FILE_URL');
  }
  if (!url.hostname || url.hostname.toLowerCase() === 'localhost' || isPrivateIp(url.hostname) || !hostAllowed(url.hostname)) {
    throw new AppError('Host file digital tidak diizinkan.', 400, 'UNSAFE_FILE_HOST');
  }
  url.hash = '';
  return url.toString();
}

async function resolveSafeExternalUrl(value) {
  const safeUrl = assertSafeExternalUrl(value);
  const url = new URL(safeUrl);
  let addresses;
  try {
    addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError('Host file digital tidak dapat ditemukan.', 502, 'FILE_HOST_UNRESOLVED');
  }
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new AppError('Host file digital mengarah ke jaringan yang tidak diizinkan.', 400, 'UNSAFE_FILE_DNS');
  }
  return { url: safeUrl, addresses };
}

async function openSafeExternalStream(value, options = {}) {
  let current = assertSafeExternalUrl(value);
  const maxRedirects = options.maxRedirects ?? env.downloadMaxRedirects;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const resolved = await resolveSafeExternalUrl(current);
    const target = new URL(resolved.url);
    const selected = resolved.addresses[0];
    const agent = new https.Agent({
      keepAlive: false,
      lookup: (hostname, lookupOptions, callback) => callback(null, selected.address, selected.family)
    });

    let response;
    try {
      response = await axios.get(target.toString(), {
        responseType: 'stream',
        timeout: options.timeout ?? env.downloadTimeoutMs,
        maxRedirects: 0,
        validateStatus: () => true,
        httpsAgent: agent,
        headers: { Accept: 'application/octet-stream, application/zip, */*' }
      });
    } catch (error) {
      throw new AppError(error.message || 'Server file tidak dapat dihubungi.', 502, 'FILE_UPSTREAM_FAILED');
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      response.data?.destroy?.();
      const location = response.headers.location;
      if (!location || redirect === maxRedirects) throw new AppError('Redirect file digital tidak valid.', 502, 'FILE_REDIRECT_INVALID');
      current = assertSafeExternalUrl(new URL(location, target).toString());
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.data?.destroy?.();
      throw new AppError(`Server file merespons status ${response.status}.`, 502, 'FILE_UPSTREAM_STATUS');
    }
    return { response, finalUrl: target.toString() };
  }

  throw new AppError('Terlalu banyak redirect file.', 502, 'FILE_TOO_MANY_REDIRECTS');
}

module.exports = { assertSafeExternalUrl, resolveSafeExternalUrl, openSafeExternalStream, isPrivateIp, hostAllowed };
