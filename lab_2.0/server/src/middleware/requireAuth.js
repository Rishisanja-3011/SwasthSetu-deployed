const { verifyToken } = require('../security/tokens');

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const payload = verifyToken(token, 'SESSION');
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'A valid authenticated session is required.',
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        error: 'ROLE_NOT_ALLOWED',
        message: 'This account does not have access to this workflow.',
      });
    }
    next();
  };
}

module.exports = { getBearerToken, requireAuth, requireRole };
