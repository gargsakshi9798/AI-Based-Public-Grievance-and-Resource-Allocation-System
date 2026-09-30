const { validationResult } = require('express-validator');

/**
 * Reads the result of express-validator chains and short-circuits with 422
 * if any errors are present.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((err) => ({
    field: err.path || err.param,
    message: err.msg,
    value: err.value,
  }));

  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: formatted,
  });
};

module.exports = validate;
