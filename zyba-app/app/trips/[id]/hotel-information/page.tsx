"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { getTripDetailsCacheKey } from "@/lib/trip-cache";

type TripDetailsResponse = {
  trip: {
    hotelName: string | null;
    hotelInformation: string | null;
    hotelConfirmationCode: string | null;
    hotelAddress: string | null;
    checkIn: string | null;
    checkOut: string | null;
  };
};

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
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
        setMessage(result.error || result.message || "Failed to load hotel info.");
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

  return (
    <section className="card">
      <div className="section-title">Hotel Information</div>

      {message && <p>{message}</p>}

      <div className="info-grid">
        <div>
          <div className="label">Hotel Name</div>
          <div className="value">{renderText(data?.trip?.hotelName)}</div>
        </div>

        <div>
          <div className="label">Hotel Information</div>
          <div className="value">{renderText(data?.trip?.hotelInformation)}</div>
        </div>

        <div>
          <div className="label">Confirmation Code</div>
          <div className="value">{renderText(data?.trip?.hotelConfirmationCode)}</div>
        </div>

        <div>
          <div className="label">Hotel Address</div>
          <div className="value">{renderText(data?.trip?.hotelAddress)}</div>
        </div>

        <div>
          <div className="label">Check In</div>
          <div className="value">{renderText(data?.trip?.checkIn)}</div>
        </div>

        <div>
          <div className="label">Check Out</div>
          <div className="value">{renderText(data?.trip?.checkOut)}</div>
        </div>
      </div>
    </section>
  );
}