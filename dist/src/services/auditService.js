const { getDb } = require('../config/db');

async function logAudit({ userId, username, action, entity, entityId, details, ip }) {
  try {
    const db = getDb();
    await db.collection('audit_logs').insertOne({
      userId: userId ? String(userId) : 'system',
      username: username || 'System',
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      details: details || {},
      ip: ip || null,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

module.exports = {
  logAudit
};
