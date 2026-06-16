const passport = require('../config/passport');
const { env } = require('../config/env');
const { establishLogin } = require('./authController');
const emailService = require('../services/emailService');
const { getClientInfo } = require('../utils/device');

function start(provider) {
  const configured = provider === 'google' ? env.google.clientId && env.google.clientSecret : env.github.clientId && env.github.clientSecret;
  if (!configured) return (req, res) => { req.flash('error', `OAuth ${provider} belum dikonfigurasi.`); res.redirect('/auth/login'); };
  return passport.authenticate(provider, { scope: provider === 'google' ? ['profile', 'email'] : ['user:email'], state: true });
}
function callback(provider) {
  return (req, res, next) => passport.authenticate(provider, { session: false }, async (error, user, info) => {
    if (error) return next(error);
    if (!user) { req.flash('error', info?.message || 'Login OAuth gagal.'); return res.redirect('/auth/login'); }
    try {
      const client = getClientInfo(req);
      user.lastLoginAt = new Date(); user.lastLoginIp = client.ip; await user.save();
      const target = await establishLogin(req, user);
      if (!user.email.endsWith('@users.noreply.zyphra.local')) await emailService.sendLoginNotice(user.email, { name: user.name, ...client, time: new Date() });
      res.redirect(target);
    } catch (e) { next(e); }
  })(req, res, next);
}
module.exports = { start, callback };
