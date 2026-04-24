"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import Link from "next/link";

type TripDetailsResponse = {
  trip: {
    hotelName: string | null;
    hotelInformation: string | null;
    hotelConfirmationCode: string | null;
    hotelAddress: string | null;
    checkIn: string | null;
    checkOut: string | null;
    status?: string | null;
  };
};

type Traveler = {
  travelerName?: string | null;
};

function formatDate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatTime(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

export default function HotelInformationPage() {
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

  useEffect(() => {
    async function loadData() {
      if (!tripId || tripId === "undefined" || tripId === "null") return;

      const token = getSessionToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const [tripResult, travelerResult] = await Promise.all([
        getTripDetails(token, tripId),
        getTraveler(token),
      ]);

      if (!tripResult.ok) {
        setMessage(tripResult.error || tripResult.message || "Failed to load hotel info.");
        setLoading(false);
        return;
      }

      setData((tripResult.data as TripDetailsResponse) || null);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
      setLoading(false);
    }

    void loadData();
  }, [tripId, router]);

  const hotelName = String(data?.trip?.hotelName || "").trim();
  const hotelAddress = String(data?.trip?.hotelAddress || "").trim();
  const hotelInformation = String(data?.trip?.hotelInformation || "").trim();
  const hotelConfirmationCode = String(data?.trip?.hotelConfirmationCode || "").trim();
  const checkInDate = formatDate(data?.trip?.checkIn);
  const checkInTime = formatTime(data?.trip?.checkIn);
  const checkOutDate = formatDate(data?.trip?.checkOut);
  const checkOutTime = formatTime(data?.trip?.checkOut);
  const status = String(data?.trip?.status || "").trim();
  const mapHref = hotelAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelAddress)}`
    : "";

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
        <div className="hotel-page-stack">
          <div className="hotel-page-heading">
            {hotelConfirmationCode ? (
              <div className="hotel-page-kicker">{hotelConfirmationCode}</div>
            ) : null}
            {status ? <div className="hotel-page-status">{status}</div> : null}
          </div>

          {hotelName ? <h1 className="hotel-page-title">{hotelName}</h1> : null}

          {hotelAddress ? (
            <div className="hotel-page-address">
              <span className="hotel-page-address-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.045 7-11a7 7 0 1 0-14 0c0 4.955 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.7" />
                </svg>
              </span>
              <span>{hotelAddress}</span>
            </div>
          ) : null}

          {loading ? (
            <>
              <div className="hotel-hero-card skeleton-card" />
              <div className="hotel-stay-grid">
                <div className="hotel-stay-card skeleton-card" />
                <div className="hotel-stay-card skeleton-card" />
              </div>
              <div className="hotel-booking-card skeleton-card" style={{ minHeight: 180 }} />
            </>
          ) : (
            <>
              {(hotelName || mapHref) ? (
                <div className="hotel-hero-card">
                  <div className="hotel-hero-badge">Hotel</div>
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="hotel-map-btn"
                    >
                      <span aria-hidden="true">⌘</span>
                      <span>View Map</span>
                    </a>
                  ) : null}
                </div>
              ) : null}

              {(checkInDate || checkOutDate) ? (
                <div className="hotel-stay-grid">
                  {checkInDate ? (
                    <article className="hotel-stay-card">
                      <span className="hotel-stay-label">Check-in</span>
                      <strong className="hotel-stay-date">{checkInDate}</strong>
                      {checkInTime ? <span className="hotel-stay-time">{checkInTime}</span> : null}
                    </article>
                  ) : null}

                  {checkOutDate ? (
                    <article className="hotel-stay-card">
                      <span className="hotel-stay-label">Check-out</span>
                      <strong className="hotel-stay-date">{checkOutDate}</strong>
                      {checkOutTime ? <span className="hotel-stay-time">{checkOutTime}</span> : null}
                    </article>
                  ) : null}
                </div>
              ) : null}

              {hotelInformation ? (
                <section className="hotel-booking-card">
                  <h2 className="hotel-booking-title">Hotel Details</h2>
                  <div className="hotel-booking-copy">{hotelInformation}</div>
                </section>
              ) : null}
            </>
          )}

          {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)" }}>{message}</p> : null}

          <div className="trip-back-action">
            <Link href={`/trips/${tripId}`} className="trip-back-link">
              Back to trip details
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
