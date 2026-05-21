"use client";

import AppTopBar from "@/components/AppTopBar";
import { getSessionToken } from "@/lib/auth";
import { getTraveler, getTripDetails } from "@/lib/api";
import {
  addItemToShopCart,
  removeShopCartItem,
  useShopCart,
  useShopCartAddPulse,
} from "@/lib/shop-cart";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

type TripDetailsResponse = {
  trip?: {
    tripStatus?: string | null;
  } | null;
  deal?: {
    vendorName?: string | null;
    destination?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
};

type ProductListResponse = {
  items?: Array<{
    id?: string | null;
    productName?: string | null;
    productCode?: string | null;
    vendorName?: {
      id?: string | null;
      name?: string | null;
    } | null;
    category?: string | null;
    unitPrice?: number | null;
    productImageCatalog?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
    productRecommended?: boolean | string | number | null;
    productRecommendation?: boolean | string | number | null;
    highlyRecommended?: boolean | string | number | null;
    recommended?: boolean | string | number | null;
  }>;
  count?: number;
};

type ShopProduct = {
  id: string;
  productName: string;
  productCode: string;
  vendorName: string;
  category: string;
  unitPrice: number | null;
  imageDownloadKey: string;
  imageAlt: string;
  isRecommended: boolean;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function isRecommendedValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "1", "recommended", "essential", "highly recommended"].includes(normalized);
}

