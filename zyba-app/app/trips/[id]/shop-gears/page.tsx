"use client";

import AddTackleButton, { type AddTackleButtonState } from "@/components/AddTackleButton";
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
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

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
    description?: string | null;
    unitPrice?: number | null;
    productImageCatalog?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
    productImageReal?: Array<{
      downloadKey?: string | null;
      fileName?: string | null;
    }> | null;
    essential?: boolean | string | number | null;
    productRecommended?: boolean | string | number | null;
    productRecommendation?: boolean | string | number | null;
    highlyRecommended?: boolean | string | number | null;
    recommended?: boolean | string | number | null;
  }>;
  count?: number;
};

type ProductCategoryOptionsResponse = {
  options?: Array<{
    id?: string | null;
    displayValue?: string | null;
    actualValue?: string | null;
  }>;
};

type CategoryFilterOption = {
  label: string;
  value: string;
};

type ProductImage = {
  downloadKey: string;
  fileName: string;
};

type ShopProduct = {
  id: string;
  productName: string;
  productCode: string;
  vendorName: string;
  category: string;
  description: string;
  unitPrice: number | null;
  imageDownloadKey: string;
  imageAlt: string;
  images: ProductImage[];
  isEssential: boolean;
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function isEssentialValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "1", "essential"].includes(normalized);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isVisibleCategoryOption(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && normalized !== "-none-" && normalized !== "none";
}

