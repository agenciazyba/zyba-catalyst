"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getTrips, getTraveler, type Trip } from "@/lib/api";
import { DEFAULT_LOGIN_PATH, getSessionToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import AppTopBar from "@/components/AppTopBar";

type Traveler = {
  travelerName?: string | null;
};

function formatShortDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatTripDateRange(arrivalDate?: string | null, departureDate?: string | null) {
  if (arrivalDate && departureDate) {
    const arrival = new Date(arrivalDate);
    const departure = new Date(departureDate);

    if (!Number.isNaN(arrival.getTime()) && !Number.isNaN(departure.getTime())) {
      const arrivalMonth = new Intl.DateTimeFormat("en-US", {
        month: "short",
        timeZone: "UTC",
      }).format(arrival);
      const departureMonth = new Intl.DateTimeFormat("en-US", {
        month: "short",
        timeZone: "UTC",
      }).format(departure);
      const arrivalDay = arrival.getUTCDate();
      const departureDay = departure.getUTCDate();
      const arrivalYear = arrival.getUTCFullYear();
      const departureYear = departure.getUTCFullYear();

      if (arrivalYear === departureYear) {
        return `${arrivalMonth} ${arrivalDay} – ${departureMonth} ${departureDay}, ${departureYear}`;
      }

      return `${arrivalMonth} ${arrivalDay}, ${arrivalYear} – ${departureMonth} ${departureDay}, ${departureYear}`;
    }
  }

  const arrival = formatShortDate(arrivalDate);
  const departure = formatShortDate(departureDate);

  if (arrival && departure) return `${arrival} - ${departure}`;
  return arrival || departure || "Dates to be confirmed";
}

export default function TripsPage() {
  const router = useRouter();
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTripId, setActiveTripId] = useState("");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const tripLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    async function loadData() {
      const token = getSessionToken();
      if (!token) {
        router.push(DEFAULT_LOGIN_PATH);
        return;
      }

      const [travelerResult, tripsResult] = await Promise.all([getTraveler(token), getTrips(token)]);

      if (!travelerResult.ok || !tripsResult.ok) {
        setLoading(false);
        return;
      }

      const parsedTraveler = (travelerResult.data as Traveler) || null;
      const tripsData = Array.isArray(tripsResult.data) ? tripsResult.data : [];
      const normalizedTrips = tripsData
        .filter((item: Trip) => item && item.id)
        .map((item: Trip) => ({
          id: String(item.id),
          tripName: item.tripName ?? null,
          dealName: item.dealName ?? null,
          destinationName: item.destinationName ?? null,
          destinationCountry: item.destinationCountry ?? null,
          subject: item.subject ?? null,
          status: item.status ?? null,
          totalAmount: item.totalAmount ?? null,
          documentsAcknowledged: item.documentsAcknowledged,
          arrivalDate: item.arrivalDate ?? null,
          departureDate: item.departureDate ?? null,
          coverId: item.coverId ?? null,
        }));

      setTraveler(parsedTraveler);
      setTrips(normalizedTrips);
      setLoading(false);
    }

    void loadData();
  }, [router]);

  useEffect(() => {
    if (!trips.length) return;

    const carousel = carouselRef.current;
    let frameId = 0;

    const updateActiveCard = () => {
      frameId = 0;
      if (!carousel) {
        const fallbackTripId = trips[0]?.id || "";
        setActiveTripId((current) => (current === fallbackTripId ? current : fallbackTripId));
        return;
      }
      const carouselRect = carousel.getBoundingClientRect();
      const viewportCenter = carouselRect.left + carouselRect.width / 2;

      let nextActiveTripId = trips[0]?.id || "";
      let shortestDistance = Number.POSITIVE_INFINITY;

      for (const trip of trips) {
        const link = tripLinkRefs.current[trip.id];
        if (!link) continue;

        const linkRect = link.getBoundingClientRect();
        const linkCenter = linkRect.left + linkRect.width / 2;
        const distance = Math.abs(linkCenter - viewportCenter);

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nextActiveTripId = trip.id;
        }
      }

      setActiveTripId((current) => (current === nextActiveTripId ? current : nextActiveTripId));
    };

    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateActiveCard);
    };

    scheduleUpdate();
    carousel?.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      carousel?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [trips]);

  const token = getSessionToken() || "";

  function scrollToTrip(tripId: string) {
    const link = tripLinkRefs.current[tripId];
    if (!link) return;
    setActiveTripId(tripId);
    link.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function getBgUrl(trip: Trip) {
    return trip.coverId
      ? `/api/crm/files/${trip.coverId}?sessionToken=${token}`
      : "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80";
  }

  return (
    <main className="trips-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trips-body">
        <div className="trips-heading">
          <h4 className="trips-section-title">Your Trips</h4>
          <p className="trips-section-subtitle">Ready for your next journey ?</p>
        </div>

        {loading ? (
          <div className="trips-carousel-area">
            <div className="trips-carousel-view">
              <div className="trips-carousel-track">
                {[0, 1].map((item) => (
                  <article key={item} className="trip-card-modern skeleton-block" style={{ backgroundImage: "none" }}>
                    <span className="trip-date-badge skeleton-block" style={{ width: 104, height: 24, display: "block", background: "rgba(255,255,255,0.28)" }} />
                    <div className="trip-card-bottom" style={{ gap: 8 }}>
                      <span className="skeleton-block skeleton-line w-60" />
                      <span className="skeleton-block skeleton-line w-100" />
                      <span className="skeleton-block skeleton-line w-80" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : trips.length === 0 ? (
          <p className="text-h5" style={{ marginTop: 25, color: "var(--color-black)" }}>No trips available.</p>
        ) : (
          <div className="trips-carousel-area">
            <div className="trips-carousel-view" ref={carouselRef}>
              <div className="trips-carousel-track">
                {trips.map((trip) => {
                  const tripTitle = trip.tripName || trip.subject || trip.dealName || "Trip";
                  const destinationName = trip.destinationName || trip.dealName || "Destination";
                  const destinationCountry = trip.destinationCountry || "";

                  return (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      className={`trip-card-link${activeTripId === trip.id ? " is-active" : ""}`}
                      ref={(node) => {
                        tripLinkRefs.current[trip.id] = node;
                      }}
                    >
                      <article
                        className="trip-card-modern"
                        style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.9) 100%), url('${getBgUrl(trip)}')` }}
                      >
                        <span className="trip-date-badge">
                          {formatTripDateRange(trip.arrivalDate, trip.departureDate)}
                        </span>
                        <div className="trip-card-bottom">
                          <h5 className="trip-card-title">{tripTitle}</h5>
                          <p className="trip-card-subtitle">{destinationName}</p>
                          {destinationCountry ? (
                            <p className="trip-card-country">{destinationCountry}</p>
                          ) : null}
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="trips-carousel-dots" aria-label="Trips carousel position">
              {trips.map((trip, index) => {
                const isActive = activeTripId === trip.id || (!activeTripId && index === 0);
                return (
                  <button
                    key={trip.id}
                    type="button"
                    className={`trips-carousel-dot${isActive ? " is-active" : ""}`}
                    aria-label={`Go to trip ${index + 1} of ${trips.length}`}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => scrollToTrip(trip.id)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
