const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const { env } = require('./env');
const emailService = require('../services/emailService');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); } catch (error) { done(error); }
});

async function oauthVerify(provider, accessToken, refreshToken, profile, done) {
  try {
    const providerId = String(profile.id);
    const verifiedEntry = profile.emails?.find((entry) => entry.verified === true) || (provider === 'google' && profile._json?.email_verified ? profile.emails?.[0] : null);
    let email = verifiedEntry?.value;
    email = email ? email.toLowerCase() : `${provider}-${providerId}@users.noreply.zyphra.local`;
    let user = await User.findOne({ 'providers.provider': provider, 'providers.providerId': providerId });
    let created = false;
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        if (user.status === 'blocked') return done(null, false, { message: 'Akun diblokir.' });
        if (!user.providers.some((p) => p.provider === provider && p.providerId === providerId)) user.providers.push({ provider, providerId });
        user.status = 'active';
        user.emailVerifiedAt ||= new Date();
      } else {
        created = true;
        user = new User({ name: profile.displayName || profile.username || 'Pengguna', email, avatar: profile.photos?.[0]?.value, status: 'active', emailVerifiedAt: new Date(), providers: [{ provider, providerId }] });
      }
    }
    user.name = user.name || profile.displayName || profile.username;
    user.avatar = user.avatar || profile.photos?.[0]?.value;
    user.lastLoginAt = new Date();
    await user.save();
    if (created && !email.endsWith('@users.noreply.zyphra.local')) await emailService.sendSimple(email, 'Akun berhasil dibuat', { name: user.name, message: `Akun ${env.smtp.fromName} Anda berhasil dibuat melalui ${provider}.` }, 'oauth_register');
    done(null, user, { oauthProvider: provider });
  } catch (error) { done(error); }
}

if (env.google.clientId && env.google.clientSecret) passport.use(new GoogleStrategy({ clientID: env.google.clientId, clientSecret: env.google.clientSecret, callbackURL: env.google.callbackUrl }, (...args) => oauthVerify('google', ...args)));
if (env.github.clientId && env.github.clientSecret) passport.use(new GitHubStrategy({ clientID: env.github.clientId, clientSecret: env.github.clientSecret, callbackURL: env.github.callbackUrl, scope: ['user:email'] }, (...args) => oauthVerify('github', ...args)));
module.exports = passport;
