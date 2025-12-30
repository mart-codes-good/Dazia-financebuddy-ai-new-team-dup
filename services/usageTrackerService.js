/**
 * Usage Tracker Service (Freemium MVP)
 * - In-memory store (resets on server restart)
 * - Supports: checkUsage (no increment) + consumeUsage (increment)
 */

const FREE_LIMIT = 20;
const usageStore = {};

function ensureUser(userId) {
  if (!usageStore[userId]) {
    usageStore[userId] = { total: 0, actions: {} };
  }
}

function checkUsage(userId) {
  if (!userId) {
    throw new Error('INVALID_USER');
  }

  ensureUser(userId);

  const used = usageStore[userId].total;
  const remaining = Math.max(0, FREE_LIMIT - used);

  return {
    userId,
    used,
    remaining,
    limit: FREE_LIMIT
  };
}

function consumeUsage(userId, action) {
  if (!userId) {
    throw new Error('INVALID_USER');
  }
  if (!action) {
    throw new Error('INVALID_ACTION');
  }

  ensureUser(userId);

  usageStore[userId].total += 1;
  usageStore[userId].actions[action] =
    (usageStore[userId].actions[action] || 0) + 1;

  const used = usageStore[userId].total;
  const remaining = Math.max(0, FREE_LIMIT - used);

  return {
    userId,
    action,
    used,
    remaining,
    limit: FREE_LIMIT
  };
}

module.exports = {
  checkUsage,
  consumeUsage
};
