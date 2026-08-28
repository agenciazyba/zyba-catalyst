"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { useParams, useRouter } from "next/navigation";
import { getHotels, getTraveler, type HotelRecord } from "@/lib/api";
import { getDefaultLoginPath, getSessionToken } from "@/lib/auth";

type Traveler = {
  travelerName?: string | null;
};

const FALLBACK_HOTEL_IMAGE =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

function formatDate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
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

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function splitLines(value?: string | null) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getPhotoUrl(downloadKey: string | null | undefined, sessionToken: string) {
  const key = String(downloadKey || "").trim();
  if (!key || !sessionToken) return "";
  return `/api/crm/files/${encodeURIComponent(key)}?sessionToken=${encodeURIComponent(sessionToken)}`;
}

function AmenityIcon({ type }: { type: string }) {
  const normalized = type.toLowerCase();

  if (normalized.includes("pool")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 16c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1" />
        <path d="M4 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1" />
        <path d="M8 14V5h5" />
        <path d="M8 9h5" />
      </svg>
    );
  }

  if (normalized.includes("wi") || normalized.includes("internet")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 10a11 11 0 0 1 14 0" />
        <path d="M8 13a6.5 6.5 0 0 1 8 0" />
        <path d="M11 16a2 2 0 0 1 2 0" />
        <path d="M12 19h.01" />
      </svg>
    );
  }

  if (normalized.includes("bar") || normalized.includes("lounge")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10l-1 7a4 4 0 0 1-8 0L7 4Z" />
        <path d="M12 15v5" />
        <path d="M9 20h6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8h10" />
      <path d="M8 8v8a4 4 0 0 0 8 0V8" />
      <path d="M6 20h12" />
      <path d="M17 10h1a3 3 0 0 1 0 6h-1" />
    </svg>
  );
}

