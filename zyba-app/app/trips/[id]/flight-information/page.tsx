"use client";

import { useEffect, useMemo, useState } from "react";
import TripBackLink from "@/components/TripBackLink";
import AppTopBar from "@/components/AppTopBar";
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

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  }

  return text;
}

function formatDate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }

  return text;
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

function renderMetaPill(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return null;

  return (
    <div className="flight-meta-pill">
      <strong>{text}</strong>
    </div>
  );
}

function FlightLeg({
  origin,
  destination,
  departureTime,
  arrivalTime,
  duration,
  centerLabel,
  showDivider = false,
}: {
  origin: string;
  destination: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  duration?: string | null;
  centerLabel?: string | null;
  showDivider?: boolean;
}) {
  return (
    <div className={`flight-leg ${showDivider ? "is-divided" : ""}`}>
      <div className="flight-leg-side">
        <div className="flight-leg-code">{extractAirportCode(origin)}</div>
        {extractAirportLabel(origin) ? <div className="flight-leg-label">{extractAirportLabel(origin)}</div> : null}
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
        {arrivalTime ? <div className="flight-leg-time">{arrivalTime}</div> : null}
      </div>
    </div>
  );
}

export default function FlightInformationPage() {
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

  const flights = Array.isArray(data?.trip?.flights) ? data?.trip?.flights : [];

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <h5 className="trip-details-section-title" style={{ marginBottom: 16 }}>
          Flight Itinerary
        </h5>

        <div className="flight-itinerary-stack">
          {loading ? (
            [0, 1].map((idx) => (
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
            ))
          ) : flights.length === 0 ? (
            <div className="flight-empty-card">
              <p className="flight-empty-copy">No flights found.</p>
            </div>
          ) : (
            flights.map((flight, index) => {
              const pnr = flight.trackingNumber || flight.name || "";
              const airline = flight.airlineCompany || "";
              const departureAirport = flight.departureAirport || "";
              const destinationAirport = flight.airportDestination || "";
              const departureTime = formatTime(flight.departure);
              const arrivalTime = formatTime(flight.arrival);
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

              return (
                <div key={flight.id || `flight-${index}`} className="flight-ticket">
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
                          duration={connections[0]?.time || ""}
                        />
                      ) : null}

                      {connections.length > 0 ? (
                        <div className="flight-connections-stack">
                          {connections.map((connection, connectionIndex) => (
                            <div key={connection.id || `connection-${connectionIndex}`}>
                              {connection.date ? (
                                <div className="flight-connection-pill-row">
                                  {renderMetaPill(formatDate(connection.date))}
                                </div>
                              ) : null}

                              {connection.connectionAirport && destinationAirport ? (
                                <FlightLeg
                                  origin={connection.connectionAirport}
                                  destination={destinationAirport}
                                  departureTime=""
                                  arrivalTime={arrivalTime}
                                  centerLabel="Connection"
                                  showDivider
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        <div className="trip-back-action">
          <TripBackLink href={`/trips/${tripId}`} />
        </div>
      </section>
    </main>
  );
}
