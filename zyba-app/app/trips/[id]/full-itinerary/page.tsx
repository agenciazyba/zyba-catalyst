"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

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

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [data, setData] = useState<TripDetailsResponse | null>(null);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
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
        return;
      }

      setData((tripResult.data as TripDetailsResponse) || null);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
    }

    void loadData();
  }, [tripId, router]);

  const itinerary = data?.deal?.itinerary || [];
  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(`/trips/${tripId}`);
  };

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
        <div className="trip-section-title-row trip-details-title-first">
          <button type="button" className="trip-section-back-btn" aria-label="Go back" onClick={goBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="trip-section-back-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5 8 12l6.5 6.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12H20" />
            </svg>
          </button>
          <h5 className="trip-details-section-title">Full Itinerary</h5>
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        {itinerary.length === 0 ? (
          <div className="trip-details-info hotel-info-content">
            <div className="hotel-info-field">
              <p className="hotel-info-label">Information</p>
              <p className="hotel-info-value">No itinerary found.</p>
            </div>
          </div>
        ) : (
          <div className="trip-details-info hotel-info-content itinerary-days-list">
            {itinerary.map((item, index) => (
              (() => {
                const dayLink = extractUrl(item.dayLink || item.dayDescription);
                return (
                  <div className="hotel-info-field itinerary-day-card" key={item.id || index}>
                    <p className="hotel-info-label">
                      Day {index + 1} - {renderText(item.dayType) !== "-" ? renderText(item.dayType) : renderText(item.dayTitle) || "Scheduled Plan"}
                    </p>
                    <p className="itinerary-day-date">{formatDate(item.day, `Day ${index + 1}`)}</p>
                    <p className="hotel-info-value">{renderText(item.dayDescription)}</p>
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
                        <span>VIEW INSTRUCTION</span>
                      </a>
                    ) : null}
                  </div>
                );
              })()
            ))}
          </div>
        )}

        <div className="hotel-info-back-fixed">
          <Link href={`/trips/${tripId}`} className="btn">
            Back to trip details
          </Link>
        </div>
      </section>
    </main>
  );
}