export default function ShopGearsPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [tripDetails, setTripDetails] = useState<TripDetailsResponse | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [addedProductId, setAddedProductId] = useState("");
  const [feedback, setFeedback] = useState<{ id: number; kind: "added"; productName: string } | null>(null);
  const { items: cartItems, subtotal, totalItems } = useShopCart(tripId);
  const cartPulseNonce = useShopCartAddPulse(tripId);
  const cartQuantityByProduct = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = item.quantity;
      return acc;
    }, {});
  }, [cartItems]);
  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((product) => product.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return ["All", ...unique];
  }, [products]);
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  useEffect(() => {
    async function loadData() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      setSessionToken(token);

      setLoading(true);
      setMessage("");

      const [travelerResult, tripResult] = await Promise.all([
        getTraveler(token),
        getTripDetails(token, tripId),
      ]);

      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }

      if (!tripResult.ok) {
        setMessage(tripResult.error || tripResult.message || "Failed to load trip.");
        setLoading(false);
        return;
      }

      const nextTripDetails = (tripResult.data as TripDetailsResponse) || null;
      setTripDetails(nextTripDetails);

      const destinationVendorId = String(nextTripDetails?.deal?.destination?.id || "").trim();

      if (!destinationVendorId) {
        setProducts([]);
        setMessage("This trip does not have a destination vendor linked to the deal.");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `/api/crm/products?destinationRelatedId=${encodeURIComponent(destinationVendorId)}&perPage=200&productActive=true`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Session-Token": token,
          },
        }
      );

      const body = (await response.json()) as {
        ok: boolean;
        data?: ProductListResponse;
        error?: string;
        message?: string;
      };

      if (!response.ok || !body.ok) {
        setProducts([]);
        setMessage(body.error || body.message || "Failed to load products.");
        setLoading(false);
        return;
      }

      const items = Array.isArray(body.data?.items) ? body.data?.items : [];
      setProducts(
        items
          .map((item) => ({
            id: String(item?.id || "").trim(),
            productName: String(item?.productName || "").trim(),
            productCode: String(item?.productCode || "").trim(),
            vendorName: String(item?.vendorName?.name || "").trim(),
            category: String(item?.category || "").trim(),
            unitPrice:
              typeof item?.unitPrice === "number" ? item.unitPrice : Number(item?.unitPrice ?? null),
            imageDownloadKey: String(item?.productImageCatalog?.[0]?.downloadKey || "").trim(),
            imageAlt: String(item?.productImageCatalog?.[0]?.fileName || item?.productName || "Product image"),
            isRecommended:
              isRecommendedValue(item?.productRecommended) ||
              isRecommendedValue(item?.productRecommendation) ||
              isRecommendedValue(item?.highlyRecommended) ||
              isRecommendedValue(item?.recommended),
          }))
          .filter((item) => item.id && item.productName)
          .map((item) => ({
            ...item,
            unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : null,
          }))
      );
      setQuantities((current) => {
        const next = { ...current };
        for (const item of items) {
          const id = String(item?.id || "").trim();
          if (id && !next[id]) {
            next[id] = 1;
          }
        }
        return next;
      });

      setLoading(false);
    }

    if (tripId) {
      void loadData();
    }
  }, [router, tripId]);

  function changeQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const nextValue = Math.max(1, (current[productId] || 1) + delta);
      return {
        ...current,
        [productId]: nextValue,
      };
    });
  }

  async function handleAddToCart(product: ShopProduct) {
    const quantity = quantities[product.id] ?? 1;
    if (quantity <= 0) {
      setMessage("Select a quantity before adding to cart.");
      return;
    }

    try {
      await addItemToShopCart(
        tripId,
        {
          productId: product.id,
          productName: product.productName,
          productCode: product.productCode || null,
          category: product.category || null,
          unitPrice: product.unitPrice,
          imageDownloadKey: product.imageDownloadKey || null,
          imageAlt: product.imageAlt || null,
          vendorName: product.vendorName || null,
        },
        quantity
      );

      setMessage("");
      setAddedProductId(product.id);
      const feedbackId = Date.now();
      setFeedback({
        id: feedbackId,
        kind: "added",
        productName: product.productName,
      });
      window.setTimeout(() => {
        setAddedProductId((current) => (current === product.id ? "" : current));
      }, 1400);
      window.setTimeout(() => {
        setFeedback((current) => (current?.id === feedbackId ? null : current));
      }, 2000);
      setQuantities((current) => ({
        ...current,
        [product.id]: 1,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add item to cart.");
    }
  }

  async function handleRemoveFromCart(product: ShopProduct) {
    try {
      await removeShopCartItem(tripId, product.id);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove item from cart.");
    }
  }

  const vendorName = tripDetails?.deal?.vendorName || tripDetails?.deal?.destination?.name || "Vendor";
  const tripStatus = tripDetails?.trip?.tripStatus || null;
  const floatingCartClassName = [
    "shop-gears-floating-cart",
    cartPulseNonce ? "is-pulsing" : "",
    subtotal >= 1000 ? "is-large-total" : "",
    subtotal >= 10000 ? "is-very-large-total" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="trip-details-page">
      <AppTopBar
        firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"}
        cartHref={`/trips/${tripId}/shop-gears/cart`}
        cartCount={totalItems}
        cartPulseNonce={cartPulseNonce}
      />

      <section className="trip-details-body">
        <div className="shop-gears-shell">
          <section className="shop-gears-catalog-hero">
            <h1 className="shop-gears-catalog-title">
              Essential gear for your
              <span className="shop-gears-catalog-title-destination">{vendorName}</span>
            </h1>
            {tripStatus ? <p className="shop-gears-catalog-meta">Trip status: {tripStatus}</p> : null}
          </section>

          <section className="shop-gears-section shop-gears-catalog-section">
            {products.length > 0 ? (
              <div className="shop-gears-category-filter" aria-label="Filter by category">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`shop-gears-category-chip${selectedCategory === category ? " is-active" : ""}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : null}

            {loading ? (
              <div className="shop-gears-api-card">
                <p className="shop-gears-api-purpose">Loading products...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="shop-gears-catalog-grid">
                {filteredProducts.map((product) => {
                  const cartQuantity = cartQuantityByProduct[product.id] || 0;
                  return (
                    <article key={product.id} className="shop-gears-catalog-card">
                      <div className="shop-gears-catalog-media">
                        {product.imageDownloadKey && sessionToken ? (
                          <Image
                            src={`/api/crm/files/${encodeURIComponent(product.imageDownloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`}
                            alt={product.imageAlt}
                            width={320}
                            height={210}
                            className="shop-gears-catalog-image"
                            unoptimized
                          />
                        ) : (
                          <div className="shop-gears-catalog-image shop-gears-product-image-placeholder">
                            <span className="shop-gears-product-image-placeholder-text">No image</span>
                          </div>
                        )}

                        {product.isRecommended ? (
                          <span className="shop-gears-recommended-badge">Essential</span>
                        ) : null}

                        <button
                          type="button"
                          className="shop-gears-info-btn"
                          aria-label={`View details for ${product.productName}`}
                          onClick={() => router.push(`/trips/${tripId}/shop-gears/${product.id}`)}
                        >
                          i
                        </button>
                      </div>

                      <div className="shop-gears-catalog-copy">
                        <p className="shop-gears-product-sku">SKU: {product.productCode || "-"}</p>
                        <p className="shop-gears-product-name">{product.productName}</p>
                        <p className="shop-gears-product-price">{formatCurrency(product.unitPrice)}</p>
                      </div>

                      <div className="shop-gears-product-actions">
                        <div className="shop-gears-qty-picker" aria-label="Quantity selector">
                          <button
                            type="button"
                            className="shop-gears-qty-btn"
                            onClick={() => changeQuantity(product.id, -1)}
                            aria-label={`Decrease quantity for ${product.productName}`}
                          >
                            -
                          </button>
                          <span className="shop-gears-qty-value">{quantities[product.id] ?? 1}</span>
                          <button
                            type="button"
                            className="shop-gears-qty-btn"
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label={`Increase quantity for ${product.productName}`}
                          >
                            +
                          </button>
                        </div>

                        <div className="shop-gears-action-stack">
                          {cartQuantity > 0 ? (
                            <button
                              type="button"
                              className="shop-gears-remove-inline-btn"
                              onClick={() => void handleRemoveFromCart(product)}
                            >
                              REMOVE
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className={`shop-gears-add-btn${addedProductId === product.id ? " is-added" : ""}`}
                            disabled={addedProductId === product.id}
                            onClick={() => void handleAddToCart(product)}
                          >
                            {addedProductId === product.id ? "ADDED" : "ADD TO CART"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="shop-gears-api-card">
                <p className="shop-gears-api-purpose">No products found for this category.</p>
              </div>
            )}
          </section>

          {feedback ? (
            <div className={`shop-gears-feedback is-${feedback.kind}`} role="status" aria-live="polite">
              <span className="shop-gears-feedback-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <path
                    d="M4.5 10.25 8.1 13.85 15.5 6.45"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="shop-gears-feedback-text">{feedback.productName} added to cart</span>
            </div>
          ) : null}

          {message ? (
            <p className="shop-gears-message" role="status">
              {message}
            </p>
          ) : null}

        </div>

        {totalItems > 0 ? (
          <Link
            key={cartPulseNonce}
            href={`/trips/${tripId}/shop-gears/cart`}
            className={floatingCartClassName}
            aria-label={`Tackle box, ${totalItems} items, total ${formatCurrency(subtotal)}`}
          >
            <span className="shop-gears-floating-cart-total-block">
              <span className="shop-gears-floating-cart-label">Total</span>
              <span className="shop-gears-floating-cart-total">{formatCurrency(subtotal)}</span>
            </span>
            <span className="shop-gears-floating-cart-divider" aria-hidden="true" />
            <span className="shop-gears-floating-cart-action">
              <span className="shop-gears-floating-cart-count">{totalItems}</span>
              <span className="shop-gears-floating-cart-text">Tackle box</span>
              <span className="shop-gears-floating-cart-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        ) : null}
      </section>
    </main>
  );
}
