const { sendJson, getRequestBody } = require("../utils/http");
const {
  normalizeEmail,
  isValidEmail,
  generateOtp,
  buildOtpCacheKey,
  buildOtpThrottleCacheKey,
  getSessionTokenFromRequest
} = require("../utils/helpers");
const { getCacheSegment } = require("../services/cache");
const { sendOtpEmail } = require("../services/email");
const { createSession, getSession, logoutSession } = require("../services/session");
const { getZohoAccessToken, zohoGetRecord } = require("../services/zoho");

// Temporary Apple review access. Remove this block and the
// /auth/apple-review/login route after App Store approval.
const APPLE_REVIEW_LOGIN = {
  email: normalizeEmail(process.env.APPLE_REVIEW_LOGIN_EMAIL || "apple@zybaoutdoors.com"),
  password: String(process.env.APPLE_REVIEW_LOGIN_PASSWORD || ""),
  accountId: String(process.env.APPLE_REVIEW_ZOHO_ACCOUNT_ID || "6623116000002652001"),
  accountName: String(process.env.APPLE_REVIEW_ZOHO_ACCOUNT_NAME || "Ricardo Magnusson"),
};

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function handleAuthRoutes(app, req, res, parsedUrl) {
  const path = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET" && path === "/auth/token") {
    const token = await getZohoAccessToken();

    sendJson(res, 200, {
      ok: true,
      tokenType: token.token_type || "Bearer",
      expiresIn: token.expires_in || null,
      apiDomain: token.api_domain || process.env.ZOHO_API_DOMAIN || null,
      accessTokenPreview: token.access_token
        ? `${token.access_token.substring(0, 20)}...`
        : null
    });
    return true;
  }

  if (method === "POST" && path === "/auth/otp/request") {
    const body = await getRequestBody(req);
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, message: "Invalid email address" });
      return true;
    }

    const segment = getCacheSegment(app);
    const now = Date.now();
    const cooldownSeconds = readPositiveNumber(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60);
    const windowMinutes = readPositiveNumber(process.env.OTP_RESEND_WINDOW_MINUTES, 15);
    const maxPerWindow = readPositiveNumber(process.env.OTP_RESEND_MAX_PER_WINDOW, 5);
    const cooldownMs = cooldownSeconds * 1000;
    const windowMs = windowMinutes * 60 * 1000;
    const throttleKey = buildOtpThrottleCacheKey(email);
    const savedThrottle = await segment.getValue(throttleKey);
    let throttle = {
      lastSentAt: 0,
      windowStartedAt: now,
      count: 0
    };

    if (savedThrottle) {
      try {
        const parsedThrottle = JSON.parse(savedThrottle);
        throttle = {
          lastSentAt: Number(parsedThrottle.lastSentAt || 0),
          windowStartedAt: Number(parsedThrottle.windowStartedAt || now),
          count: Number(parsedThrottle.count || 0)
        };
      } catch {
        throttle = {
          lastSentAt: 0,
          windowStartedAt: now,
          count: 0
        };
      }
    }

    const isSameWindow = now - throttle.windowStartedAt < windowMs;
    const elapsedSinceLastSend = now - throttle.lastSentAt;

    if (throttle.lastSentAt && elapsedSinceLastSend < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedSinceLastSend) / 1000);

      sendJson(res, 429, {
        ok: false,
        message: `Please wait ${retryAfterSeconds}s before requesting a new code.`,
        retryAfterSeconds
      });
      return true;
    }

    if (isSameWindow && throttle.count >= maxPerWindow) {
      const retryAfterSeconds = Math.ceil((throttle.windowStartedAt + windowMs - now) / 1000);

      sendJson(res, 429, {
        ok: false,
        message: "Too many code requests. Please try again later.",
        retryAfterSeconds
      });
      return true;
    }

    const otp = generateOtp();

    await segment.put(
      buildOtpCacheKey(email),
      JSON.stringify({
        otp,
        email,
        expiresAt: Date.now() + (Number(process.env.OTP_EXPIRES_MINUTES || 10) * 60 * 1000)
      }),
      Number(process.env.OTP_CACHE_TTL_HOURS || 1)
    );

    await sendOtpEmail(app, email, otp);

    const nextThrottle = isSameWindow
      ? {
          ...throttle,
          lastSentAt: now,
          count: throttle.count + 1
        }
      : {
          lastSentAt: now,
          windowStartedAt: now,
          count: 1
        };

    await segment.put(
      throttleKey,
      JSON.stringify(nextThrottle),
      Math.max(1, Math.ceil(windowMs / (60 * 60 * 1000)))
    );

    sendJson(res, 200, {
      ok: true,
      message: "Access code sent successfully",
      retryAfterSeconds: cooldownSeconds
    });
    return true;
  }

  if (method === "POST" && path === "/auth/otp/verify") {
    const body = await getRequestBody(req);
    const email = normalizeEmail(body.email);
    const otp = String(body.otp || "").trim();

    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, message: "Invalid email address" });
      return true;
    }

    const segment = getCacheSegment(app);
    const saved = await segment.getValue(buildOtpCacheKey(email));

    if (!saved) {
      sendJson(res, 400, { ok: false, message: "Invalid or expired code" });
      return true;
    }

    let parsed;
    try {
      parsed = JSON.parse(saved);
    } catch {
      sendJson(res, 400, { ok: false, message: "Invalid or expired code" });
      return true;
    }

    if (Date.now() > Number(parsed.expiresAt || 0)) {
      sendJson(res, 400, { ok: false, message: "Code expired" });
      return true;
    }

    if (parsed.otp !== otp) {
      sendJson(res, 400, { ok: false, message: "Invalid code" });
      return true;
    }

    await segment.delete(buildOtpCacheKey(email));
    const sessionToken = await createSession(app, email);

    sendJson(res, 200, {
      ok: true,
      message: "Access code verified successfully",
      email,
      sessionToken
    });
    return true;
  }

  if (method === "POST" && path === "/auth/apple-review/login") {
    const body = await getRequestBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!APPLE_REVIEW_LOGIN.password) {
      sendJson(res, 503, { ok: false, message: "Apple review login is not configured" });
      return true;
    }

    if (email !== APPLE_REVIEW_LOGIN.email || password !== APPLE_REVIEW_LOGIN.password) {
      sendJson(res, 401, { ok: false, message: "Invalid login credentials" });
      return true;
    }

    let accountRecord = null;
    try {
      accountRecord = await zohoGetRecord("Accounts", APPLE_REVIEW_LOGIN.accountId);
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        message: "Unable to load Apple review account",
        error: error.message || "Zoho account lookup failed"
      });
      return true;
    }

    const crmEmail = normalizeEmail(accountRecord?.Email);

    if (!crmEmail) {
      sendJson(res, 404, {
        ok: false,
        message: "Apple review account is missing an email in Zoho CRM"
      });
      return true;
    }

    const accountName =
      accountRecord?.Account_Name ||
      accountRecord?.Name ||
      APPLE_REVIEW_LOGIN.accountName;
    const sessionToken = await createSession(app, crmEmail, {
      loginEmail: APPLE_REVIEW_LOGIN.email,
      accountId: APPLE_REVIEW_LOGIN.accountId,
      accountName,
      isAppleReviewSession: true
    });

    sendJson(res, 200, {
      ok: true,
      message: "Signed in successfully",
      email: APPLE_REVIEW_LOGIN.email,
      account: {
        id: APPLE_REVIEW_LOGIN.accountId,
        name: accountName,
        email: crmEmail
      },
      sessionToken
    });
    return true;
  }

  if (method === "GET" && path === "/auth/session") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid or expired session" });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      session
    });
    return true;
  }

  if (method === "POST" && path === "/auth/logout") {
    const token = getSessionTokenFromRequest(req, parsedUrl);

    if (!token) {
      sendJson(res, 400, { ok: false, message: "Missing session" });
      return true;
    }

    await logoutSession(app, token);

    sendJson(res, 200, {
      ok: true,
      message: "Signed out successfully"
    });
    return true;
  }

  return false;
}

module.exports = {
  handleAuthRoutes
};
