const { connectDatabase } = require('../config/database');
const { env } = require('../config/env');
const User = require('../models/User');
const objectStorageService = require('../services/objectStorageService');
const logger = require('../utils/logger');

(async () => {
  if (!env.mongoUri) throw new Error('MONGODB_URI wajib diisi.');
  if (!objectStorageService.enabled() || !env.objectStorage.publicBaseUrl) {
    throw new Error('Aktifkan object storage dan isi OBJECT_STORAGE_PUBLIC_BASE_URL.');
  }
  await connectDatabase();
  const cursor = User.find({ avatar: /^data:image\//, $or: [{ avatarStorageKey: '' }, { avatarStorageKey: null }, { avatarStorageKey: { $exists: false } }] })
    .select('+avatarStorageKey')
    .cursor();

  let migrated = 0;
  let failed = 0;
  for await (const user of cursor) {
    let uploadedKey = '';
    try {
      const stored = await objectStorageService.uploadAvatar({ userId: user._id, dataUrl: user.avatar });
      uploadedKey = stored.key;
      user.avatar = stored.url;
      user.avatarStorageKey = stored.key;
      user.avatarUpdatedAt = new Date();
      await user.save();
      migrated += 1;
    } catch (error) {
      if (uploadedKey) await objectStorageService.deleteObject(uploadedKey);
      failed += 1;
      logger.error('avatar_migration.user_failed', { userId: user._id, error });
    }
  }
  logger.info('avatar_migration.completed', { migrated, failed });
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  logger.error('avatar_migration.failed', { error });
  process.exit(1);
});
