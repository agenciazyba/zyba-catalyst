"use strict";

const { sendJson, getRawRequestBody } = require("../utils/http");
const { verifyWebhookSignature } = require("../services/stripe");
const { getCheckoutStatusByTrip, setCheckoutStatus } = require("../services/checkout-state");
const { clearCart } = require("../services/cart");

async function handleStripeRoutes(app, req, res, parsedUrl) {
  const path = parsedUrl.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (method === "POST" && path === "/stripe/webhook") {
    const endpointSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!endpointSecret) {
      sendJson(res, 500, { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET env var" });
      return true;
    }

    try {
      const rawBody = await getRawRequestBody(req);
      const signature = req.headers["stripe-signature"] || req.headers["Stripe-Signature"] || "";
      const event = verifyWebhookSignature(rawBody, signature, endpointSecret);
      const eventType = String(event?.type || "").trim();
      const session = event?.data?.object || {};
      const tripId = String(
        session?.metadata?.tripId || session?.client_reference_id || ""
      ).trim();

      if (
        tripId &&
        (eventType === "checkout.session.completed" ||
          eventType === "checkout.session.async_payment_succeeded" ||
          eventType === "checkout.session.async_payment_failed")
      ) {
        const currentStatus = await getCheckoutStatusByTrip(app, tripId);
        const currentSessionId = String(currentStatus?.checkoutSessionId || "").trim();
        const incomingSessionId = String(session?.id || "").trim();

        if (currentSessionId && incomingSessionId && currentSessionId !== incomingSessionId) {
          sendJson(res, 200, { ok: true, received: true, ignored: true });
          return true;
        }

        const isSuccess =
          eventType === "checkout.session.completed" ||
          eventType === "checkout.session.async_payment_succeeded";

        await setCheckoutStatus(app, {
          tripId,
          status: isSuccess ? "paid" : "failed",
          checkoutSessionId: incomingSessionId || null,
          paymentStatus: session?.payment_status || null,
          stripeEventId: event?.id || null,
          amountTotal:
            typeof session?.amount_total === "number" && Number.isFinite(session.amount_total)
              ? session.amount_total / 100
              : null,
          currency: session?.currency || null,
          customerEmail: session?.customer_details?.email || session?.customer_email || null,
          finalizedAt: currentStatus?.finalizedAt || null,
        });

        if (isSuccess) {
          const cartOwnerKey = String(session?.metadata?.cartOwnerKey || "").trim();
          const customerEmail =
            session?.customer_details?.email || session?.customer_email || null;
          if (cartOwnerKey) {
            await clearCart(app, cartOwnerKey, tripId);
          }
          if (customerEmail) {
            await clearCart(app, customerEmail, tripId);
          }
        }
      }

      sendJson(res, 200, { ok: true, received: true });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error?.message || "Invalid Stripe webhook",
      });
    }

    return true;
  }

  return false;
}

module.exports = {
  handleStripeRoutes,
};
