/**
 * 404 handler — catches any request that didn't match a route.
 * Must be registered BEFORE the global error handler in app.js.
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = notFound;
