"use strict";

const { getCacheSegment } = require("./cache");
const { hashKey } = require("../utils/helpers");

const CART_CACHE_TTL_HOURS = Number(process.env.CART_CACHE_TTL_HOURS || 24 * 30);
const memoryCartStore = new Map();

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeOptionalString(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeUnitPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCartOwner(ownerKey) {
  return String(ownerKey || "").trim();
}

function buildCartCacheKey(ownerKey, tripId) {
  return `cart_${hashKey(normalizeCartOwner(ownerKey))}_${hashKey(String(tripId || "").trim())}`;
}

function buildSessionCartOwnerKey(sessionToken) {
  const safeToken = String(sessionToken || "").trim();
  return safeToken ? `session_${hashKey(safeToken)}` : "";
}

function normalizeCartItem(item) {
  if (!item || typeof item !== "object") return null;

  const productId = normalizeOptionalString(item.productId);
  const productName = normalizeOptionalString(item.productName);
  const quantity = normalizeQuantity(item.quantity);

  if (!productId || !productName || quantity <= 0) return null;

  return {
    productId,
    productName,
    productCode: normalizeOptionalString(item.productCode),
    category: normalizeOptionalString(item.category),
    unitPrice: normalizeUnitPrice(item.unitPrice),
    quantity,
    imageDownloadKey: normalizeOptionalString(item.imageDownloadKey),
    imageAlt: normalizeOptionalString(item.imageAlt),
    vendorName: normalizeOptionalString(item.vendorName),
  };
}

function calculateCartTotals(items) {
  const normalizedItems = Array.isArray(items) ? items.map(normalizeCartItem).filter(Boolean) : [];
  const subtotal = normalizedItems.reduce((sum, item) => {
    const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : 0;
    return sum + unitPrice * item.quantity;
  }, 0);
  const totalItems = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: normalizedItems,
    subtotal,
    totalItems,
  };
}

async function readCart(app, ownerKey, tripId) {
  const safeTripId = String(tripId || "").trim();
  if (!safeTripId) {
    return {
      tripId: "",
      items: [],
      subtotal: 0,
      totalItems: 0,
      updatedAt: null,
    };
  }

  const key = buildCartCacheKey(ownerKey, safeTripId);
  let raw = null;

  try {
    const segment = getCacheSegment(app);
    raw = await segment.getValue(key);
  } catch {
    raw = memoryCartStore.get(key) || null;
  }

  if (!raw) {
    raw = memoryCartStore.get(key) || null;
  }

  if (!raw) {
    return {
      tripId: safeTripId,
      items: [],
      subtotal: 0,
      totalItems: 0,
      updatedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const totals = calculateCartTotals(parsed?.items);
    return {
      tripId: safeTripId,
      items: totals.items,
      subtotal: totals.subtotal,
      totalItems: totals.totalItems,
      updatedAt: parsed?.updatedAt || null,
    };
  } catch {
    return {
      tripId: safeTripId,
      items: [],
      subtotal: 0,
      totalItems: 0,
      updatedAt: null,
    };
  }
}

async function writeCart(app, ownerKey, tripId, items) {
  const safeTripId = String(tripId || "").trim();
  const key = buildCartCacheKey(ownerKey, safeTripId);
  const totals = calculateCartTotals(items);
  const payload = {
    tripId: safeTripId,
    items: totals.items,
    updatedAt: new Date().toISOString(),
  };
  const serializedPayload = JSON.stringify(payload);

  try {
    const segment = getCacheSegment(app);
    await segment.put(key, serializedPayload, CART_CACHE_TTL_HOURS);
  } catch {
    // Fallback is handled by the mirrored in-memory store below.
  } finally {
    memoryCartStore.set(key, serializedPayload);
  }

  return {
    tripId: safeTripId,
    items: totals.items,
    subtotal: totals.subtotal,
    totalItems: totals.totalItems,
    updatedAt: payload.updatedAt,
  };
}

async function getCart(app, ownerKey, tripId) {
  return readCart(app, ownerKey, tripId);
}

async function addCartItem(app, ownerKey, tripId, item, quantity) {
  const safeQuantity = normalizeQuantity(quantity);
  if (safeQuantity <= 0) {
    return readCart(app, ownerKey, tripId);
  }

  const current = await readCart(app, ownerKey, tripId);
  const normalizedItem = normalizeCartItem({
    ...item,
    quantity: safeQuantity,
  });

  if (!normalizedItem) {
    throw new Error("Invalid cart item");
  }

  const existingIndex = current.items.findIndex((entry) => entry.productId === normalizedItem.productId);

  if (existingIndex >= 0) {
    const next = [...current.items];
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: next[existingIndex].quantity + safeQuantity,
    };
    return writeCart(app, ownerKey, tripId, next);
  }

  return writeCart(app, ownerKey, tripId, [...current.items, normalizedItem]);
}

async function setCartItemQuantity(app, ownerKey, tripId, productId, quantity) {
  const safeProductId = String(productId || "").trim();
  const safeQuantity = normalizeQuantity(quantity);
  const current = await readCart(app, ownerKey, tripId);

  const next = current.items
    .map((item) =>
      item.productId === safeProductId
        ? {
            ...item,
            quantity: safeQuantity,
          }
        : item
    )
    .filter((item) => item.quantity > 0);

  return writeCart(app, ownerKey, tripId, next);
}

async function removeCartItem(app, ownerKey, tripId, productId) {
  const safeProductId = String(productId || "").trim();
  const current = await readCart(app, ownerKey, tripId);
  const next = current.items.filter((item) => item.productId !== safeProductId);
  return writeCart(app, ownerKey, tripId, next);
}

async function clearCart(app, ownerKey, tripId) {
  return writeCart(app, ownerKey, tripId, []);
}

async function replaceCart(app, ownerKey, tripId, items) {
  return writeCart(app, ownerKey, tripId, items);
}

module.exports = {
  buildSessionCartOwnerKey,
  getCart,
  addCartItem,
  setCartItemQuantity,
  removeCartItem,
  clearCart,
  replaceCart,
};
