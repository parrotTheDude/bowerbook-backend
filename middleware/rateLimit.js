const rateLimit = require('express-rate-limit');

// Rate limiter for authentication routes (e.g., login, signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for verification code requests
const verificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: { message: 'Too many verification requests. Please wait 10 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, verificationLimiter };