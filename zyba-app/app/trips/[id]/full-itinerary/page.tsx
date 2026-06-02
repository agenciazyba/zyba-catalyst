"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TripBackLink from "@/components/TripBackLink";
import AppTopBar from "@/components/AppTopBar";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

const EMPTY_INFORMATION_MESSAGE =
  "This information is not available yet, but we're working on it. You'll receive a notification as soon as it's ready.";

type ItineraryItem = {
  id: string | null;
  day: string | null;
  dayTitle: string | null;
  dayDescription: string | null;
  dayType: string | null;
  dayLink?: string | null;
};

type TripDetailsResponse = {
  deal: {
    itinerary: ItineraryItem[];
  } | null;
};

type Traveler = {
  travelerName?: string | null;
};

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function extractUrl(value: string | null | undefined) {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
    return "";
  } catch {
    const match = raw.match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : "";
  }
}

export default function FullItineraryPage() {
  const params = useParams();
  const router = useRouter();
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setMessage(tripResult.error || tripResult.message || "Failed to load itinerary.");
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

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const [isLeaving, setIsLeaving] = useState(false);

  function handleBackNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (isLeaving) return;

    setIsLeaving(true);
    exitTimerRef.current = setTimeout(() => {
      router.push(`/trips/${tripId}`);
    }, 220);
  }

  const itinerary = data?.deal?.itinerary || [];
  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <div className={`hotel-page-transition-shell ${isLeaving ? "is-leaving" : "is-entering"}`}>
        <TripBackLink
          href={`/trips/${tripId}`}
          label="Return to trip details"
          onClick={handleBackNavigation}
          ariaDisabled={isLeaving}
        />
        <h5 className="trip-details-section-title trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "40ms" }}>
          Full Itinerary
        </h5>

        {message ? (
          <p
            className="page-subtitle trip-details-reveal"
            style={{ color: "var(--color-orange)", marginTop: 12, ["--trip-reveal-delay" as string]: "100ms" }}
          >
            {message}
          </p>
        ) : null}

        {loading ? (
          <div className="itinerary-page-stack">
            {[0, 1].map((idx) => (
              <div className="itinerary-day-card skeleton-card" key={`itinerary-skeleton-${idx}`}>
                <span className="skeleton-block skeleton-line w-40" />
                <span className="skeleton-block skeleton-line w-30" />
                <span className="skeleton-block skeleton-line w-100" />
                <span className="skeleton-block skeleton-line w-80" />
              </div>
            ))}
          </div>
        ) : itinerary.length === 0 ? (
          <div className="itinerary-empty-card trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "140ms" }}>
            <h2 className="trip-content-card-title">Itinerary</h2>
            <div className="trip-content-card-copy">
              <p className="trip-content-card-line">{EMPTY_INFORMATION_MESSAGE}</p>
            </div>
          </div>
        ) : (
          <div className="itinerary-page-stack">
            {itinerary.map((item, index) => (
              (() => {
                const dayLink = extractUrl(item.dayLink || item.dayDescription);
                const dayHeading =
                  renderText(item.dayType) !== "-" ? renderText(item.dayType) : renderText(item.dayTitle) || "Scheduled Plan";
                return (
                  <article
                    className="itinerary-day-card trip-details-reveal"
                    key={item.id || index}
                    style={{ ["--trip-reveal-delay" as string]: `${140 + index * 90}ms` }}
                  >
                    <div className="itinerary-day-index">
                      <span className="itinerary-day-index-label">Day</span>
                      <strong className="itinerary-day-index-value">{index + 1}</strong>
                    </div>

                    <div className="itinerary-day-content">
                      <div className="itinerary-day-head">
                        <h2 className="itinerary-day-title">{dayHeading}</h2>
                        <p className="itinerary-day-date">{formatDate(item.day, `Day ${index + 1}`)}</p>
                      </div>

                      <div className="trip-content-card-copy">
                        <p className="trip-content-card-line">{renderText(item.dayDescription)}</p>
                      </div>

                    {dayLink ? (
                      <a
                        href={dayLink}
                        target="_blank"
                        rel="noreferrer"
                        className="itinerary-link-btn"
                        aria-label="Open itinerary link"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="itinerary-link-icon" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14 14 10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 14v-4h-4" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h10v10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                        </svg>
                        <span>Apply now</span>
                      </a>
                    ) : null}
                    </div>
                  </article>
                );
              })()
            ))}
          </div>
        )}

        </div>
      </section>
    </main>
  );
}
