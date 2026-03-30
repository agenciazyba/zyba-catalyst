"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { getTripDetailsCacheKey } from "@/lib/trip-cache";

type TripDetailsResponse = {
  trip: {
    driverName: string | null;
    driverPhone: string | null;
    driverInformation: string | null;
    licensePlate: string | null;
    carPhoto: Array<{
      id: string | null;
      previewId: string | null;
      fileName: string | null;
    }>;
  };
};

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

export default function TransferInformationPage() {
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
        setMessage(result.error || result.message || "Failed to load transfer info.");
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
      <div className="section-title">Transfer Information</div>

      {message && <p>{message}</p>}

      <div className="info-grid">
        <div>
          <div className="label">Driver Name</div>
          <div className="value">{renderText(data?.trip?.driverName)}</div>
        </div>

        <div>
          <div className="label">Driver Phone</div>
          <div className="value">{renderText(data?.trip?.driverPhone)}</div>
        </div>

        <div>
          <div className="label">Driver Information</div>
          <div className="value">{renderText(data?.trip?.driverInformation)}</div>
        </div>

        <div>
          <div className="label">License Plate</div>
          <div className="value">{renderText(data?.trip?.licensePlate)}</div>
        </div>

        <div>
          <div className="label">Car Photo Files</div>
          <div className="value">
            {data?.trip?.carPhoto && data.trip.carPhoto.length > 0
              ? data.trip.carPhoto.map((file) => file.fileName || file.id).join(", ")
              : "-"}
          </div>
        </div>
      </div>
    </section>
  );
}