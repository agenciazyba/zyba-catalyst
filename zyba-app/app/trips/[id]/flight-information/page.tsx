"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type FlightConnection = {
  id?: string | null;
  connectionAirport?: string | null;
  countryCity?: string | null;
  date?: string | null;
  duration?: number | null;
  time?: string | null;
};

type FlightUploadedFile = {
  id?: string | null;
  fileName?: string | null;
  downloadKey?: string | null;
};

type FlightInfo = {
  id?: string | null;
  name?: string | null;
  trackingNumber?: string | null;
  airlineCompany?: string | null;
  airportDestination?: string | null;
  arrival?: string | null;
  departure?: string | null;
  departureAirport?: string | null;
  status?: string | null;
  connectionsInformation?: FlightConnection[];
  ticketFile?: FlightUploadedFile[];
};

type TripDetailsResponse = {
  trip: {
    flights?: FlightInfo[];
  };
};

type Traveler = {
  travelerName?: string | null;
};

function formatTime(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = text.match(/T(\d{2}):(\d{2})/);
  if (match) {
    const hour = Number(match[1]);
    const minute = match[2];
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${String(displayHour).padStart(2, "0")}:${minute} ${period}`;
  }

  return text;
}

function formatDate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function extractAirportCode(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  const codeMatch = text.match(/^([A-Z]{3})\b/);
  if (codeMatch) return codeMatch[1];
  const shortMatch = text.match(/\b([A-Z]{3})\b/);
  return shortMatch ? shortMatch[1] : text.slice(0, 3).toUpperCase();
}

function extractAirportLabel(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes(" - ")) {
    const parts = text.split(" - ").map((item) => item.trim()).filter(Boolean);
    return parts[1] || parts[0] || text;
  }
  return text;
}

function getInitials(value?: string | null) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "FL";
  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}

function getFlightTicketFile(flight: FlightInfo) {
  return Array.isArray(flight.ticketFile)
    ? flight.ticketFile.find((file) => String(file?.downloadKey || "").trim())
    : null;
}

function FlightLeg({
  origin,
  destination,
  departureTime,
  arrivalTime,
  departureDate,
  arrivalDate,
  duration,
  centerLabel,
  showDivider = false,
}: {
  origin: string;
  destination: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  departureDate?: string | null;
  arrivalDate?: string | null;
  duration?: string | null;
  centerLabel?: string | null;
  showDivider?: boolean;
}) {
  return (
    <div className={`flight-leg ${showDivider ? "is-divided" : ""}`}>
      <div className="flight-leg-side">
        <div className="flight-leg-code">{extractAirportCode(origin)}</div>
        {extractAirportLabel(origin) ? <div className="flight-leg-label">{extractAirportLabel(origin)}</div> : null}
        {departureDate ? <div className="flight-leg-date">{departureDate}</div> : null}
        {departureTime ? <div className="flight-leg-time">{departureTime}</div> : null}
      </div>

      <div className="flight-leg-center">
        {duration ? <div className="flight-leg-duration">{duration}</div> : null}
        <div className="flight-leg-line">
          <span className="flight-leg-dash" />
          <span className="flight-leg-plane">✈</span>
          <span className="flight-leg-dash" />
        </div>
        {centerLabel ? <div className="flight-leg-connection-label">{centerLabel}</div> : null}
      </div>

      <div className="flight-leg-side is-right">
        <div className="flight-leg-code">{extractAirportCode(destination)}</div>
        {extractAirportLabel(destination) ? <div className="flight-leg-label">{extractAirportLabel(destination)}</div> : null}
        {arrivalDate ? <div className="flight-leg-date">{arrivalDate}</div> : null}
        {arrivalTime ? <div className="flight-leg-time">{arrivalTime}</div> : null}
      </div>
    </div>
  );
}

export default function FlightInformationPage() {
  const params = useParams();
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const flightCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [data, setData] = useState<TripDetailsResponse | null>(null);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeFlightId, setActiveFlightId] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!tripId || tripId === "undefined" || tripId === "null") return;

      const token = getSessionToken();
      if (!token) {
        router.push("/login");
        return;
      }
      setSessionToken(token);

      const [tripResult, travelerResult] = await Promise.all([
        getTripDetails(token, tripId),
        getTraveler(token),
      ]);

      if (!tripResult.ok) {
        setMessage(tripResult.error || tripResult.message || "Failed to load flight info.");
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

  const flights = useMemo(
    () => (Array.isArray(data?.trip?.flights) ? data.trip.flights : []),
    [data]
  );

  useEffect(() => {
    if (!flights.length) return;

    const carousel = carouselRef.current;
    let frameId = 0;

    const updateActiveCard = () => {
      frameId = 0;
      if (!carousel) {
        const fallbackFlightId = flights[0]?.id || "flight-0";
        setActiveFlightId((current) => (current === fallbackFlightId ? current : fallbackFlightId));
        return;
      }

      const viewportCenter = carousel.scrollLeft + carousel.clientWidth / 2;
      let nextActiveFlightId = flights[0]?.id || "flight-0";
      let shortestDistance = Number.POSITIVE_INFINITY;

      flights.forEach((flight, index) => {
        const flightId = flight.id || `flight-${index}`;
        const card = flightCardRefs.current[flightId];
        if (!card) return;

        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - viewportCenter);

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nextActiveFlightId = flightId;
        }
      });

      setActiveFlightId((current) => (current === nextActiveFlightId ? current : nextActiveFlightId));
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
  }, [flights]);

  function scrollToFlight(flightId: string) {
    const card = flightCardRefs.current[flightId];
    const carousel = carouselRef.current;
    if (!card || !carousel) return;

    setActiveFlightId(flightId);
    carousel.scrollTo({
      left: card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  }

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <TripBackLink href={`/trips/${tripId}`} label="Return to trip details" />
        <h5 className="trip-details-section-title" style={{ marginBottom: 16 }}>
          Flight Itinerary
        </h5>
        <p className="flight-page-subtitle">
          This is just a summary of your flight information. Before making your plans, please check the updated information on your boarding pass or contact our team.
        </p>

        <div className="flight-itinerary-stack">
          {loading ? (
            <div className="flight-carousel-area">
              <div className="flight-carousel-view">
                <div className="flight-carousel-track">
                  {[0, 1].map((idx) => (
                    <div key={`flight-skeleton-${idx}`} className="flight-ticket skeleton-card">
                      <div className="flight-ticket-header">
                        <span className="skeleton-block" style={{ width: 140, height: 20, borderRadius: 12 }} />
                        <span className="skeleton-block" style={{ width: 96, height: 20, borderRadius: 12 }} />
                      </div>
                      <div className="flight-ticket-body">
                        <span className="skeleton-block skeleton-line w-100" />
                        <span className="skeleton-block skeleton-line w-80" />
                        <span className="skeleton-block skeleton-line w-60" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : flights.length === 0 ? (
            <div className="flight-empty-card">
              <p className="flight-empty-copy">No flights found.</p>
            </div>
          ) : (
            <div className="flight-carousel-area">
              <div className="flight-carousel-view" ref={carouselRef}>
                <div className="flight-carousel-track">
                  {flights.map((flight, index) => {
                    const flightId = flight.id || `flight-${index}`;
                    const isActive = activeFlightId === flightId || (!activeFlightId && index === 0);
                    const pnr = flight.trackingNumber || flight.name || "";
                    const airline = flight.airlineCompany || "";
                    const departureAirport = flight.departureAirport || "";
                    const destinationAirport = flight.airportDestination || "";
                    const departureDate = formatDate(flight.departure);
                    const arrivalDate = formatDate(flight.arrival);
                    const departureTime = formatTime(flight.departure);
                    const arrivalTime = formatTime(flight.arrival);
                    const ticketFile = getFlightTicketFile(flight);
                    const ticketDownloadUrl =
                      ticketFile?.downloadKey && sessionToken
                        ? `/api/crm/files/${encodeURIComponent(ticketFile.downloadKey)}?sessionToken=${encodeURIComponent(sessionToken)}`
                        : "";
                    const connections = Array.isArray(flight.connectionsInformation)
                      ? flight.connectionsInformation.filter(
                          (item) =>
                            item.connectionAirport ||
                            item.countryCity ||
                            item.date ||
                            item.duration !== null ||
                            item.time
                        )
                      : [];
                    const connectionLabel =
                      connections.length === 0
                        ? "Direct flight"
                        : `${connections.length} ${connections.length === 1 ? "Connection" : "Connections"}`;

                    return (
                      <div
                        key={flightId}
                        className={`flight-card-slide${isActive ? " is-active" : ""}`}
                        ref={(node) => {
                          flightCardRefs.current[flightId] = node;
                        }}
                      >
                        <div className="flight-ticket">
                          <div className="flight-ticket-card">
                            <div className="flight-ticket-header">
                              <div className="flight-brand">
                                <div className="flight-brand-badge">{getInitials(airline || pnr)}</div>
                                {airline ? <div className="flight-brand-name">{airline}</div> : null}
                              </div>

                              {pnr ? <div className="flight-number-chip">Flight {pnr}</div> : null}
                            </div>

                            <div className="flight-ticket-body">
                              {departureAirport || destinationAirport || departureTime || arrivalTime ? (
                                <FlightLeg
                                  origin={departureAirport}
                                  destination={destinationAirport}
                                  departureTime={departureTime}
                                  arrivalTime={arrivalTime}
                                  departureDate={departureDate}
                                  arrivalDate={arrivalDate}
                                  duration={connectionLabel}
                                />
                              ) : null}

                              {connections.length > 0 ? (
                                <section className="flight-connections-stack" aria-label="Connection info">
                                  <h2 className="flight-connections-title">Connection info</h2>
                                  {connections.map((connection, connectionIndex) => {
                                    const layover =
                                      connection.time ||
                                      (connection.duration !== null && connection.duration !== undefined
                                        ? `${connection.duration}h`
                                        : "");

                                    return (
                                      <article
                                        key={connection.id || `connection-${connectionIndex}`}
                                        className="flight-connection-card"
                                      >
                                        <div>
                                          <span className="flight-connection-label">City</span>
                                          <strong>{connection.countryCity || "-"}</strong>
                                        </div>
                                        <div>
                                          <span className="flight-connection-label">Airport</span>
                                          <strong>{connection.connectionAirport || "-"}</strong>
                                        </div>
                                        <div>
                                          <span className="flight-connection-label">Layover</span>
                                          <strong>{layover || "-"}</strong>
                                        </div>
                                      </article>
                                    );
                                  })}
                                </section>
                              ) : null}
                            </div>
                          </div>
                          {ticketDownloadUrl ? (
                            <a
                              className="flight-ticket-download-btn"
                              href={ticketDownloadUrl}
                              download={ticketFile?.fileName || undefined}
                            >
                              <span>Download Flight ticket</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="trips-carousel-dots" aria-label="Flights carousel position">
                {flights.map((flight, index) => {
                  const flightId = flight.id || `flight-${index}`;
                  const isActive = activeFlightId === flightId || (!activeFlightId && index === 0);
                  return (
                    <button
                      key={flightId}
                      type="button"
                      className={`trips-carousel-dot${isActive ? " is-active" : ""}`}
                      aria-label={`Go to flight ${index + 1} of ${flights.length}`}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => scrollToFlight(flightId)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  );
}
