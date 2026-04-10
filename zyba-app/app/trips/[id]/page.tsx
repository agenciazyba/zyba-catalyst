"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";

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
  { label: "Hotel Informations", slug: "hotel-information", icon: "hotel" as const },
  { label: "Transfer Informations", slug: "transfer-information", icon: "transfer" as const },
  { label: "Full Itinerary", slug: "full-itinerary", icon: "itinerary" as const },
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

  useEffect(() => {
    async function load() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/login");
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

  const destinationVendor =
    data?.trip?.vendorName ||
    data?.deal?.vendorName ||
    data?.trip?.deal?.name ||
    "-";
  const destinationCountry =
    data?.trip?.destinationCountry ||
    data?.deal?.destinationCountry ||
    data?.trip?.destination ||
    "-";
  const arrivalDate =
    data?.trip?.arrivalDate ||
    data?.deal?.arrivalDate ||
    null;
  const tripStatus =
    data?.trip?.tripStatus ||
    data?.trip?.status ||
    data?.deal?.status ||
    "-";

  return (
    <main className="trip-details-page">
      <header className="trip-details-header">
        <div className="trip-details-header-top">
          <div className="trip-details-user-block">
            <Link href="/trips" aria-label="Go to trips" className="trip-header-logo-link">
            <Image
              src="/brand/Trans_Simb_Creme.png"
              alt="Zyba symbol"
              width={31}
              height={31}
              style={{ width: 31, height: "auto" }}
            />
            </Link>
            <h2 className="trip-details-greeting">Hi,{traveler?.travelerName?.split(" ")[0] || "Traveler"}</h2>
          </div>
          <NotificationsBell />
        </div>
      </header>

      <section className="trip-details-body">
        <h5 className="trip-details-section-title trip-details-title-first">Your Trip</h5>

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
            <div className="trip-details-info">
              <p className="trip-details-info-line">
                <strong>Destination:</strong>{" "}
                {destinationVendor} - {destinationCountry}
              </p>
              <p className="trip-details-info-line">
                <strong>Arrival Date:</strong>{" "}
                {formatDate(arrivalDate)}
              </p>
              <p className="trip-details-info-line">
                <strong>Status:</strong>{" "}
                <span className="trip-details-status">{tripStatus}</span>
              </p>
            </div>

            <a
              href={`/api/crm/trips/${tripId}/sales-order/pdf?sessionToken=${encodeURIComponent(sessionToken)}`}
              className="btn trip-sales-order-btn"
            >
              Download Sales Order PDF
            </a>
          </>
        )}

        <div className="trip-details-gap-lg" />

        <h5 className="trip-details-section-title">Trip Details</h5>

        {loading ? (
          <div className="trip-details-cards-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="trip-details-card-btn skeleton-block" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div className="trip-details-cards-row">
            <Link href={`/trips/${tripId}/flight-information`} className="trip-details-card-btn">
              <Image src="/icons/Icon_flight.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
              <span className="trip-details-card-label">Flight Info</span>
            </Link>

            <Link href={`/trips/${tripId}/documents`} className="trip-details-card-btn">
              <Image src="/icons/Icon_Document.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
              <span className="trip-details-card-label">Documents</span>
            </Link>

            <Link href={`/trips/${tripId}/shop-gears`} className="trip-details-card-btn is-shop">
              <Image src="/icons/Icon_shop.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
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
            : links.map((item) => (
                <Link key={item.label} href={`/trips/${tripId}/${item.slug}`} className="trip-details-link-row">
                  <span className="trip-details-link-left">
                    {item.icon === "hotel" ? (
                      <Image src="/icons/Icon_Hotel.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
                    ) : item.icon === "transfer" ? (
                      <Image src="/icons/Icon_TRansfer.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
                    ) : (
                      <Image src="/icons/Icon_Itinerary.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
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
