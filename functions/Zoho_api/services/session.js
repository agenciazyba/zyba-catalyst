const { getCacheSegment } = require("./cache");
const { generateSessionToken, buildSessionCacheKey, normalizeEmail } = require("../utils/helpers");

async function createSession(app, email) {
  const segment = getCacheSegment(app);
  const sessionToken = generateSessionToken();

  await segment.put(
    buildSessionCacheKey(sessionToken),
    JSON.stringify({
      email: normalizeEmail(email),
      createdAt: Date.now()
    }),
    Number(process.env.SESSION_CACHE_TTL_HOURS || 24)
  );

  return sessionToken;
}

async function getSession(app, token) {
  if (!token) return null;

  const segment = getCacheSegment(app);
  const value = await segment.getValue(buildSessionCacheKey(token));

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function logoutSession(app, token) {
  if (!token) return false;

  const segment = getCacheSegment(app);
  await segment.delete(buildSessionCacheKey(token));
  return true;
}

module.exports = {
  createSession,
  getSession,
  logoutSession
};