export default function HotelInformationPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const hotelId = useMemo(() => {
    const raw = params?.hotelId;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [hotels, setHotels] = useState<HotelRecord[]>([]);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadData() {
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
        setMessage(hotelsResult.error || hotelsResult.message || "Failed to load hotel info.");
        setLoading(false);
        return;
      }

      setHotels(Array.isArray(hotelsResult.data) ? hotelsResult.data : []);
      setLoading(false);
    }

    void loadData();
  }, [tripId, router]);

  const hotel = hotels.find((item) => String(item.id) === hotelId) || null;
  const hotelName = String(hotel?.hotelName?.name || "").trim();
  const hotelAddress = String(hotel?.hotelAddress || hotel?.hotelName?.address || "").trim();
  const hotelInformation = String(hotel?.checkinInformation || "").trim();
  const hotelConfirmationCode = String(hotel?.bookingCode || "").trim();
  const checkIn = hotel?.checkIn;
  const checkOut = hotel?.checkOut;
  const checkInDate = formatDate(checkIn);
  const checkInTime = formatTime(checkIn);
  const checkOutDate = formatDate(checkOut);
  const checkOutTime = formatTime(checkOut);
  const status = String(hotel?.payment || "").trim();
  const roomType = String(hotel?.roomType || "").trim();
  const singleRoomExtra = formatCurrency(hotel?.singleRoomExtra);
  const extraNight = formatCurrency(hotel?.extraNight);
  const amenities = Array.isArray(hotel?.features) ? hotel.features.filter(Boolean) : [];
  const photos = hotel?.hotelPhotos?.length
    ? hotel.hotelPhotos
    : hotel?.hotelName?.photos || [];
  const photoUrls = photos
    .map((photo) => getPhotoUrl(photo.downloadKey, sessionToken))
    .filter(Boolean);
  const carouselImages = photoUrls.length > 0 ? photoUrls : [FALLBACK_HOTEL_IMAGE];
  const hotelInfoLines = splitLines(hotelInformation);
  const hasRoomOptions = Boolean(roomType || singleRoomExtra || extraNight);

  function handleHeroScroll() {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const nextIndex = Math.round(carousel.scrollLeft / Math.max(carousel.clientWidth, 1));
    setActiveImage(Math.min(Math.max(nextIndex, 0), carouselImages.length - 1));
  }

  function scrollToHeroImage(index: number) {
    const carousel = carouselRef.current;
    if (!carousel) return;

    setActiveImage(index);
    carousel.scrollTo({
      left: carousel.clientWidth * index,
      behavior: "smooth",
    });
  }

  return (
    <main className="trip-details-page hotel-redesign-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body hotel-redesign-body">
        <div className="hotel-page-transition-shell is-entering">
          <div className="hotel-redesign-stack">
            <div className="hotel-redesign-summary trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "40ms" }}>
              <TripBackLink href={`/trips/${tripId}/hotel-information`} label="Return to hotels" />
              {hotelName ? <h1 className="hotel-redesign-title">{hotelName}</h1> : null}

              {(hotelConfirmationCode || status) ? (
                <div className="hotel-redesign-topline">
                  {hotelConfirmationCode ? (
                    <span className="hotel-redesign-confirmation">
                      Confirmation: {hotelConfirmationCode}
                    </span>
                  ) : <span />}

                  {status ? <span className="hotel-redesign-status">{status}</span> : null}
                </div>
              ) : null}
            </div>

            {loading ? (
              <>
                <div className="hotel-redesign-hero skeleton-card" />
                <div className="hotel-redesign-stay-grid">
                  <div className="hotel-redesign-stay-card skeleton-card" />
                  <div className="hotel-redesign-stay-card skeleton-card" />
                </div>
                <div className="hotel-redesign-card skeleton-card" style={{ minHeight: 130 }} />
              </>
            ) : (
              <>
                {!hotel ? (
                  <div className="hotel-list-empty-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "120ms" }}>
                    <h2>Hotel not found</h2>
                    <p>This hotel booking is not linked to the selected trip.</p>
                  </div>
                ) : (
                  <>
                    <section className="hotel-redesign-hero trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "140ms" }}>
                  <div
                    className="hotel-redesign-hero-carousel"
                    ref={carouselRef}
                    onScroll={handleHeroScroll}
                  >
                    {carouselImages.map((imageUrl, index) => (
                      <div className="hotel-redesign-hero-slide" key={`${imageUrl}-${index}`}>
                        <img src={imageUrl} alt={hotelName || "Hotel room"} className="hotel-redesign-hero-image" />
                      </div>
                    ))}
                  </div>

                  {carouselImages.length > 1 ? (
                    <div className="hotel-redesign-photo-dots" aria-label="Hotel photos">
                      {carouselImages.map((photoUrl, index) => (
                        <button
                          key={`${photoUrl}-dot-${index}`}
                          type="button"
                          className={`hotel-redesign-photo-dot${index === activeImage ? " is-active" : ""}`}
                          aria-label={`Show hotel photo ${index + 1}`}
                          onClick={() => scrollToHeroImage(index)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="hotel-redesign-photo-dots" aria-hidden="true">
                      <span className="hotel-redesign-photo-dot is-active" />
                      <span className="hotel-redesign-photo-dot" />
                      <span className="hotel-redesign-photo-dot" />
                    </div>
                  )}

                    </section>

                    {hotelAddress ? (
                      <div className="hotel-redesign-address trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "180ms" }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s7-6.045 7-11a7 7 0 1 0-14 0c0 4.955 7 11 7 11Z" />
                          <circle cx="12" cy="10" r="2.7" />
                        </svg>
                        <span>{hotelAddress}</span>
                      </div>
                    ) : null}

                    {(checkInDate || checkOutDate) ? (
                  <div className="hotel-redesign-stay-grid trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "220ms" }}>
                    {checkInDate ? (
                      <article className="hotel-redesign-stay-card">
                        <span className="hotel-redesign-stay-label">Check-in</span>
                        <strong className="hotel-redesign-stay-date">{checkInDate}</strong>
                        {checkInTime ? <span className="hotel-redesign-stay-time">{checkInTime}</span> : null}
                      </article>
                    ) : null}

                    {checkOutDate ? (
                      <article className="hotel-redesign-stay-card">
                        <span className="hotel-redesign-stay-label">Check-out</span>
                        <strong className="hotel-redesign-stay-date">{checkOutDate}</strong>
                        {checkOutTime ? <span className="hotel-redesign-stay-time">{checkOutTime}</span> : null}
                      </article>
                    ) : null}
                  </div>
                    ) : null}

                    {hotelInfoLines.length > 0 ? (
                  <section className="hotel-redesign-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "300ms" }}>
                    <h2 className="hotel-redesign-card-title">
                      <span>Hotel Details</span>
                    </h2>
                    <div className="hotel-redesign-card-copy">
                      {hotelInfoLines.map((line, index) => (
                        <p key={`hotel-info-line-${index}`}>{line}</p>
                      ))}
                    </div>
                  </section>
                    ) : null}

                    {hasRoomOptions ? (
                  <section className="hotel-redesign-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "380ms" }}>
                    <h2 className="hotel-redesign-card-title">
                      <span>Room Options</span>
                    </h2>

                    <div className="hotel-redesign-room-list">
                      {roomType ? (
                        <div className="hotel-redesign-room-row">
                          <div>
                            <strong>Type</strong>
                            <p>{roomType}</p>
                          </div>
                        </div>
                      ) : null}

                      {singleRoomExtra ? (
                        <div className="hotel-redesign-room-row">
                          <div>
                            <strong>Single Room Upgrade</strong>
                            <p>Extra price for single room - {singleRoomExtra}</p>
                          </div>
                        </div>
                      ) : null}

                      {extraNight ? (
                        <div className="hotel-redesign-room-row">
                          <div>
                            <strong>Extra Night</strong>
                            <p>Add extra night for USD {extraNight.replace("$", "")}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                    ) : null}

                    {amenities.length > 0 ? (
                  <section className="hotel-redesign-amenities trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "460ms" }}>
                    <h2>Amenities</h2>
                    <div className="hotel-redesign-amenities-grid">
                      {amenities.map((amenity) => (
                        <div key={amenity} className="hotel-redesign-amenity">
                          <AmenityIcon type={amenity} />
                          <span>{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                    ) : null}
                  </>
                )}
              </>
            )}

            {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)" }}>{message}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
