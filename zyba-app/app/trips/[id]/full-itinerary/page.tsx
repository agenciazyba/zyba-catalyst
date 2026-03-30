"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { getTripDetailsCacheKey } from "@/lib/trip-cache";

type ItineraryItem = {
  id: string | null;
  day: string | null;
  dayTitle: string | null;
  dayDescription: string | null;
  dayType: string | null;
};

type TripDetailsResponse = {
  deal: {
    itinerary: ItineraryItem[];
  } | null;
};

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!tripId || tripId === "undefined" || tripId === "null") {
        return;
      }

      const cacheKey = getTripDetailsCacheKey(tripId);
      const cached = getCache<TripDetailsResponse>(cacheKey);

      if (cached) {
        setData(cached);
        return;
      }

      const token = getSessionToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const result = await getTripDetails(token, tripId);

      if (!result.ok) {
        setMessage(result.error || result.message || "Failed to load itinerary.");
        return;
      }

      const parsed = (result.data as TripDetailsResponse) || null;
      setData(parsed);

      if (parsed) {
        setCache(cacheKey, parsed);
      }
    }

    loadData();
  }, [tripId, router]);

  const itinerary = data?.deal?.itinerary || [];

  return (
    <section className="card">
      <div className="section-title">Full Itinerary</div>

      {message && <p>{message}</p>}

      {itinerary.length === 0 ? (
        <p>No itinerary found.</p>
      ) : (
        <div className="trip-list">
          {itinerary.map((item) => (
            <div key={item.id} className="trip-card">
              <div className="trip-card-top">
                <div className="trip-title">{renderText(item.dayTitle)}</div>
                <div className="trip-status">{renderText(item.dayType)}</div>
              </div>

              <div className="trip-subtitle">{renderText(item.day)}</div>

              <div className="value" style={{ marginTop: 10 }}>
                {renderText(item.dayDescription)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}