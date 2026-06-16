const path = require('path');
const express = require('express');
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
const { globalLimiter } = require('./middlewares/rateLimits');
const { attachUser } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const asyncHandler = require('./utils/asyncHandler');
const productController = require('./controllers/productController');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://challenges.cloudflare.com'], frameSrc: ['https://challenges.cloudflare.com'], connectSrc: ["'self'", 'https://challenges.cloudflare.com'], imgSrc: ["'self'", 'data:', 'https:'], styleSrc: ["'self'", "'unsafe-inline'"], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] } }, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: env.isProduction ? '7d' : 0 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(methodOverride('_method'));
app.use(asyncHandler(async (req, res, next) => { await connectDatabase(); next(); }));
app.use(session({
  name: 'zyphra.sid', secret: env.sessionSecret, resave: false, saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: env.mongoUri, collectionName: 'sessions', ttl: env.sessionTtlDays * 86400, autoRemove: 'native' }),
  cookie: { httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: env.sessionTtlDays * 86400000 }
}));
app.use(attachUser);
app.use(flashMiddleware);
app.use(localsMiddleware);
app.use(sanitizeBody);
app.use(globalLimiter);
app.use(csrfMiddleware);

app.get('/', asyncHandler(productController.home));
app.use('/auth', require('./routes/authRoutes'));
app.use('/products', require('./routes/productRoutes'));
app.use('/cart', require('./routes/cartRoutes'));
app.use('/checkout', require('./routes/checkoutRoutes'));
app.use('/orders', require('./routes/orderRoutes'));
app.use('/payments', require('./routes/paymentRoutes'));
app.use('/account', require('./routes/accountRoutes'));
app.use('/downloads', require('./routes/downloadRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/webhooks', require('./routes/webhookRoutes'));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
