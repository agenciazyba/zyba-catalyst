"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import Link from "next/link";

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

type Traveler = {
  travelerName?: string | null;
};

function hasText(value?: string | null) {
  return Boolean(String(value || "").trim());
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
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
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
        setMessage(tripResult.error || tripResult.message || "Failed to load transfer info.");
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

  const carPhotos =
    data?.trip?.carPhoto?.map((file, index) => {
      const attachmentId = file?.id || file?.previewId;
      const fileId = attachmentId ? `Sales_Orders_${tripId}_${attachmentId}` : "";
      if (!fileId || !sessionToken) return null;

      return {
        id: file.id || file.previewId || `${index}`,
        src: `/api/crm/files/${fileId}?sessionToken=${encodeURIComponent(sessionToken)}`,
        alt: file.fileName || `Vehicle photo ${index + 1}`,
      };
    }).filter(Boolean) || [];

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
        <div className="transfer-page-stack">
          <div className="transfer-page-heading">
            <h1 className="transfer-page-title">Transfer Details</h1>
            <p className="transfer-page-subtitle">Your ride to the trailhead is confirmed.</p>
          </div>

          {loading ? (
            <>
              <div className="transfer-panel skeleton-card" style={{ minHeight: 180 }} />
              <div className="transfer-panel skeleton-card" style={{ minHeight: 300 }} />
            </>
          ) : (
            <>
              {(hasText(data?.trip?.driverName) || hasText(data?.trip?.driverPhone)) ? (
                <section className="transfer-panel">
                  <h2 className="transfer-panel-title">Your Driver</h2>

                  {hasText(data?.trip?.driverName) ? (
                    <div className="transfer-driver-card">
                      <div className="transfer-driver-avatar">👨</div>
                      <div className="transfer-driver-copy">
                        <div className="transfer-driver-name">{data?.trip?.driverName}</div>
                        {hasText(data?.trip?.driverPhone) ? (
                          <div className="transfer-driver-phone">{data?.trip?.driverPhone}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {(carPhotos.length > 0 || hasText(data?.trip?.licensePlate) || hasText(data?.trip?.driverInformation)) ? (
                <section className="transfer-panel">
                  <div className="transfer-panel-header">
                    <h2 className="transfer-panel-title">Vehicle</h2>
                    {hasText(data?.trip?.licensePlate) ? (
                      <div className="transfer-plate-chip">{data?.trip?.licensePlate}</div>
                    ) : null}
                  </div>

                  {carPhotos.length > 0 ? (
                    <div className="transfer-vehicle-hero">
                      <img src={carPhotos[0]?.src} alt={carPhotos[0]?.alt} className="transfer-vehicle-image" />
                      {hasText(carPhotos[0]?.alt) ? (
                        <div className="transfer-vehicle-caption">{carPhotos[0]?.alt}</div>
                      ) : null}
                    </div>
                  ) : null}

                  {hasText(data?.trip?.driverInformation) ? (
                    <div className="transfer-info-grid">
                      <div className="transfer-info-card">
                        <div className="transfer-info-label">Information</div>
                        <div className="transfer-info-value">{data?.trip?.driverInformation}</div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}

          {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)" }}>{message}</p> : null}

          <div className="trip-back-action">
            <Link href={`/trips/${tripId}`} className="trip-back-link">
              Back to trip details
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