function buildProductImages(item: NonNullable<ProductListResponse["items"]>[number]) {
  const seen = new Set<string>();
  return [...(item?.productImageCatalog || []), ...(item?.productImageReal || [])]
    .map((image) => ({
      downloadKey: String(image?.downloadKey || "").trim(),
      fileName: String(image?.fileName || item?.productName || "Product image").trim(),
    }))
    .filter((image) => {
      if (!image.downloadKey || seen.has(image.downloadKey)) return false;
      seen.add(image.downloadKey);
      return true;
    });
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
  const [categoryOptions, setCategoryOptions] = useState<CategoryFilterOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [addButtonStates, setAddButtonStates] = useState<Record<string, AddTackleButtonState>>({});
  const [activeImageByProduct, setActiveImageByProduct] = useState<Record<string, number>>({});
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ id: number; kind: "added"; productName: string } | null>(null);
  const { items: cartItems, subtotal, totalItems } = useShopCart(tripId);
  const cartPulseNonce = useShopCartAddPulse(tripId);
  const detailDragStartY = useRef<number | null>(null);
  const cartQuantityByProduct = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = item.quantity;
      return acc;
    }, {});
  }, [cartItems]);
  const categories = useMemo(() => {
    const productCategories = Array.from(
      new Set(products.map((product) => product.category).filter(isVisibleCategoryOption))
    )
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({
        label: category,
        value: category,
      }));
    const sourceCategories = categoryOptions.length > 0 ? categoryOptions : productCategories;
    return [{ label: "All", value: "All" }, ...sourceCategories];
  }, [categoryOptions, products]);
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
      setSelectedCategory("All");

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

      const [response, categoryResponse] = await Promise.all([
        fetch(
          `/api/crm/products?destinationRelatedId=${encodeURIComponent(destinationVendorId)}&perPage=200&productActive=true`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Session-Token": token,
            },
          }
        ),
        fetch("/api/crm/products/categories", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Session-Token": token,
          },
        }).catch(() => null),
      ]);

      if (categoryResponse?.ok) {
        const categoryBody = (await categoryResponse.json()) as {
          ok: boolean;
          data?: ProductCategoryOptionsResponse;
        };

        if (categoryBody.ok && Array.isArray(categoryBody.data?.options)) {
          setCategoryOptions(
            categoryBody.data.options
              .map((option) => {
                const label = String(option?.displayValue || option?.actualValue || "").trim();
                const value = String(option?.actualValue || option?.displayValue || "").trim();
                return { label, value };
              })
              .filter((option) => isVisibleCategoryOption(option.label) && isVisibleCategoryOption(option.value))
              .filter(
                (option, index, options) =>
                  options.findIndex((current) => current.value.toLowerCase() === option.value.toLowerCase()) === index
              )
          );
        } else {
          setCategoryOptions([]);
        }
      } else {
        setCategoryOptions([]);
      }

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
          .map((item) => {
            const images = buildProductImages(item);
            const firstImage = images[0] || null;

            return {
              id: String(item?.id || "").trim(),
              productName: String(item?.productName || "").trim(),
              productCode: String(item?.productCode || "").trim(),
              vendorName: String(item?.vendorName?.name || "").trim(),
              category: String(item?.category || "").trim(),
              description: String(item?.description || "").trim(),
              unitPrice:
                typeof item?.unitPrice === "number" ? item.unitPrice : Number(item?.unitPrice ?? null),
              imageDownloadKey: firstImage?.downloadKey || "",
              imageAlt: firstImage?.fileName || String(item?.productName || "Product image"),
              images,
              isEssential: isEssentialValue(item?.essential),
            };
          })
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

  useEffect(() => {
    if (!selectedProduct) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedProduct(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProduct]);

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

    if (addButtonStates[product.id] && addButtonStates[product.id] !== "idle") {
      return;
    }

    setAddButtonStates((current) => ({
      ...current,
      [product.id]: "adding",
    }));

    try {
      await Promise.all([
        addItemToShopCart(
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
        ),
        wait(950),
      ]);

      setMessage("");
      setAddButtonStates((current) => ({
        ...current,
        [product.id]: "added",
      }));
      const feedbackId = Date.now();
      setFeedback({
        id: feedbackId,
        kind: "added",
        productName: product.productName,
      });
      window.setTimeout(() => {
        setAddButtonStates((current) => {
          if (current[product.id] !== "added") return current;
          return {
            ...current,
            [product.id]: "idle",
          };
        });
      }, 1200);
      window.setTimeout(() => {
        setFeedback((current) => (current?.id === feedbackId ? null : current));
      }, 2000);
      setQuantities((current) => ({
        ...current,
        [product.id]: 1,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add item to cart.");
      setAddButtonStates((current) => ({
        ...current,
        [product.id]: "idle",
      }));
      throw error;
    }
  }

  function handleAddFromDetail(product: ShopProduct) {
    void handleAddToCart(product).then(() => {
      window.setTimeout(() => {
        setSelectedProduct((current) => (current?.id === product.id ? null : current));
      }, 900);
    });
  }

  async function handleRemoveFromCart(product: ShopProduct) {
    try {
      await removeShopCartItem(tripId, product.id);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove item from cart.");
    }
  }

  function closeProductDetail() {
    setSheetDragY(0);
    setDetailImageIndex(0);
    setSelectedProduct(null);
  }

  function openProductDetail(product: ShopProduct) {
    setSheetDragY(0);
    setDetailImageIndex(0);
    setSelectedProduct(product);
  }

  function getActiveProductImageIndex(product: ShopProduct) {
    const maxIndex = Math.max(0, product.images.length - 1);
    return Math.min(Math.max(activeImageByProduct[product.id] || 0, 0), maxIndex);
  }

  function changeProductImage(product: ShopProduct, delta: number) {
    if (product.images.length <= 1) return;

    setActiveImageByProduct((current) => {
      const currentIndex = Math.min(Math.max(current[product.id] || 0, 0), product.images.length - 1);
      const nextIndex = (currentIndex + delta + product.images.length) % product.images.length;
      return {
        ...current,
        [product.id]: nextIndex,
      };
    });
  }

  function setProductImage(product: ShopProduct, index: number) {
    setActiveImageByProduct((current) => ({
      ...current,
      [product.id]: Math.min(Math.max(index, 0), product.images.length - 1),
    }));
  }

  function changeDetailImage(delta: number) {
    if (!selectedProduct || selectedProduct.images.length <= 1) return;
    setDetailImageIndex((current) => (current + delta + selectedProduct.images.length) % selectedProduct.images.length);
  }

  function handleDetailDragStart(event: PointerEvent<HTMLDivElement>) {
    detailDragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDetailDragMove(event: PointerEvent<HTMLDivElement>) {
    if (detailDragStartY.current === null) return;
    setSheetDragY(Math.max(0, event.clientY - detailDragStartY.current));
  }

  function handleDetailDragEnd(event: PointerEvent<HTMLDivElement>) {
    if (detailDragStartY.current === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    detailDragStartY.current = null;

    if (sheetDragY > 105) {
      closeProductDetail();
      return;
    }

    setSheetDragY(0);
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
  const selectedProductDescription =
    selectedProduct?.description ||
    "No description available.";
  const selectedProductImages = selectedProduct?.images || [];
  const selectedProductImage =
    selectedProductImages[Math.min(Math.max(detailImageIndex, 0), Math.max(0, selectedProductImages.length - 1))] || null;

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
                    key={category.value}
                    type="button"
                    className={`shop-gears-category-chip${selectedCategory === category.value ? " is-active" : ""}`}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    {category.label}
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
                  const addButtonState = addButtonStates[product.id] || "idle";
                  const activeImageIndex = getActiveProductImageIndex(product);
                  const activeImage = product.images[activeImageIndex] || null;
                  return (
                    <article key={product.id} className="shop-gears-catalog-card">
                      <div className="shop-gears-catalog-media">
                        <button
                          type="button"
                          className="shop-gears-catalog-image-btn"
                          onClick={() => openProductDetail(product)}
                          aria-label={`Open details for ${product.productName}`}
                        >
                          {activeImage?.downloadKey && sessionToken ? (
                            <Image
                              src={`/api/crm/files/${encodeURIComponent(activeImage.downloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`}
                              alt={activeImage.fileName || product.imageAlt}
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
                        </button>

                        {product.images.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="shop-gears-image-carousel-btn is-prev"
                              aria-label={`Previous image for ${product.productName}`}
                              onClick={() => changeProductImage(product, -1)}
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="shop-gears-image-carousel-btn is-next"
                              aria-label={`Next image for ${product.productName}`}
                              onClick={() => changeProductImage(product, 1)}
                            >
                              ›
                            </button>
                            <div className="shop-gears-image-carousel-dots" aria-label={`${product.productName} images`}>
                              {product.images.map((image, index) => (
                                <button
                                  key={`${product.id}-${image.downloadKey}`}
                                  type="button"
                                  className={`shop-gears-image-carousel-dot${index === activeImageIndex ? " is-active" : ""}`}
                                  aria-label={`Show image ${index + 1} for ${product.productName}`}
                                  onClick={() => setProductImage(product, index)}
                                />
                              ))}
                            </div>
                          </>
                        ) : null}

                        {product.isEssential ? (
                          <span className="shop-gears-recommended-badge">ESSENTIAL</span>
                        ) : null}

                        <button
                          type="button"
                          className="shop-gears-info-btn"
                          aria-label={`View details for ${product.productName}`}
                          onClick={() => openProductDetail(product)}
                        >
                          i
                        </button>
                      </div>

                      <div className="shop-gears-catalog-copy">
                        <p className="shop-gears-product-sku">SKU: {product.productCode || "-"}</p>
                        <button
                          type="button"
                          className="shop-gears-product-name shop-gears-product-name-link"
                          onClick={() => openProductDetail(product)}
                          aria-haspopup="dialog"
                          aria-label={`Open details for ${product.productName}`}
                        >
                          {product.productName}
                        </button>
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

                          <AddTackleButton
                            state={addButtonState}
                            className="shop-gears-add-btn"
                            onClick={() => void handleAddToCart(product)}
                          />
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

        {selectedProduct ? (
          <div className="shop-gears-detail-modal" role="dialog" aria-modal="true" aria-labelledby="shop-gears-detail-title">
            <button
              type="button"
              className="shop-gears-detail-backdrop"
              aria-label="Close product details"
              onClick={closeProductDetail}
            />

            <section
              className="shop-gears-detail-sheet"
              style={{ transform: `translateY(${sheetDragY}px)` }}
            >
              <div
                className="shop-gears-detail-sheet-drag"
                onPointerDown={handleDetailDragStart}
                onPointerMove={handleDetailDragMove}
                onPointerUp={handleDetailDragEnd}
                onPointerCancel={handleDetailDragEnd}
              >
                <span className="shop-gears-detail-sheet-handle" aria-hidden="true" />
              </div>

              <button
                type="button"
                className="shop-gears-detail-close-btn"
                aria-label="Close product details"
                onClick={closeProductDetail}
              >
                ×
              </button>

              <div className="shop-gears-detail-sheet-body">
                <div className="shop-gears-detail-sheet-media">
                  {selectedProductImage?.downloadKey && sessionToken ? (
                    <Image
                      src={`/api/crm/files/${encodeURIComponent(selectedProductImage.downloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`}
                      alt={selectedProductImage.fileName || selectedProduct.imageAlt}
                      width={420}
                      height={260}
                      className="shop-gears-detail-sheet-image"
                      unoptimized
                    />
                  ) : (
                    <div className="shop-gears-detail-sheet-image shop-gears-product-image-placeholder">
                      <span className="shop-gears-product-image-placeholder-text">No image</span>
                    </div>
                  )}

                  {selectedProductImages.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="shop-gears-image-carousel-btn is-prev"
                        aria-label={`Previous image for ${selectedProduct.productName}`}
                        onClick={() => changeDetailImage(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="shop-gears-image-carousel-btn is-next"
                        aria-label={`Next image for ${selectedProduct.productName}`}
                        onClick={() => changeDetailImage(1)}
                      >
                        ›
                      </button>
                      <div className="shop-gears-image-carousel-dots" aria-label={`${selectedProduct.productName} images`}>
                        {selectedProductImages.map((image, index) => (
                          <button
                            key={`detail-${selectedProduct.id}-${image.downloadKey}`}
                            type="button"
                            className={`shop-gears-image-carousel-dot${index === detailImageIndex ? " is-active" : ""}`}
                            aria-label={`Show image ${index + 1} for ${selectedProduct.productName}`}
                            onClick={() => setDetailImageIndex(index)}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}

                  {selectedProduct.isEssential ? (
                    <span className="shop-gears-detail-sheet-badge">ESSENTIAL</span>
                  ) : null}
                </div>

                <div className="shop-gears-detail-sheet-head">
                  <h2 id="shop-gears-detail-title" className="shop-gears-detail-sheet-title">
                    {selectedProduct.productName}
                  </h2>
                  <p className="shop-gears-detail-sheet-price">{formatCurrency(selectedProduct.unitPrice)}</p>
                </div>

                <p className="shop-gears-detail-sheet-meta">
                  SKU: {selectedProduct.productCode || "-"} · Brand: {selectedProduct.vendorName || "-"}
                </p>

                <div className="shop-gears-detail-sheet-description">
                  <h3>Description</h3>
                  <p>{selectedProductDescription}</p>
                </div>

                <div className="shop-gears-detail-sheet-divider" />

                <div className="shop-gears-detail-sheet-actions">
                  <div className="shop-gears-detail-sheet-qty-block">
                    <span className="shop-gears-detail-sheet-qty-label">Quantity</span>
                    <div className="shop-gears-qty-picker" aria-label="Quantity selector">
                      <button
                        type="button"
                        className="shop-gears-qty-btn"
                        onClick={() => changeQuantity(selectedProduct.id, -1)}
                        aria-label={`Decrease quantity for ${selectedProduct.productName}`}
                      >
                        -
                      </button>
                      <span className="shop-gears-qty-value">{quantities[selectedProduct.id] ?? 1}</span>
                      <button
                        type="button"
                        className="shop-gears-qty-btn"
                        onClick={() => changeQuantity(selectedProduct.id, 1)}
                        aria-label={`Increase quantity for ${selectedProduct.productName}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <AddTackleButton
                    state={addButtonStates[selectedProduct.id] || "idle"}
                    className="shop-gears-detail-sheet-add-btn"
                    onClick={() => handleAddFromDetail(selectedProduct)}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
