const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer token on protected routes and attaches the
 * decoded payload (id, username) to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Like authenticateToken, but doesn't reject the request if no token is
 * present — just leaves req.user undefined. Useful for routes like
 * "get song" that behave the same for guests and logged-in users, but
 * can personalize slightly (e.g. liked state) when a token is present.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err) req.user = decoded;
    next();
  });
}

module.exports = { authenticateToken, optionalAuth };
