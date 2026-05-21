"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSessionToken } from "@/lib/auth";
import { getApiBase } from "@/lib/api";

const SHOP_CART_EVENT = "zyba-shop-cart-updated";
const EMPTY_CART: ShopCartItem[] = [];
const cartSnapshotCache = new Map<string, { raw: string; items: ShopCartItem[] }>();
const cartSyncInFlight = new Map<
  string,
  Promise<{
    tripId: string;
    items: ShopCartItem[];
    subtotal: number;
    totalItems: number;
    updatedAt: string | null;
  }>
>();
const cartOperationQueue = new Map<string, Promise<unknown>>();

export type ShopCartItem = {
  productId: string;
  productName: string;
  productCode?: string | null;
  category?: string | null;
  unitPrice: number | null;
  quantity: number;
  imageDownloadKey?: string | null;
  imageAlt?: string | null;
  vendorName?: string | null;
};

type ShopCartResponse = {
  tripId?: string;
  items?: ShopCartItem[];
  subtotal?: number;
  totalItems?: number;
  updatedAt?: string | null;
};

type ShopCartApiResult =
  | {
      ok: true;
      data: ShopCartResponse;
    }
  | {
      ok: false;
      error: string;
    };

type ShopCartUpdateKind = "sync" | "add" | "update" | "remove" | "clear";

function getCartKey(tripId: string) {
  return `zyba_shop_cart:${String(tripId || "").trim()}`;
}

function emitCartUpdate(tripId: string, kind: ShopCartUpdateKind = "sync") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SHOP_CART_EVENT, {
      detail: {
        tripId,
        kind,
      },
    })
  );
}

