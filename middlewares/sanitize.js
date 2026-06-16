function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value)) if (!key.startsWith('$') && !key.includes('.')) result[key] = clean(entry);
    return result;
  }
  return value;
}
function sanitizeBody(req, res, next) { if (req.body) req.body = clean(req.body); next(); }
module.exports = { sanitizeBody };
