"use client";

import AddTackleButton, { type AddTackleButtonState } from "@/components/AddTackleButton";
import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getSessionToken } from "@/lib/auth";
import { getTraveler } from "@/lib/api";
import { addItemToShopCart, useShopCart, useShopCartAddPulse } from "@/lib/shop-cart";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

type ProductDetailResponse = {
  product?: {
    id?: string | null;
    productName?: string | null;
    productCode?: string | null;
    unitPrice?: number | null;
    vendorName?: {
      id?: string | null;
      name?: string | null;
    } | null;
    category?: string | null;
    productImageCatalog?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
    productImageReal?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
  } | null;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function GearsDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const productId = useMemo(() => {
    const raw = params?.productId;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [product, setProduct] = useState<ProductDetailResponse["product"] | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [addButtonState, setAddButtonState] = useState<AddTackleButtonState>("idle");
  const [feedback, setFeedback] = useState<{ id: number; kind: "added"; productName: string } | null>(null);
  const { totalItems } = useShopCart(tripId);
  const cartPulseNonce = useShopCartAddPulse(tripId);

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

      const [travelerResult, productResponse] = await Promise.all([
        getTraveler(token),
        fetch(`/api/crm/products/${productId}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Session-Token": token,
          },
        }),
      ]);

      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }

      const body = (await productResponse.json()) as {
        ok: boolean;
        data?: ProductDetailResponse;
        error?: string;
        message?: string;
      };

      if (!productResponse.ok || !body.ok || !body.data?.product) {
        setMessage(body.error || body.message || "Failed to load product details.");
        setLoading(false);
        return;
      }

      setProduct(body.data.product);
      setActiveImageIndex(0);
      setLoading(false);
    }

    if (productId) {
      void loadData();
    }
  }, [router, productId]);

  const images = [
    ...(Array.isArray(product?.productImageCatalog) ? product.productImageCatalog : []),
    ...(Array.isArray(product?.productImageReal) ? product.productImageReal : []),
  ]
    .map((image, index) => {
      const downloadKey = String(image?.downloadKey || "").trim();
      if (!downloadKey || !sessionToken) return null;
      return {
        id: `${downloadKey}-${index}`,
        src: `/api/crm/files/${encodeURIComponent(downloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`,
        alt: String(image?.fileName || product?.productName || "Product image"),
      };
    })
    .filter((image): image is { id: string; src: string; alt: string } => Boolean(image));

  const activeImage = images[activeImageIndex] || null;

  function changeQuantity(delta: number) {
    setQuantity((current) => Math.max(0, current + delta));
  }

  async function handleAddToCart() {
    if (!product?.id) return;
    if (quantity <= 0) {
      setMessage("Select a quantity before adding to cart.");
      return;
    }
    if (addButtonState !== "idle") return;

    setAddButtonState("adding");

    try {
      await Promise.all([
        addItemToShopCart(
          tripId,
          {
            productId: product.id,
            productName: product.productName || "Product",
            productCode: product.productCode || null,
            category: product.category || null,
            unitPrice: typeof product.unitPrice === "number" ? product.unitPrice : null,
            imageDownloadKey: product.productImageCatalog?.[0]?.downloadKey || product.productImageReal?.[0]?.downloadKey || null,
            imageAlt: product.productImageCatalog?.[0]?.fileName || product.productImageReal?.[0]?.fileName || product.productName || null,
            vendorName: product.vendorName?.name || null,
          },
          quantity
        ),
        wait(950),
      ]);

      setMessage("");
      setAddButtonState("added");
      const feedbackId = Date.now();
      setFeedback({
        id: feedbackId,
        kind: "added",
        productName: product.productName || "Product",
      });
      window.setTimeout(() => {
        setAddButtonState("idle");
      }, 1200);
      window.setTimeout(() => {
        setFeedback((current) => (current?.id === feedbackId ? null : current));
      }, 2000);
      setQuantity(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add item to cart.");
      setAddButtonState("idle");
    }
  }

  function showPreviousImage() {
    setActiveImageIndex((current) => {
      if (images.length === 0) return 0;
      return current === 0 ? images.length - 1 : current - 1;
    });
  }

  function showNextImage() {
    setActiveImageIndex((current) => {
      if (images.length === 0) return 0;
      return current === images.length - 1 ? 0 : current + 1;
    });
  }

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
          {loading ? (
            <div className="shop-gears-api-card">
              <p className="shop-gears-api-purpose">Loading product details...</p>
            </div>
          ) : product ? (
            <>
              <section className="shop-gears-detail-card">
                <div className="shop-gears-carousel">
                  <div className="shop-gears-carousel-stage">
                    {activeImage ? (
                      <Image
                        src={activeImage.src}
                        alt={activeImage.alt}
                        width={340}
                        height={240}
                        className="shop-gears-carousel-image"
                        unoptimized
                      />
                    ) : (
                      <div className="shop-gears-carousel-image shop-gears-product-image-placeholder">
                        <span className="shop-gears-product-image-placeholder-text">No image</span>
                      </div>
                    )}

                    {images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="shop-gears-carousel-nav is-prev"
                          onClick={showPreviousImage}
                          aria-label="Previous image"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="shop-gears-carousel-nav is-next"
                          onClick={showNextImage}
                          aria-label="Next image"
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                  </div>

                  {images.length > 1 ? (
                    <div className="shop-gears-carousel-dots">
                      {images.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          className={`shop-gears-carousel-dot${index === activeImageIndex ? " is-active" : ""}`}
                          onClick={() => setActiveImageIndex(index)}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="shop-gears-detail-info">
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Name</span>
                    <p className="shop-gears-detail-value">{product.productName || "-"}</p>
                  </div>
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Code</span>
                    <p className="shop-gears-detail-value">{product.productCode || "-"}</p>
                  </div>
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Brand</span>
                    <p className="shop-gears-detail-value">{product.vendorName?.name || "-"}</p>
                  </div>
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Category</span>
                    <p className="shop-gears-detail-value">{product.category || "-"}</p>
                  </div>
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Price</span>
                    <p className="shop-gears-detail-value">{formatCurrency(product.unitPrice)}</p>
                  </div>
                </div>
              </section>

              <section className="shop-gears-detail-actions">
                <div className="shop-gears-qty-picker" aria-label="Quantity selector">
                  <button
                    type="button"
                    className="shop-gears-qty-btn"
                    onClick={() => changeQuantity(-1)}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="shop-gears-qty-value">{quantity}</span>
                  <button
                    type="button"
                    className="shop-gears-qty-btn"
                    onClick={() => changeQuantity(1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <AddTackleButton
                  state={addButtonState}
                  className="shop-gears-add-btn"
                  disabled={quantity <= 0}
                  onClick={() => void handleAddToCart()}
                />
              </section>
            </>
          ) : (
            <div className="shop-gears-api-card">
              <p className="shop-gears-api-purpose">Product not found.</p>
            </div>
          )}

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

          <div className="trip-back-action">
            <TripBackLink href={`/trips/${tripId}/shop-gears`} />
          </div>
        </div>
      </section>
    </main>
  );
}
