function sortValue(value) { if (Array.isArray(value)) return value.map(sortValue); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = sortValue(value[key]); return out; }, {}); return value; }
module.exports = (value) => JSON.stringify(sortValue(value));
