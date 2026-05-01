"use client";

import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getSessionToken } from "@/lib/auth";
import {
  createCheckoutSession,
  getCheckoutStatus,
  getTraveler,
  type ApiResponse,
  type CheckoutStatusResponse,
} from "@/lib/api";
import {
  clearShopCart,
  removeShopCartItem,
  setShopCartItemQuantity,
  useShopCart,
} from "@/lib/shop-cart";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

type CheckoutStatus = {
  status?: string | null;
  paymentStatus?: string | null;
  updatedAt?: string | null;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export default function ShopCartPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const { items, subtotal, totalItems } = useShopCart(tripId);
  const discounts = 0;
  const shipping = 0;
  const total = Math.max(0, subtotal - discounts + shipping);
  const isCheckoutPaid =
    checkoutStatus?.status === "paid" ||
    checkoutStatus?.status === "paid_finalized" ||
    checkoutStatus?.paymentStatus === "paid";
  const isCheckoutPending =
    checkoutStatus?.status === "pending" ||
    checkoutStatus?.paymentStatus === "processing" ||
    checkoutStatus?.paymentStatus === "unpaid";

  const refreshCheckoutStatus = useEffectEvent(async (token: string, options?: { silent?: boolean }) => {
    if (!tripId) return;

    const result = await getCheckoutStatus(token, tripId);
    if (result.ok) {
      setCheckoutStatus((result.data as CheckoutStatus) || null);
      return;
    }

    if (!options?.silent) {
      setMessage(result.error || result.message || "Failed to load checkout status.");
    }
  });

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    async function loadTraveler() {
      setSessionToken(token);
      const travelerPromise = getTraveler(token);
      const statusPromise: Promise<ApiResponse<CheckoutStatusResponse>> = tripId
        ? getCheckoutStatus(token, tripId)
        : Promise.resolve({ ok: false });
      const [travelerResult, checkoutStatusResult] = await Promise.all([travelerPromise, statusPromise]);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
      if (checkoutStatusResult.ok) {
        setCheckoutStatus((checkoutStatusResult.data as CheckoutStatus) || null);
      }
    }

    void loadTraveler();
  }, [router, tripId]);

  useEffect(() => {
    const checkoutStatus = searchParams?.get("checkout");
    if (checkoutStatus === "success") {
      setMessage("Payment received by Stripe. We are validating confirmation now.");
      return;
    }

    if (checkoutStatus === "cancel") {
      setMessage("Payment cancelled. Your tackle box is still saved.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!sessionToken || !tripId || !isCheckoutPending) return;

    const poll = window.setInterval(() => {
      void refreshCheckoutStatus(sessionToken, { silent: true });
    }, 4000);

    return () => {
      window.clearInterval(poll);
    };
  }, [isCheckoutPending, sessionToken, tripId]);

  useEffect(() => {
    if (isCheckoutPaid) {
      setMessage("Payment confirmed. Your order is secured and your tackle box is now locked.");
    }
  }, [isCheckoutPaid]);

  async function changeQuantity(productId: string, delta: number, currentQuantity: number) {
    try {
      await setShopCartItemQuantity(tripId, productId, Math.max(0, currentQuantity + delta));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update quantity.");
    }
  }

  async function handleRemove(productId: string, productName: string) {
    try {
      await removeShopCartItem(tripId, productId);
      setMessage(`${productName} removed from cart.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove item.");
    }
  }

  async function handleClearCart() {
    try {
      await clearShopCart(tripId);
      setMessage("Cart cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to clear cart.");
    }
  }

  async function handlePayNow() {
    if (!tripId || !sessionToken || items.length === 0 || checkoutLoading) return;

    try {
      setCheckoutLoading(true);
      setMessage("");
      const result = await createCheckoutSession(sessionToken, tripId);

      if (!result.ok || !result.data?.url) {
        setMessage(result.error || result.message || "Failed to start checkout.");
        return;
      }

      setCheckoutStatus({
        status: "pending",
        paymentStatus: "unpaid",
        updatedAt: new Date().toISOString(),
      });

      window.location.href = result.data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <main className="trip-details-page">
      <AppTopBar
        firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"}
        cartHref={`/trips/${tripId}/shop-gears/cart`}
        cartCount={totalItems}
      />

      <section className="trip-details-body">
        <div className="shop-gears-shell">
          <section className="shop-gears-section">
            <div className="shop-gears-section-head">
              <h5 className="trip-details-section-title">Your Tackle Box</h5>
              <span className="shop-gears-section-chip">{totalItems} items</span>
            </div>

            <div className="shop-gears-cart-summary">
              <div className="shop-gears-cart-summary-copy">
                <span className="shop-gears-detail-label">Subtotal</span>
                <p className="shop-gears-detail-value">{formatCurrency(subtotal)}</p>
              </div>

              {!isCheckoutPaid ? (
                <button type="button" className="shop-gears-cart-clear-btn" onClick={() => void handleClearCart()}>
                  CLEAR CART
                </button>
              ) : null}
            </div>

            {checkoutStatus?.status && checkoutStatus.status !== "idle" ? (
              <div className={`shop-gears-api-card${isCheckoutPaid ? " is-success" : ""}`}>
                <p className="shop-gears-api-purpose">
                  Checkout status: {checkoutStatus.status}
                  {checkoutStatus.paymentStatus ? ` · Stripe: ${checkoutStatus.paymentStatus}` : ""}
                </p>
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="shop-gears-api-group">
                {items.map((item) => {
                  const imageSrc =
                    item.imageDownloadKey && sessionToken
                      ? `/api/crm/files/${encodeURIComponent(item.imageDownloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`
                      : "";

                  return (
                    <article key={item.productId} className="shop-gears-cart-item-card">
                      <div className="shop-gears-product-media">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={item.imageAlt || item.productName}
                            width={72}
                            height={72}
                            className="shop-gears-product-image"
                            unoptimized
                          />
                        ) : (
                          <div className="shop-gears-product-image shop-gears-product-image-placeholder">
                            <span className="shop-gears-product-image-placeholder-text">No image</span>
                          </div>
                        )}
                      </div>

                      <div className="shop-gears-cart-item-content">
                        <div className="shop-gears-product-line-copy">
                          <p className="shop-gears-product-name">{item.productName}</p>
                          <p className="shop-gears-product-price">{formatCurrency(item.unitPrice)}</p>
                        </div>

                        <div className="shop-gears-product-actions">
                          <div className="shop-gears-qty-picker" aria-label="Quantity selector">
                            <button
                              type="button"
                              className="shop-gears-qty-btn"
                              disabled={isCheckoutPaid}
                              onClick={() => void changeQuantity(item.productId, -1, item.quantity)}
                              aria-label={`Decrease quantity for ${item.productName}`}
                            >
                              -
                            </button>
                            <span className="shop-gears-qty-value">{item.quantity}</span>
                            <button
                              type="button"
                              className="shop-gears-qty-btn"
                              disabled={isCheckoutPaid}
                              onClick={() => void changeQuantity(item.productId, 1, item.quantity)}
                              aria-label={`Increase quantity for ${item.productName}`}
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            className="shop-gears-cart-remove-btn"
                            disabled={isCheckoutPaid}
                            onClick={() => void handleRemove(item.productId, item.productName)}
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="shop-gears-api-card">
                <p className="shop-gears-api-purpose">Your cart is empty.</p>
              </div>
            )}

            <div className="shop-gears-checkout-card">
              <div className="shop-gears-checkout-row">
                <span className="shop-gears-detail-label">Subtotal</span>
                <span className="shop-gears-detail-value">{formatCurrency(subtotal)}</span>
              </div>
              <div className="shop-gears-checkout-row">
                <span className="shop-gears-detail-label">Discounts</span>
                <span className="shop-gears-detail-value">{formatCurrency(discounts)}</span>
              </div>
              <div className="shop-gears-checkout-row">
                <span className="shop-gears-detail-label">Shipping</span>
                <span className="shop-gears-detail-value">{formatCurrency(shipping)}</span>
              </div>
              <div className="shop-gears-checkout-row is-total">
                <span className="shop-gears-detail-label">Total</span>
                <span className="shop-gears-detail-value">{formatCurrency(total)}</span>
              </div>

              {!isCheckoutPaid ? (
                <button
                  type="button"
                  className="shop-gears-pay-btn"
                  disabled={items.length === 0 || checkoutLoading}
                  onClick={() => void handlePayNow()}
                >
                  {checkoutLoading ? "OPENING CHECKOUT..." : "PAY NOW"}
                </button>
              ) : (
                <div className="shop-gears-paid-note">
                  <span className="shop-gears-detail-label">Payment confirmed</span>
                  <span className="shop-gears-detail-value">Your tackle box is locked for order processing.</span>
                </div>
              )}
            </div>
          </section>

          {message ? (
            <p className="shop-gears-message" role="status">
              {message}
            </p>
          ) : null}

          <div className="trip-back-action">
            <TripBackLink href={`/trips/${tripId}/shop-gears`} />
          </div>
        </div>
      </section>
    </main>
  );
}
