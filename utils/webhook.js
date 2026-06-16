const { hash } = require('./helpers');
const stableStringify = require('./stableStringify');
function webhookEventKey(payload) { return hash(stableStringify(payload)); }
module.exports = { webhookEventKey };
