const crypto = require("crypto");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function buildOtpCacheKey(email) {
  return `otp_${hashKey(normalizeEmail(email))}`;
}

function buildSessionCacheKey(token) {
  return `ses_${hashKey(String(token || "").trim())}`;
}

function getAuthHeaderToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (!authHeader) return "";

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return String(parts[1] || "").trim();
  }

  return "";
}

function getSessionTokenFromRequest(req, parsedUrl) {
  return (
    getAuthHeaderToken(req) ||
    req.headers["x-session-token"] ||
    req.headers["X-Session-Token"] ||
    parsedUrl.searchParams.get("sessionToken") ||
    ""
  );
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  generateOtp,
  generateSessionToken,
  buildOtpCacheKey,
  buildSessionCacheKey,
  getSessionTokenFromRequest
};