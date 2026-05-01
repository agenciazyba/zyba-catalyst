"use client";

import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getSessionToken } from "@/lib/auth";
import { getTraveler, getTripDetails } from "@/lib/api";
import { addItemToShopCart, useShopCart } from "@/lib/shop-cart";
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
    unitPrice?: number | null;
    lureImageCatalog?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
  }>;
  count?: number;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
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
  const [products, setProducts] = useState<
    Array<{
      id: string;
      productName: string;
      productCode: string;
      vendorName: string;
      unitPrice: number | null;
      imageDownloadKey: string;
      imageAlt: string;
    }>
  >([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const { subtotal, totalItems } = useShopCart(tripId);

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
            unitPrice:
              typeof item?.unitPrice === "number" ? item.unitPrice : Number(item?.unitPrice ?? null),
            imageDownloadKey: String(item?.lureImageCatalog?.[0]?.downloadKey || "").trim(),
            imageAlt: String(item?.lureImageCatalog?.[0]?.fileName || item?.productName || "Product image"),
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
            next[id] = 0;
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
      const nextValue = Math.max(0, (current[productId] || 0) + delta);
      return {
        ...current,
        [productId]: nextValue,
      };
    });
  }

  async function handleAddToCart(product: {
    id: string;
    productName: string;
    productCode: string;
    vendorName: string;
    unitPrice: number | null;
    imageDownloadKey: string;
    imageAlt: string;
  }) {
    const quantity = quantities[product.id] ?? 0;
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
          unitPrice: product.unitPrice,
          imageDownloadKey: product.imageDownloadKey || null,
          imageAlt: product.imageAlt || null,
          vendorName: product.vendorName || null,
        },
        quantity
      );

      setMessage(`${product.productName} added to cart.`);
      setQuantities((current) => ({
        ...current,
        [product.id]: 0,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add item to cart.");
    }
  }

  const vendorName = tripDetails?.deal?.vendorName || tripDetails?.deal?.destination?.name || "Vendor";
  const tripStatus = tripDetails?.trip?.tripStatus || null;

  return (
    <main className="trip-details-page">
      <AppTopBar
        firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"}
        cartHref={`/trips/${tripId}/shop-gears/cart`}
        cartCount={totalItems}
      />

      <section className="trip-details-body">
        <div className="shop-gears-shell">
          <section className="shop-gears-hero">
            <span className="shop-gears-kicker">SHOP GEARS</span>
            <h5 className="trip-details-section-title shop-gears-title">Products</h5>
            <p className="shop-gears-summary">{vendorName}</p>
            {tripStatus ? <p className="shop-gears-summary">Trip status: {tripStatus}</p> : null}
          </section>

          <section className="shop-gears-section">
            <div className="shop-gears-cart-summary">
              <div className="shop-gears-cart-summary-copy">
                <span className="shop-gears-detail-label">Your Tackle Box</span>
                <p className="shop-gears-detail-value">
                  {totalItems} items · {formatCurrency(subtotal)}
                </p>
              </div>

              <Link href={`/trips/${tripId}/shop-gears/cart`} className="shop-gears-cart-link">
                VIEW CART
              </Link>
            </div>

            <div className="shop-gears-section-head">
              <h6 className="shop-gears-section-title">Product list</h6>
              <span className="shop-gears-section-chip">{products.length} items</span>
            </div>

            {loading ? (
              <div className="shop-gears-api-card">
                <p className="shop-gears-api-purpose">Loading products...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="shop-gears-api-group">
                {products.map((product) => (
                  <article key={product.id} className="shop-gears-product-line-card">
                    <div
                      className="shop-gears-product-line-clickzone is-clickable"
                      onClick={() => router.push(`/trips/${tripId}/shop-gears/${product.id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/trips/${tripId}/shop-gears/${product.id}`);
                        }
                      }}
                    >
                      <div className="shop-gears-product-media">
                        {product.imageDownloadKey && sessionToken ? (
                          <Image
                            src={`/api/crm/files/${encodeURIComponent(product.imageDownloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`}
                            alt={product.imageAlt}
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

                      <div className="shop-gears-product-line-copy">
                        <p className="shop-gears-product-name">{product.productName}</p>
                        <p className="shop-gears-product-price">{formatCurrency(product.unitPrice)}</p>
                      </div>
                    </div>

                    <div className="shop-gears-product-line-content">
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
                          <span className="shop-gears-qty-value">{quantities[product.id] ?? 0}</span>
                          <button
                            type="button"
                            className="shop-gears-qty-btn"
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label={`Increase quantity for ${product.productName}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="shop-gears-add-btn"
                          disabled={(quantities[product.id] ?? 0) <= 0}
                          onClick={() => void handleAddToCart(product)}
                        >
                          ADD TO CART
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="shop-gears-api-card">
                <p className="shop-gears-api-purpose">No products found for this destination vendor.</p>
              </div>
            )}
          </section>

          {message ? (
            <p className="shop-gears-message" role="status">
              {message}
            </p>
          ) : null}

          <div className="trip-back-action">
            <TripBackLink href={`/trips/${tripId}`} />
          </div>
        </div>
      </section>
    </main>
  );
}
