"use client";

import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getOrders, getTraveler, type ProductOrder } from "@/lib/api";
import { DEFAULT_LOGIN_PATH, getSessionToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

export default function OrdersPage() {
  const router = useRouter();
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  function formatCurrency(value?: number | null, currency = "usd") {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(Number(value));
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function getStatusClass(status?: string | null) {
    const safeStatus = String(status || "processing")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    return `orders-status-badge orders-status-${safeStatus || "processing"}`;
  }

  async function handleDownloadOrderPdf(order: ProductOrder) {
    const token = getSessionToken();
    if (!token || !order.id || downloadingOrderId) return;

    setMessage("");
    setDownloadingOrderId(order.id);

    try {
      const response = await fetch(
        `/api/crm/orders/${order.id}/pdf?sessionToken=${encodeURIComponent(token)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Session-Token": token,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to download Order PDF.";

        try {
          const body = await response.json();
          errorMessage = body.error || body.message || errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeOrderNumber = String(order.salesOrderNumber || order.id || "order").trim();

      link.href = url;
      link.download = `sales-order-${safeOrderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to download Order PDF.");
    } finally {
      setDownloadingOrderId(null);
    }
  }

  useEffect(() => {
    async function loadOrders() {
      const token = getSessionToken();
      if (!token) {
        router.replace(DEFAULT_LOGIN_PATH);
        return;
      }

      const [travelerResult, ordersResult] = await Promise.all([
        getTraveler(token),
        getOrders(token),
      ]);

      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }

      if (ordersResult.ok) {
        setOrders(ordersResult.data || []);
      } else {
        setMessage(ordersResult.error || ordersResult.message || "Failed to load orders.");
      }

      setLoading(false);
    }

    void loadOrders();
  }, [router]);

  return (
    <main className="orders-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="orders-body">
        <TripBackLink href="/trips" label="Return to trips" />
        <h4 className="orders-title">Your Orders</h4>
        <p className="orders-subtitle">History of equipment and services for this trip</p>
        {message ? <p className="orders-message" role="status">{message}</p> : null}

        {loading ? (
          <div className="orders-empty-card">
            <p className="orders-empty-title">Loading orders...</p>
          </div>
        ) : orders.length > 0 ? (
          <div className="orders-list" aria-label="My orders list">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const items = order.items || [];

              return (
                <article key={order.id} className="orders-list-row">
                  <div className="orders-card-top">
                    <div className="orders-card-summary">
                      <span className={getStatusClass(order.status)}>
                        {order.status || "Processing"}
                      </span>
                      <span className="orders-order-number">
                        #{order.salesOrderNumber || order.id}
                      </span>
                      <span className="orders-destination">
                        {order.destinationName || order.subject || "Shop Gears order"}
                      </span>
                      <span className="orders-payment-date">
                        {formatDate(order.paymentDate || order.createdAt)}
                      </span>
                      <strong className="orders-total">
                        {formatCurrency(order.total, order.currency || "usd")}
                      </strong>
                      <button
                        type="button"
                        className="orders-details-toggle"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <span>More details</span>
                        <svg
                          className="orders-details-toggle-icon"
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="m4 6 4 4 4-4" />
                        </svg>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="orders-pdf-link"
                      aria-label={`Download Sales Order PDF ${order.salesOrderNumber || order.id}`}
                      disabled={downloadingOrderId === order.id}
                      onClick={() => void handleDownloadOrderPdf(order)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
                        <path d="M5 18h14" />
                      </svg>
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="orders-items-panel">
                      {items.length > 0 ? (
                        <>
                          {items.map((item, index) => (
                            <div
                              key={`${order.id}-${item.id || index}`}
                              className="orders-item-row"
                            >
                              <div className="orders-item-info">
                                <span className="orders-item-name">{item.name || "Product"}</span>
                                <span className="orders-item-qty">
                                  Qty {item.quantity || 0}
                                  {item.unitPrice !== null && item.unitPrice !== undefined
                                    ? ` x ${formatCurrency(item.unitPrice, order.currency || "usd")}`
                                    : ""}
                                </span>
                              </div>
                              <strong className="orders-item-total">
                                {formatCurrency(item.total, order.currency || "usd")}
                              </strong>
                            </div>
                          ))}
                          <div className="orders-items-total">
                            <span>Total</span>
                            <strong>{formatCurrency(order.total, order.currency || "usd")}</strong>
                          </div>
                        </>
                      ) : (
                        <p className="orders-items-empty">No product details available.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="orders-empty-card">
            <p className="orders-empty-title">No orders yet</p>
            <p className="orders-empty-copy">Your gear orders will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
