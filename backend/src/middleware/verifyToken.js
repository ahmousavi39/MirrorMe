const { auth } = require('../services/firebase');

/**
 * Express middleware that verifies a Firebase ID token from the Authorization header.
 * On success, attaches req.uid and req.email to the request object.
 * On failure, returns 401 Unauthorized.
 */
module.exports = async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or malformed Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.email = decoded.email || null;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.code, error.message);
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
};
