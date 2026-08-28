"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getHotels, getTraveler, type HotelRecord } from "@/lib/api";
import { getDefaultLoginPath, getSessionToken } from "@/lib/auth";

type Traveler = {
  travelerName?: string | null;
};

const FALLBACK_HOTEL_IMAGE =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";
const EMPTY_INFORMATION_MESSAGE =
  "This information is not available yet, but we're working on it. You'll receive a notification as soon as it's ready.";

function formatDate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "Check-in date pending";

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function getPhotoUrl(downloadKey: string | null | undefined, sessionToken: string) {
  const key = String(downloadKey || "").trim();
  if (!key || !sessionToken) return "";
  return `/api/crm/files/${encodeURIComponent(key)}?sessionToken=${encodeURIComponent(sessionToken)}`;
}

function getHotelPhotoUrl(hotel: HotelRecord, sessionToken: string) {
  const photos = hotel.hotelPhotos?.length ? hotel.hotelPhotos : hotel.hotelName?.photos || [];
  const firstPhoto = photos[0];
  return getPhotoUrl(firstPhoto?.downloadKey, sessionToken) || FALLBACK_HOTEL_IMAGE;
}

export default function HotelInformationPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [hotels, setHotels] = useState<HotelRecord[]>([]);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const visibleHotels = hotels.filter((hotel) => String(hotel.id || "").trim());

  useEffect(() => {
    async function loadHotels() {
      if (!tripId || tripId === "undefined" || tripId === "null") return;

      const token = getSessionToken();
      if (!token) {
        router.push(getDefaultLoginPath());
        return;
      }

      setSessionToken(token);
      const [travelerResult, hotelsResult] = await Promise.all([
        getTraveler(token),
        getHotels(token, tripId),
      ]);

      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }

      if (!hotelsResult.ok) {
        setMessage(hotelsResult.error || hotelsResult.message || "Failed to load hotels.");
        setLoading(false);
        return;
      }

      setHotels(Array.isArray(hotelsResult.data) ? hotelsResult.data : []);
      setLoading(false);
    }

    void loadHotels();
  }, [tripId, router]);

  return (
    <main className="trip-details-page hotel-list-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body hotel-list-body">
        <div className="hotel-list-stack">
          <header className="hotel-list-header trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "40ms" }}>
            <TripBackLink href={`/trips/${tripId}`} label="Return to trip details" />
            <h1 className="hotel-list-title">Hotels</h1>
            <p className="hotel-list-subtitle">Your registered stays for this trip</p>
          </header>

          {loading ? (
            <div className="hotel-list-cards">
              <div className="hotel-list-card skeleton-card" />
              <div className="hotel-list-card skeleton-card" />
            </div>
          ) : visibleHotels.length > 0 ? (
            <div className="hotel-list-cards">
              {visibleHotels.map((hotel, index) => {
                const hotelName = String(hotel.hotelName?.name || hotel.bookingCode || "Hotel").trim();
                const checkInDate = formatDate(hotel.checkIn);
                const photoUrl = getHotelPhotoUrl(hotel, sessionToken);
                const href = `/trips/${encodeURIComponent(tripId)}/hotel-information/${encodeURIComponent(String(hotel.id))}`;

                return (
                  <Link
                    key={hotel.id}
                    href={href}
                    className="hotel-list-card trip-details-reveal"
                    style={{
                      ["--trip-reveal-delay" as string]: `${120 + index * 70}ms`,
                      backgroundImage: `linear-gradient(180deg, rgba(28, 28, 28, 0.08) 0%, rgba(28, 28, 28, 0.72) 100%), url("${photoUrl}")`,
                    }}
                  >
                    <span className="hotel-list-card-meta">Check-in {checkInDate}</span>
                    <span className="hotel-list-card-content">
                      <span className="hotel-list-card-title">{hotelName}</span>
                      <span className="hotel-list-button">Hotel Details</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="hotel-list-empty-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "120ms" }}>
              <h2>No hotels found</h2>
              <p>{EMPTY_INFORMATION_MESSAGE}</p>
            </div>
          )}

          {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)" }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
