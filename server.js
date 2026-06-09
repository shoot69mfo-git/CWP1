// server.js
'use strict';
require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const logger     = require('./middleware/logger');
const registerRoute = require('./routes/register');

// ── Startup validation ─────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'XIQ_ACCESS_TOKEN',
  'NETWORK_POLICY_ID',
  'USER_GROUP_NAME',
  'PPSK_PCG_SSID'
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// ── App ────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers (Helmet) ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", "data:"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  // Prevent the portal from being iframed (clickjacking)
  frameguard: { action: 'deny' }
}));

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, curl, Postman in dev)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn('CORS blocked request', { origin });
    cb(new Error(`Origin ${origin} is not allowed by CORS policy.`));
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Tighter limit specifically for the registration endpoint
const registerLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max:      parseInt(process.env.RATE_LIMIT_MAX        || '5',       10), // 5 per IP per hour
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    logger.warn('Rate limit hit', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please try again in an hour.'
    });
  }
});

// General API limiter (looser)
const apiLimiter = rateLimit({
  windowMs: 60_000,   // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);

// ── Request logging ────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Static portal files ────────────────────────────────────────────────────
// Serve the captive portal HTML from a /public directory
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  index: 'index.html'
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.post('/api/wifi-register', registerLimiter, registerRoute);

// ── Health check (used by load balancers / uptime monitors) ───────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found.' }));

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Boldyn Wi-Fi proxy running`, {
    port: PORT,
    env:  process.env.NODE_ENV || 'development',
    origins: allowedOrigins
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});
