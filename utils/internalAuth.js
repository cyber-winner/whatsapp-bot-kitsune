const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

function internalAuthHeaders() {
  if (!INTERNAL_API_TOKEN) return {};
  return { Authorization: `Bearer ${INTERNAL_API_TOKEN}` };
}

function requireInternalAuth(req, res, next) {
  if (!INTERNAL_API_TOKEN) {
    return res.status(503).json({ error: 'INTERNAL_API_TOKEN is not configured' });
  }

  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== INTERNAL_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { internalAuthHeaders, requireInternalAuth };
