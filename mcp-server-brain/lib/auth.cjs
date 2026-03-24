'use strict';

/**
 * API key validation middleware for Brain MCP server.
 * Checks Authorization: Bearer <key> against BRAIN_API_KEYS env var (comma-separated).
 */
function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key. Set Authorization: Bearer <your-key>',
      help: 'Contact support@mindrian.ai for a Brain API key.'
    });
  }

  const key = authHeader.slice(7);
  const validKeys = (process.env.BRAIN_API_KEYS || '').split(',').filter(Boolean);

  if (!validKeys.includes(key)) {
    return res.status(401).json({
      error: 'Invalid Brain API key. Contact support@mindrian.ai'
    });
  }

  next();
}

module.exports = { validateApiKey };
