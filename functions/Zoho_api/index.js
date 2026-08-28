"use strict";

const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const dotenv = require("dotenv");
const catalyst = require("zcatalyst-sdk-node");

const envFilePath = path.join(__dirname, ".env");

if (fs.existsSync(envFilePath)) {
  const parsedEnv = dotenv.parse(fs.readFileSync(envFilePath));

  for (const [key, value] of Object.entries(parsedEnv)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

const { sendJson } = require("./utils/http");
const { handleAuthRoutes } = require("./routes/auth");
const { handleCrmRoutes } = require("./routes/crm");
const { handleStripeRoutes } = require("./routes/stripe");

module.exports = async (req, res) => {
  const app = catalyst.initialize(req);
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const method = (req.method || "GET").toUpperCase();

  try {
    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token, Stripe-Signature"
      });
      res.end();
      return;
    }

    if (parsedUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (await handleAuthRoutes(app, req, res, parsedUrl)) {
      return;
    }

    if (await handleStripeRoutes(app, req, res, parsedUrl)) {
      return;
    }

    if (await handleCrmRoutes(app, req, res, parsedUrl)) {
      return;
    }

    sendJson(res, 404, {
      ok: false,
      message: "Route not found"
    });
  } catch (error) {
    console.error(error);

    sendJson(res, 500, {
      ok: false,
      error: error.message || "Internal server error"
    });
  }
};
