require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');
const { env } = require('./config/env');

(async () => {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`Zyphra Store berjalan di ${env.appUrl}`);
  });
})().catch((error) => {
  console.error('Gagal menjalankan server:', error);
  process.exit(1);
});