function withSessionToken(url: string, sessionToken: string) {
  const token = String(sessionToken || "").trim();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}sessionToken=${encodeURIComponent(token)}`;
}

function normalizeQuantity(value: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeOptionalString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeUnitPrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCartItems(items: unknown): ShopCartItem[] {
  if (!Array.isArray(items)) return EMPTY_CART;

  const normalized = items
    .map((item) => ({
      productId: String((item as ShopCartItem | null | undefined)?.productId || "").trim(),
      productName: String((item as ShopCartItem | null | undefined)?.productName || "").trim(),
      productCode: normalizeOptionalString((item as ShopCartItem | null | undefined)?.productCode),
      category: normalizeOptionalString((item as ShopCartItem | null | undefined)?.category),
      unitPrice: normalizeUnitPrice((item as ShopCartItem | null | undefined)?.unitPrice),
      quantity: normalizeQuantity((item as ShopCartItem | null | undefined)?.quantity || 0),
      imageDownloadKey: normalizeOptionalString((item as ShopCartItem | null | undefined)?.imageDownloadKey),
      imageAlt: normalizeOptionalString((item as ShopCartItem | null | undefined)?.imageAlt),
      vendorName: normalizeOptionalString((item as ShopCartItem | null | undefined)?.vendorName),
    }))
    .filter((item) => item.productId && item.productName && item.quantity > 0);

  return normalized.length > 0 ? normalized : EMPTY_CART;
}

export function readShopCart(tripId: string): ShopCartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;

  try {
    const storageKey = getCartKey(tripId);
    const raw = localStorage.getItem(storageKey) || "";
    if (!raw) {
      cartSnapshotCache.delete(storageKey);
      return EMPTY_CART;
    }

    const cached = cartSnapshotCache.get(storageKey);
    if (cached && cached.raw === raw) {
      return cached.items;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cartSnapshotCache.delete(storageKey);
      return EMPTY_CART;
    }

    const stableItems = normalizeCartItems(parsed);
    cartSnapshotCache.set(storageKey, {
      raw,
      items: stableItems,
    });

    return stableItems;
  } catch {
    return EMPTY_CART;
  }
}

function writeShopCart(tripId: string, items: ShopCartItem[], kind: ShopCartUpdateKind = "sync") {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(tripId), JSON.stringify(normalizeCartItems(items)));
  emitCartUpdate(tripId, kind);
}

function clearShopCartStorage(tripId: string, kind: ShopCartUpdateKind = "clear") {
  if (typeof window === "undefined") return;
  cartSnapshotCache.delete(getCartKey(tripId));
  localStorage.removeItem(getCartKey(tripId));
  emitCartUpdate(tripId, kind);
}

export function clearShopCartSnapshot(tripId: string) {
  clearShopCartStorage(tripId);
}

export function clearAllShopCartSnapshots() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("zyba_shop_cart:")) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    cartSnapshotCache.delete(key);
    localStorage.removeItem(key);
  }

  window.dispatchEvent(new CustomEvent(SHOP_CART_EVENT, { detail: { kind: "clear" } }));
}

async function parseCartResponse(response: Response): Promise<ShopCartApiResult> {
  const text = await response.text();

  try {
    const body = JSON.parse(text) as {
      ok?: boolean;
      data?: ShopCartResponse;
      error?: string;
      message?: string;
    };

    if (!response.ok || !body?.ok) {
      return {
        ok: false as const,
        error: body?.error || body?.message || "Failed to update cart",
      };
    }

    return {
      ok: true as const,
      data: body.data || {},
    };
  } catch {
    return {
      ok: false as const,
      error: text || "Invalid cart response",
    };
  }
}

function applyBackendCart(tripId: string, cart?: ShopCartResponse, kind: ShopCartUpdateKind = "sync") {
  const items = normalizeCartItems(cart?.items || []);
  if (items.length > 0) {
    writeShopCart(tripId, items, kind);
  } else {
    clearShopCartStorage(tripId, kind);
  }

  return {
    tripId,
    items,
    subtotal: getShopCartSubtotal(items),
    totalItems: getShopCartTotalItems(items),
    updatedAt: cart?.updatedAt || null,
  };
}

function runCartOperation<T>(tripId: string, operation: () => Promise<T>) {
  const safeTripId = String(tripId || "").trim();
  const previous = cartOperationQueue.get(safeTripId) || Promise.resolve();

  const next = previous
    .catch(() => undefined)
    .then(operation);

  cartOperationQueue.set(safeTripId, next);

  return next.finally(() => {
    if (cartOperationQueue.get(safeTripId) === next) {
      cartOperationQueue.delete(safeTripId);
    }
  });
}

async function authorizedCartRequest(path: string, init?: RequestInit): Promise<ShopCartApiResult> {
  if (typeof window === "undefined") {
    return {
      ok: false,
      error: "Cart requests are only available in the browser",
    };
  }
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error("Missing session");
  }

  const response = await fetch(withSessionToken(`${getApiBase()}${path}`, sessionToken), {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      "X-Session-Token": sessionToken,
      ...(init?.headers || {}),
    },
  });

  return parseCartResponse(response);
}

export async function syncShopCart(tripId: string) {
  const safeTripId = String(tripId || "").trim();
  if (!safeTripId || typeof window === "undefined") {
    return {
      tripId: safeTripId,
      items: EMPTY_CART,
      subtotal: 0,
      totalItems: 0,
      updatedAt: null,
    };
  }

  const inFlight = cartSyncInFlight.get(safeTripId);
  if (inFlight) {
    return inFlight;
  }

  const syncPromise = (async () => {
    const result = await authorizedCartRequest(`/crm/cart?tripId=${encodeURIComponent(safeTripId)}`, {
      method: "GET",
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return applyBackendCart(safeTripId, result.data, "sync");
  })();

  cartSyncInFlight.set(safeTripId, syncPromise);

  return syncPromise.finally(() => {
    if (cartSyncInFlight.get(safeTripId) === syncPromise) {
      cartSyncInFlight.delete(safeTripId);
    }
  });
}

export async function addItemToShopCart(
  tripId: string,
  item: Omit<ShopCartItem, "quantity">,
  quantity: number
) {
  const safeTripId = String(tripId || "").trim();
  const safeQuantity = normalizeQuantity(quantity);
  if (!safeTripId || safeQuantity <= 0) {
    return {
      tripId: safeTripId,
      items: readShopCart(safeTripId),
      subtotal: getShopCartSubtotal(readShopCart(safeTripId)),
      totalItems: getShopCartTotalItems(readShopCart(safeTripId)),
      updatedAt: null,
    };
  }

  return runCartOperation(safeTripId, async () => {
    const result = await authorizedCartRequest("/crm/cart/items", {
      method: "POST",
      body: JSON.stringify({
        tripId: safeTripId,
        item,
        quantity: safeQuantity,
      }),
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return applyBackendCart(safeTripId, result.data, "add");
  });
}

export async function setShopCartItemQuantity(tripId: string, productId: string, quantity: number) {
  const safeTripId = String(tripId || "").trim();
  const safeProductId = String(productId || "").trim();

  return runCartOperation(safeTripId, async () => {
    const result = await authorizedCartRequest(
      `/crm/cart/items/${encodeURIComponent(safeProductId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          tripId: safeTripId,
          quantity: normalizeQuantity(quantity),
        }),
      }
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    return applyBackendCart(safeTripId, result.data, "update");
  });
}

