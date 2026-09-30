const logger = require('../config/logger');

/**
 * Lightweight request logger that records method, URL, status, and response time.
 * Use this instead of morgan when you need structured log entries.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      `${req.method} ${req.originalUrl} ${res.statusCode} – ${duration}ms | IP: ${req.ip}`
    );
  });

  next();
};

module.exports = requestLogger;
