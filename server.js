const { assertRuntimeConfig, env } = require('./config/env');
const { connectDatabase } = require('./config/database');
const logger = require('./utils/logger');

assertRuntimeConfig();
const app = require('./app');

(async () => {
  await connectDatabase();
  const server = app.listen(env.port, () => {
    logger.info('server.started', { appUrl: env.appUrl, port: env.port, environment: env.nodeEnv });
  });

  const shutdown = (signal) => {
    logger.info('server.shutdown_requested', { signal });
    server.close((error) => {
      if (error) {
        logger.error('server.shutdown_failed', { error });
        process.exit(1);
      }
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
})().catch((error) => {
  logger.error('server.start_failed', { error });
  process.exit(1);
});