export async function removeShopCartItem(tripId: string, productId: string) {
  const safeTripId = String(tripId || "").trim();
  const safeProductId = String(productId || "").trim();
  return runCartOperation(safeTripId, async () => {
    const result = await authorizedCartRequest(
      `/crm/cart/items/${encodeURIComponent(safeProductId)}?tripId=${encodeURIComponent(safeTripId)}`,
      {
        method: "DELETE",
      }
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    return applyBackendCart(safeTripId, result.data, "remove");
  });
}

export async function clearShopCart(tripId: string) {
  const safeTripId = String(tripId || "").trim();
  return runCartOperation(safeTripId, async () => {
    const result = await authorizedCartRequest(`/crm/cart?tripId=${encodeURIComponent(safeTripId)}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return applyBackendCart(safeTripId, result.data, "clear");
  });
}

export function getShopCartSubtotal(items: ShopCartItem[]) {
  return items.reduce((sum, item) => {
    const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : 0;
    return sum + unitPrice * item.quantity;
  }, 0);
}

export function getShopCartTotalItems(items: ShopCartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function useShopCart(tripId: string) {
  const items = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined" || !tripId) {
        return () => {};
      }

      function handleStorage(event: StorageEvent) {
        if (event.key && event.key !== getCartKey(tripId)) return;
        onStoreChange();
      }

      function handleCartUpdate(event: Event) {
        const customEvent = event as CustomEvent<{ tripId?: string }>;
        if (customEvent.detail?.tripId && customEvent.detail.tripId !== tripId) return;
        onStoreChange();
      }

      window.addEventListener("storage", handleStorage);
      window.addEventListener(SHOP_CART_EVENT, handleCartUpdate as EventListener);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(SHOP_CART_EVENT, handleCartUpdate as EventListener);
      };
    },
    () => (tripId ? readShopCart(tripId) : EMPTY_CART),
    () => EMPTY_CART
  );

  useEffect(() => {
    if (!tripId || typeof window === "undefined") return;

    void syncShopCart(tripId).catch(() => {
      // Keep the last local snapshot if backend sync fails.
    });
  }, [tripId]);

  const subtotal = useMemo(() => getShopCartSubtotal(items), [items]);
  const totalItems = useMemo(() => getShopCartTotalItems(items), [items]);

  return {
    items,
    subtotal,
    totalItems,
  };
}

export function useShopCartAddPulse(tripId: string) {
  const [pulseNonce, setPulseNonce] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !tripId) return;

    function handleCartUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ tripId?: string; kind?: ShopCartUpdateKind }>;
      if (customEvent.detail?.tripId && customEvent.detail.tripId !== tripId) return;
      if (customEvent.detail?.kind !== "add") return;
      setPulseNonce((current) => current + 1);
    }

    window.addEventListener(SHOP_CART_EVENT, handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener(SHOP_CART_EVENT, handleCartUpdate as EventListener);
    };
  }, [tripId]);

  return pulseNonce;
}
