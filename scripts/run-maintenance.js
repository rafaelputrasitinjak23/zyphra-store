const { assertRuntimeConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const maintenanceService = require('../services/maintenanceService');
const logger = require('../utils/logger');

(async () => {
  assertRuntimeConfig();
  await connectDatabase();
  const result = await maintenanceService.runMaintenance();
  logger.info('maintenance.completed', result);
  process.exit(0);
})().catch((error) => {
  logger.error('maintenance.failed', { error });
  process.exit(1);
});
