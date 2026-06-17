const AUTH_REQUIREMENTS = Object.freeze({
  email: Object.freeze({ captcha: true, password: true, otp: false })
});

function requirementsFor(method) {
  return AUTH_REQUIREMENTS[method] || null;
}

module.exports = { AUTH_REQUIREMENTS, requirementsFor };
