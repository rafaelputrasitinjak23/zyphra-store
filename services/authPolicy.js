const AUTH_REQUIREMENTS = Object.freeze({ manual: Object.freeze({ captcha: true, password: true, otp: true }), google: Object.freeze({ captcha: false, password: false, otp: false }), github: Object.freeze({ captcha: false, password: false, otp: false }) });
function requirementsFor(method) { return AUTH_REQUIREMENTS[method] || null; }
module.exports = { AUTH_REQUIREMENTS, requirementsFor };
