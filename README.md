// routes/register.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { registerUser } = require('./xiq');
const logger = require('../middleware/logger');

const router = express.Router();

// ── Input validation rules ─────────────────────────────────────────────────
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2–100 characters.')
    .escape(),

  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),

  body('mobile')
    .trim()
    .matches(/^[\d\s\+\-\(\)]{7,20}$/)
    .withMessage('Mobile number must be 7–20 characters (digits, spaces, +, -, () allowed).')
];

// ── POST /api/wifi-register ────────────────────────────────────────────────
router.post('/', validateRegistration, async (req, res) => {
  // Return validation errors before hitting XIQ
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map(e => e.msg)
    });
  }

  const { name, email, mobile } = req.body;

  // Omit PII from logs; log only a partial email for traceability
  const safeEmail = email.replace(/(?<=.).(?=[^@]*@)/g, '*');
  logger.info('Registration attempt', { name, email: safeEmail, ip: req.ip });

  try {
    const result = await registerUser({ name, email, mobile });

    logger.info('Registration success', { name, email: safeEmail });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    logger.error('Registration failed', {
      name,
      email: safeEmail,
      message: err.message,
      xiqStatus: err.status
    });

    // Don't leak internal XIQ error details to the client in production
    const clientMessage = process.env.NODE_ENV === 'production'
      ? 'Registration could not be completed. Please try again.'
      : err.message;

    return res.status(502).json({
      success: false,
      error: clientMessage
    });
  }
});

module.exports = router;
