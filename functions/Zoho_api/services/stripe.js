"use strict";

const https = require("https");
const crypto = require("crypto");

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing ${name} env var`);
  }
  return value;
}

function formEncode(obj, prefix = "") {
  const pairs = [];

  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined || value === null) continue;
    const nextKey = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          pairs.push(formEncode(item, `${nextKey}[${index}]`));
        } else if (item !== undefined && item !== null) {
          pairs.push(
            `${encodeURIComponent(`${nextKey}[${index}]`)}=${encodeURIComponent(String(item))}`
          );
        }
      });
      continue;
    }

    if (value && typeof value === "object") {
      pairs.push(formEncode(value, nextKey));
      continue;
    }

    pairs.push(`${encodeURIComponent(nextKey)}=${encodeURIComponent(String(value))}`);
  }

  return pairs.filter(Boolean).join("&");
}

function stripeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    const payload = formEncode(body);

    const req = https.request(
      {
        hostname: "api.stripe.com",
        port: 443,
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk.toString();
        });

        res.on("end", () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            if ((res.statusCode || 500) >= 400) {
              reject(new Error(parsed?.error?.message || "Stripe request failed"));
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error("Invalid Stripe response"));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function stripeGet(path) {
  return new Promise((resolve, reject) => {
    const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");

    const req = https.request(
      {
        hostname: "api.stripe.com",
        port: 443,
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk.toString();
        });

        res.on("end", () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            if ((res.statusCode || 500) >= 400) {
              reject(new Error(parsed?.error?.message || "Stripe request failed"));
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error("Invalid Stripe response"));
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function toUnitAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

async function createCheckoutSession({ cart, tripId, customerEmail, cartOwnerKey, origin }) {
  const safeOrigin = String(origin || "").trim();
  const safeTripId = String(tripId || "").trim();

  if (!safeOrigin) {
    throw new Error("Missing request origin");
  }

  if (!safeTripId) {
    throw new Error("Missing tripId");
  }

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const invalidItem = cart.items.find(
    (item) =>
      !item?.productId ||
      !item?.productName ||
      !Number.isFinite(Number(item?.quantity)) ||
      Number(item.quantity) <= 0 ||
      toUnitAmount(item?.unitPrice) === null
  );

  if (invalidItem) {
    throw new Error("Cart has items without a valid price");
  }

  const body = {
    mode: "payment",
    success_url: `${safeOrigin}/trips/${encodeURIComponent(safeTripId)}/shop-gears/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${safeOrigin}/trips/${encodeURIComponent(safeTripId)}/shop-gears/cart?checkout=cancel`,
    customer_email: customerEmail || undefined,
    client_reference_id: safeTripId,
    "metadata[tripId]": safeTripId,
    "metadata[source]": "shop-gears",
    "metadata[itemCount]": String(cart.totalItems || 0),
    "metadata[cartOwnerKey]": cartOwnerKey || "",
  };

  cart.items.forEach((item, index) => {
    body[`line_items[${index}][quantity]`] = String(item.quantity);
    body[`line_items[${index}][price_data][currency]`] = "usd";
    body[`line_items[${index}][price_data][unit_amount]`] = String(toUnitAmount(item.unitPrice));
    body[`line_items[${index}][price_data][product_data][name]`] = item.productName;

    if (item.productCode) {
      body[`line_items[${index}][price_data][product_data][metadata][productCode]`] =
        item.productCode;
    }

    if (item.productId) {
      body[`line_items[${index}][price_data][product_data][metadata][productId]`] =
        item.productId;
    }

    if (item.vendorName) {
      body[`line_items[${index}][price_data][product_data][description]`] =
        `Brand: ${item.vendorName}`;
    }
  });

  return stripeRequest("/v1/checkout/sessions", body);
}

module.exports = {
  createCheckoutSession,
  expireCheckoutSession: function expireCheckoutSession(sessionId) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      throw new Error("Missing sessionId");
    }

    return stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(safeSessionId)}/expire`, {});
  },
  getCheckoutSession: function getCheckoutSession(sessionId) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      throw new Error("Missing sessionId");
    }

    return stripeGet(`/v1/checkout/sessions/${encodeURIComponent(safeSessionId)}`);
  },
  getCheckoutSessionLineItems: function getCheckoutSessionLineItems(sessionId) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      throw new Error("Missing sessionId");
    }

    return stripeGet(
      `/v1/checkout/sessions/${encodeURIComponent(
        safeSessionId
      )}/line_items?expand%5B%5D=data.price.product`
    );
  },
  verifyWebhookSignature: function verifyWebhookSignature(payload, signatureHeader, endpointSecret) {
    const safePayload = String(payload || "");
    const safeHeader = String(signatureHeader || "").trim();
    const safeSecret = String(endpointSecret || "").trim();

    if (!safePayload || !safeHeader || !safeSecret) {
      throw new Error("Missing webhook signature data");
    }

    const pieces = safeHeader.split(",").map((part) => part.trim());
    const timestampPart = pieces.find((part) => part.startsWith("t="));
    const signatureParts = pieces
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3))
      .filter(Boolean);

    if (!timestampPart || signatureParts.length === 0) {
      throw new Error("Invalid Stripe signature header");
    }

    const timestamp = Number(timestampPart.slice(2));
    if (!Number.isFinite(timestamp)) {
      throw new Error("Invalid Stripe signature timestamp");
    }

    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (ageSeconds > 300) {
      throw new Error("Stripe signature timestamp outside tolerance");
    }

    const expected = crypto
      .createHmac("sha256", safeSecret)
      .update(`${timestamp}.${safePayload}`, "utf8")
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const isValid = signatureParts.some((signature) => {
      try {
        const candidate = Buffer.from(signature, "hex");
        return (
          candidate.length === expectedBuffer.length &&
          crypto.timingSafeEqual(candidate, expectedBuffer)
        );
      } catch {
        return false;
      }
    });

    if (!isValid) {
      throw new Error("Webhook signature verification failed");
    }

    try {
      return JSON.parse(safePayload);
    } catch {
      throw new Error("Invalid Stripe webhook payload");
    }
  },
};
