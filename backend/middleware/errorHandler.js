/**
 * Centralized error handler. Any controller that calls next(err) ends up
 * here instead of crashing the process or leaking a stack trace to the client.
 */
module.exports = function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}]`, err.stack || err.message);

  // Malformed JSON body (thrown by express.json() before it reaches any controller)
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'That record already exists.' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on our end.' : err.message;
  res.status(status).json({ message });
};
