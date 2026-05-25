"use strict";

const { getCacheSegment } = require("./cache");
const { hashKey } = require("../utils/helpers");

const CHECKOUT_CACHE_TTL_HOURS = Number(process.env.CHECKOUT_CACHE_TTL_HOURS || 24 * 30);
const memoryCheckoutStore = new Map();

function checkoutTripKey(tripId) {
  return `checkout_trip_${hashKey(String(tripId || "").trim())}`;
}

function checkoutSessionKey(sessionId) {
  return `checkout_session_${hashKey(String(sessionId || "").trim())}`;
}

function normalizeStatusRecord(record, tripId = "") {
  if (!record || typeof record !== "object") {
    return {
      tripId: String(tripId || "").trim(),
      status: "idle",
      checkoutSessionId: null,
      paymentStatus: null,
      stripeEventId: null,
      amountTotal: null,
      currency: null,
      customerEmail: null,
      cartSnapshot: null,
      salesOrder: null,
      salesOrderError: null,
      updatedAt: null,
      finalizedAt: null,
    };
  }

  return {
    tripId: String(record.tripId || tripId || "").trim(),
    status: String(record.status || "idle").trim() || "idle",
    checkoutSessionId: record.checkoutSessionId ? String(record.checkoutSessionId).trim() : null,
    paymentStatus: record.paymentStatus ? String(record.paymentStatus).trim() : null,
    stripeEventId: record.stripeEventId ? String(record.stripeEventId).trim() : null,
    amountTotal:
      typeof record.amountTotal === "number" && Number.isFinite(record.amountTotal)
        ? record.amountTotal
        : null,
    currency: record.currency ? String(record.currency).trim() : null,
    customerEmail: record.customerEmail ? String(record.customerEmail).trim().toLowerCase() : null,
    cartSnapshot: normalizeCartSnapshot(record.cartSnapshot),
    salesOrder: normalizeSalesOrder(record.salesOrder),
    salesOrderError: record.salesOrderError ? String(record.salesOrderError).trim() : null,
    updatedAt: record.updatedAt ? String(record.updatedAt).trim() : null,
    finalizedAt: record.finalizedAt ? String(record.finalizedAt).trim() : null,
  };
}

function normalizeCartSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;

  const items = Array.isArray(snapshot.items)
    ? snapshot.items
        .map((item) => {
          const productId = String(item?.productId || "").trim();
          const productName = String(item?.productName || "").trim();
          const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
          const unitPrice = Number(item?.unitPrice);

          if (!productId || !productName || quantity <= 0 || !Number.isFinite(unitPrice)) {
            return null;
          }

          return {
            productId,
            productName,
            productCode: item?.productCode ? String(item.productCode).trim() : null,
            category: item?.category ? String(item.category).trim() : null,
            unitPrice,
            quantity,
            imageDownloadKey: item?.imageDownloadKey ? String(item.imageDownloadKey).trim() : null,
            imageAlt: item?.imageAlt ? String(item.imageAlt).trim() : null,
            vendorName: item?.vendorName ? String(item.vendorName).trim() : null,
          };
        })
        .filter(Boolean)
    : [];

  if (!items.length) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    tripId: snapshot.tripId ? String(snapshot.tripId).trim() : null,
    items,
    subtotal,
    totalItems,
    updatedAt: snapshot.updatedAt ? String(snapshot.updatedAt).trim() : null,
  };
}

function normalizeSalesOrder(salesOrder) {
  if (!salesOrder || typeof salesOrder !== "object") return null;

  const id = String(salesOrder.id || salesOrder.salesOrderId || "").trim();
  if (!id) return null;

  const amountTotal = Number(salesOrder.amountTotal);

  return {
    id,
    salesOrderId: id,
    salesOrderNumber: salesOrder.salesOrderNumber
      ? String(salesOrder.salesOrderNumber).trim()
      : null,
    subject: salesOrder.subject ? String(salesOrder.subject).trim() : null,
    status: salesOrder.status ? String(salesOrder.status).trim() : null,
    amountTotal: Number.isFinite(amountTotal) ? amountTotal : null,
    currency: salesOrder.currency ? String(salesOrder.currency).trim().toLowerCase() : null,
    appOrderStatus: salesOrder.appOrderStatus ? String(salesOrder.appOrderStatus).trim() : null,
    stripeCheckoutSessionId: salesOrder.stripeCheckoutSessionId
      ? String(salesOrder.stripeCheckoutSessionId).trim()
      : null,
    createdAt: salesOrder.createdAt ? String(salesOrder.createdAt).trim() : null,
    items: Array.isArray(salesOrder.items) ? salesOrder.items : [],
  };
}

