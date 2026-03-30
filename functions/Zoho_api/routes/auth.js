const { sendJson, getRequestBody } = require("../utils/http");
const {
  normalizeEmail,
  isValidEmail,
  generateOtp,
  buildOtpCacheKey,
  getSessionTokenFromRequest
} = require("../utils/helpers");
const { getCacheSegment } = require("../services/cache");
const { sendOtpEmail } = require("../services/email");
const { createSession, getSession, logoutSession } = require("../services/session");
const { getZohoAccessToken } = require("../services/zoho");

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
      sendJson(res, 400, { ok: false, message: "Email inválido" });
      return true;
    }

    const otp = generateOtp();
    const segment = getCacheSegment(app);

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

    sendJson(res, 200, {
      ok: true,
      message: "OTP enviado com sucesso"
    });
    return true;
  }

  if (method === "POST" && path === "/auth/otp/verify") {
    const body = await getRequestBody(req);
    const email = normalizeEmail(body.email);
    const otp = String(body.otp || "").trim();

    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, message: "Email inválido" });
      return true;
    }

    const segment = getCacheSegment(app);
    const saved = await segment.getValue(buildOtpCacheKey(email));

    if (!saved) {
      sendJson(res, 400, { ok: false, message: "Código inválido ou expirado" });
      return true;
    }

    let parsed;
    try {
      parsed = JSON.parse(saved);
    } catch {
      sendJson(res, 400, { ok: false, message: "Código inválido ou expirado" });
      return true;
    }

    if (Date.now() > Number(parsed.expiresAt || 0)) {
      sendJson(res, 400, { ok: false, message: "Código expirado" });
      return true;
    }

    if (parsed.otp !== otp) {
      sendJson(res, 400, { ok: false, message: "Código inválido" });
      return true;
    }

    await segment.delete(buildOtpCacheKey(email));
    const sessionToken = await createSession(app, email);

    sendJson(res, 200, {
      ok: true,
      message: "OTP validado com sucesso",
      email,
      sessionToken
    });
    return true;
  }

  if (method === "GET" && path === "/auth/session") {
    const token = getSessionTokenFromRequest(req, parsedUrl);
    const session = await getSession(app, token);

    if (!session) {
      sendJson(res, 401, { ok: false, message: "Sessão inválida ou expirada" });
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
      sendJson(res, 400, { ok: false, message: "Sessão não informada" });
      return true;
    }

    await logoutSession(app, token);

    sendJson(res, 200, {
      ok: true,
      message: "Logout realizado com sucesso"
    });
    return true;
  }

  return false;
}

module.exports = {
  handleAuthRoutes
};