const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const { env } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { flashMiddleware } = require('./middlewares/flash');
const { csrfMiddleware } = require('./middlewares/csrf');
const { localsMiddleware } = require('./middlewares/locals');
const { sanitizeBody } = require('./middlewares/sanitize');
const { globalLimiter, apiLimiter, webhookLimiter } = require('./middlewares/rateLimits');
const { requestContext } = require('./middlewares/requestContext');
const { attachUser } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const asyncHandler = require('./utils/asyncHandler');
const productController = require('./controllers/productController');
const systemController = require('./controllers/systemController');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);
app.use((req, res, next) => { res.locals.cspNonce = crypto.randomBytes(16).toString('base64'); next(); });
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(compression());
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: env.isProduction ? '7d' : 0,
  immutable: env.isProduction,
  fallthrough: false
}));
app.use(requestContext);
app.get('/healthz', systemController.health);
app.get('/readyz', asyncHandler(systemController.readiness));
app.use(globalLimiter);
app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json'] }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(methodOverride('_method'));
app.use(sanitizeBody);

async function databaseMiddleware(req, res, next) {
  await connectDatabase();
  next();
}

// Machine-to-machine endpoints intentionally run without browser sessions.
app.use('/api/system', require('./routes/systemRoutes'));
app.use('/webhooks', webhookLimiter, asyncHandler(databaseMiddleware), require('./routes/webhookRoutes'));
app.use('/api', apiLimiter);

let browserSessionMiddleware = null;
function getBrowserSessionMiddleware() {
  if (browserSessionMiddleware) return browserSessionMiddleware;
  browserSessionMiddleware = session({
    name: 'zyphra.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: 'sessions',
      ttl: env.sessionTtlDays * 86400,
      autoRemove: 'native',
      crypto: { secret: env.sessionSecret }
    }),
    cookie: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      maxAge: env.sessionTtlDays * 86400000,
      path: '/'
    }
  });
  return browserSessionMiddleware;
}

app.use(asyncHandler(async (req, res, next) => {
  await connectDatabase();
  return getBrowserSessionMiddleware()(req, res, next);
}));
app.use(attachUser);
app.use(flashMiddleware);
app.use(localsMiddleware);
app.use(csrfMiddleware);

function mountIfRouteExists(basePath, relativeRouteFile) {
  const routeFile = path.join(__dirname, relativeRouteFile);
  if (fs.existsSync(routeFile)) app.use(basePath, require(routeFile));
}

app.get('/', asyncHandler(productController.home));
app.use('/auth', require('./routes/authRoutes'));
app.use('/products', require('./routes/productRoutes'));
app.use('/cart', require('./routes/cartRoutes'));
app.use('/checkout', require('./routes/checkoutRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/payments', require('./routes/paymentRoutes'));
app.use('/account', require('./routes/accountRoutes'));
app.use('/wallet', require('./routes/walletRoutes'));
mountIfRouteExists('/notifications', 'routes/notificationRoutes.js');
mountIfRouteExists('/support', 'routes/supportRoutes.js');
mountIfRouteExists('/docs', 'routes/documentationRoutes.js');
mountIfRouteExists('/reviews', 'routes/reviewRoutes.js');
app.use('/downloads', require('./routes/downloadRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/api/support-popup', require('./routes/supportPopupRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
