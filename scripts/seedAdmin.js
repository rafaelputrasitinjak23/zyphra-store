require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../config/database');
const { env } = require('../config/env');
const User = require('../models/User');

(async () => {
  if (!env.smtp.adminEmail) throw new Error('ADMIN_EMAIL wajib diisi.');
  await connectDatabase();
  const email = env.smtp.adminEmail.toLowerCase();
  let user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password || '')) throw new Error('ADMIN_INITIAL_PASSWORD wajib diisi dengan minimal 8 karakter, huruf besar, kecil, dan angka untuk membuat admin baru.');
    user = await User.create({ name: 'Administrator', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin', status: 'active', emailVerifiedAt: new Date() });
    console.log(`Admin baru dibuat: ${email}`);
  } else {
    user.role = 'admin'; user.status = 'active'; user.emailVerifiedAt ||= new Date(); await user.save();
    console.log(`User dipromosikan menjadi admin: ${email}`);
  }
  process.exit(0);
})().catch((error) => { console.error(error.message); process.exit(1); });