async function getStoredValue(app, key) {
  let raw = null;

  try {
    const segment = getCacheSegment(app);
    raw = await segment.getValue(key);
  } catch {
    raw = memoryCheckoutStore.get(key) || null;
  }

  if (!raw) {
    raw = memoryCheckoutStore.get(key) || null;
  }

  return raw;
}

async function putStoredValue(app, key, value) {
  try {
    const segment = getCacheSegment(app);
    await segment.put(key, value, CHECKOUT_CACHE_TTL_HOURS);
  } catch {
    // Memory fallback below.
  } finally {
    memoryCheckoutStore.set(key, value);
  }
}

async function deleteStoredValue(app, key) {
  try {
    const segment = getCacheSegment(app);
    if (typeof segment.delete === "function") {
      await segment.delete(key);
    }
  } catch {
    // Memory fallback below.
  } finally {
    memoryCheckoutStore.delete(key);
  }
}

async function getCheckoutStatusByTrip(app, tripId) {
  const safeTripId = String(tripId || "").trim();
  if (!safeTripId) return normalizeStatusRecord(null, "");

  const raw = await getStoredValue(app, checkoutTripKey(safeTripId));
  if (!raw) return normalizeStatusRecord(null, safeTripId);

  try {
    return normalizeStatusRecord(JSON.parse(raw), safeTripId);
  } catch {
    return normalizeStatusRecord(null, safeTripId);
  }
}

async function setCheckoutStatus(app, statusRecord) {
  const record = normalizeStatusRecord(statusRecord, statusRecord?.tripId || "");
  const safeTripId = String(record.tripId || "").trim();
  if (!safeTripId) {
    throw new Error("Missing tripId for checkout status");
  }

  const serialized = JSON.stringify({
    ...record,
    cartSnapshot: record.cartSnapshot || null,
    salesOrder: record.salesOrder || null,
    salesOrderError: record.salesOrderError || null,
    finalizedAt: record.finalizedAt || null,
    updatedAt: new Date().toISOString(),
  });

  await putStoredValue(app, checkoutTripKey(safeTripId), serialized);

  if (record.checkoutSessionId) {
    await putStoredValue(app, checkoutSessionKey(record.checkoutSessionId), serialized);
  }

  return JSON.parse(serialized);
}

async function getCheckoutStatusBySession(app, sessionId) {
  const safeSessionId = String(sessionId || "").trim();
  if (!safeSessionId) return null;

  const raw = await getStoredValue(app, checkoutSessionKey(safeSessionId));
  if (!raw) return null;

  try {
    return normalizeStatusRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function clearCheckoutStatus(app, tripId, sessionId) {
  const safeTripId = String(tripId || "").trim();
  const safeSessionId = String(sessionId || "").trim();

  if (safeTripId) {
    await deleteStoredValue(app, checkoutTripKey(safeTripId));
  }

  if (safeSessionId) {
    await deleteStoredValue(app, checkoutSessionKey(safeSessionId));
  }

  return {
    tripId: safeTripId,
    status: "idle",
    checkoutSessionId: null,
    paymentStatus: null,
    stripeEventId: null,
    amountTotal: null,
    currency: null,
    customerEmail: null,
    cartSnapshot: null,
    salesOrder: null,
    salesOrderError: null,
    updatedAt: null,
  };
}

module.exports = {
  getCheckoutStatusByTrip,
  getCheckoutStatusBySession,
  setCheckoutStatus,
  clearCheckoutStatus,
};
