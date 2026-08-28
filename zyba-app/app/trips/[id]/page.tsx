"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getDefaultLoginPath, getSessionToken } from "@/lib/auth";
import { isIosWebView, openInCurrentWindow } from "@/lib/browser";
import Image from "next/image";
import AppTopBar from "@/components/AppTopBar";

const SALES_ORDER_TEMPLATE_ID = "6623116000003103002";

type TripDetailsResponse = {
  trip: {
    id: string | null;
    salesOrderNumber?: string | null;
    status?: string | null;
    deal: {
      name: string | null;
    };
    destination?: string | null;
    tripStatus?: string | null;
    arrivalDate?: string | null;
    vendorName?: string | null;
    destinationCountry?: string | null;
  };
  deal: {
    arrivalDate: string | null;
    departureDate: string | null;
    airport: string | null;
    vendorName?: string | null;
    destinationCountry?: string | null;
    status?: string | null;
    salesOrderNumber?: string | null;
  } | null;
};

type Traveler = {
  travelerName?: string | null;
};

const links = [
  { label: "Hotel Information", slug: "hotel-information", icon: "hotel" as const },
  { label: "Transfer Information", slug: "transfer-information", icon: "transfer" as const },
  { label: "Full Itinerary", slug: "full-itinerary", icon: "itinerary" as const },
  { label: "My orders", slug: "/orders", icon: "orders" as const },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function cleanLabelPart(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text || text === "-" || text === "--") return null;
  return text;
}

export default function TripIndexPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [data, setData] = useState<TripDetailsResponse | null>(null);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    async function load() {
      const token = getSessionToken();
      if (!token) {
        router.replace(getDefaultLoginPath());
        return;
      }
      setSessionToken(token);
      const [tripResponse, travelerResponse] = await Promise.all([
        getTripDetails(token, tripId),
        getTraveler(token),
      ]);

      if (!tripResponse.ok) {
        setMessage(tripResponse.error || tripResponse.message || "Failed to load trip.");
        setLoading(false);
        return;
      }
      setData((tripResponse.data as TripDetailsResponse) || null);

      if (travelerResponse.ok) {
        setTraveler((travelerResponse.data as Traveler) || null);
      }
      setLoading(false);
    }
    if (tripId) void load();
  }, [tripId, router]);

  const destinationVendor = cleanLabelPart(
    data?.trip?.vendorName || data?.deal?.vendorName || data?.trip?.deal?.name
  );
  const arrivalDate =
    data?.trip?.arrivalDate ||
    data?.deal?.arrivalDate ||
    null;
  async function handleDownloadSalesOrder() {
    if (!sessionToken || !tripId || downloadingPdf) return;

    setMessage("");
    setDownloadingPdf(true);

    try {
      const pdfUrl = `/api/crm/trips/${tripId}/sales-order/pdf?sessionToken=${encodeURIComponent(
        sessionToken
      )}&templateId=${encodeURIComponent(SALES_ORDER_TEMPLATE_ID)}`;

      if (isIosWebView()) {
        openInCurrentWindow(pdfUrl);
        return;
      }

      const response = await fetch(pdfUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "X-Session-Token": sessionToken,
        },
      });

      if (!response.ok) {
        let errorMessage = "Failed to download Sales Order PDF.";

        try {
          const body = await response.json();
          errorMessage = body.error || body.message || errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTripId = String(tripId || "trip").trim();

      link.href = url;
      link.download = `sales-order-${safeTripId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to download Sales Order PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        {loading ? (
          <>
            <div className="trip-details-info">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton-card" style={{ padding: "8px 10px", display: "grid", gap: 8 }}>
                  <span className="skeleton-block skeleton-line w-40" />
                  <span className="skeleton-block skeleton-line w-80" />
                </div>
              ))}
            </div>
            <div className="skeleton-block skeleton-card" style={{ marginTop: 20, height: 54, borderRadius: 10 }} />
          </>
        ) : (
          <>
            <div className="trip-details-info-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "40ms" }}>
              <div className="trip-details-info-grid">
                <div className="trip-details-info-block">
                  <span className="trip-details-info-label">Destination</span>
                  <strong className="trip-details-info-value">{destinationVendor || "-"}</strong>
                </div>
                <div className="trip-details-info-block">
                  <span className="trip-details-info-label">Arrival Date</span>
                  <strong className="trip-details-info-value">{formatDate(arrivalDate)}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadSalesOrder}
                className="btn trip-sales-order-btn"
                disabled={!sessionToken || downloadingPdf}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="trip-sales-order-icon" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8 10 4 4 4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 18h14" />
                </svg>
                <span>{downloadingPdf ? "Downloading PDF..." : "Download Sales Order PDF"}</span>
              </button>
            </div>
          </>
        )}

        <div className="trip-details-gap-lg" />

        {loading ? (
          <div className="trip-details-cards-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="trip-details-card-btn skeleton-block" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div className="trip-details-cards-row">
            <Link
              href={`/trips/${tripId}/flight-information`}
              className="trip-details-card-btn trip-details-reveal"
              style={{ ["--trip-reveal-delay" as string]: "140ms" }}
            >
              <Image src="/icons/trip-flights.png" alt="" width={28} height={28} className="trip-details-card-icon" />
              <span className="trip-details-card-label">Flight Info</span>
            </Link>

            <Link
              href={`/trips/${tripId}/documents`}
              className="trip-details-card-btn trip-details-reveal"
              style={{ ["--trip-reveal-delay" as string]: "220ms" }}
            >
              <Image src="/icons/trip-documents.png" alt="" width={28} height={28} className="trip-details-card-icon" />
              <span className="trip-details-card-label">Documents</span>
            </Link>

            <Link
              href={`/trips/${tripId}/shop-gears`}
              className="trip-details-card-btn is-shop trip-details-reveal"
              style={{ ["--trip-reveal-delay" as string]: "300ms" }}
            >
              <Image src="/icons/trip-shopgear.png" alt="" width={28} height={28} className="trip-details-card-icon" />
              <span className="trip-details-card-label">Shop gears</span>
            </Link>
          </div>
        )}

        <div className="trip-details-gap-lg" />

        <div className="trip-details-links-list">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="trip-details-link-row" aria-hidden="true">
                  <span className="trip-details-link-left">
                    <span className="skeleton-block" style={{ width: 24, height: 24, borderRadius: 12 }} />
                    <span className="skeleton-block skeleton-line w-60" />
                  </span>
                  <span className="skeleton-block" style={{ width: 12, height: 12, borderRadius: 4 }} />
                </div>
              ))
            : links.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.slug.startsWith("/") ? item.slug : `/trips/${tripId}/${item.slug}`}
                  className="trip-details-link-row trip-details-reveal"
                  style={{ ["--trip-reveal-delay" as string]: `${380 + index * 90}ms` }}
                >
                  <span className="trip-details-link-left">
                    {item.icon === "hotel" ? (
                      <Image src="/icons/trip-hotels.png" alt="" width={30} height={30} className="trip-details-link-icon" />
                    ) : item.icon === "transfer" ? (
                      <Image src="/icons/trip-transfer.png" alt="" width={30} height={30} className="trip-details-link-icon" />
                    ) : item.icon === "itinerary" ? (
                      <Image src="/icons/trip-itinerary.png" alt="" width={30} height={30} className="trip-details-link-icon" />
                    ) : (
                      <Image src="/icons/trip-documents.png" alt="" width={30} height={30} className="trip-details-link-icon" />
                    )}
                    <span className="trip-details-link-text">{item.label}</span>
                  </span>
                  <span className="trip-details-link-arrow">›</span>
                </Link>
              ))}
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  );
}
