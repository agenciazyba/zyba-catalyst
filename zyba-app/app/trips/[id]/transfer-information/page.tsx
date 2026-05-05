"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import TripBackLink from "@/components/TripBackLink";
import AppTopBar from "@/components/AppTopBar";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type TripDetailsResponse = {
  trip: {
    driverName: string | null;
    driverPhone: string | null;
    driverInformation: string | null;
    licensePlate: string | null;
    carPhoto: Array<{
      id: string | null;
      fileId?: string | null;
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

  const carPhotos =
    data?.trip?.carPhoto?.map((file, index) => {
      const attachmentId = file?.id || file?.previewId || file?.fileId;
      const fileId = attachmentId ? `Sales_Orders_${tripId}_${attachmentId}` : "";
      if (!fileId || !sessionToken) return null;

      return {
        id: file.id || file.previewId || file.fileId || `${index}`,
        src: `/api/crm/files/${fileId}?sessionToken=${encodeURIComponent(sessionToken)}`,
        alt: file.fileName || `Vehicle photo ${index + 1}`,
      };
    }).filter(Boolean) || [];

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <div className={`hotel-page-transition-shell ${isLeaving ? "is-leaving" : "is-entering"}`}>
        <div className="transfer-page-stack">
          <div className="transfer-page-heading trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "40ms" }}>
            <h1 className="transfer-page-title">Transfer Details</h1>
          </div>

          {loading ? (
            <>
              <div className="transfer-panel skeleton-card" style={{ minHeight: 180 }} />
              <div className="transfer-panel skeleton-card" style={{ minHeight: 300 }} />
            </>
          ) : (
            <>
              {(hasText(data?.trip?.driverName) || hasText(data?.trip?.driverPhone)) ? (
                <section className="transfer-panel trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "140ms" }}>
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
                <section className="transfer-panel trip-details-reveal" style={{ ["--trip-reveal-delay" as string]: "260ms" }}>
                  <div className="transfer-panel-header">
                    <h2 className="transfer-panel-title">Vehicle</h2>
                    {hasText(data?.trip?.licensePlate) ? (
                      <div className="transfer-plate-chip">{data?.trip?.licensePlate}</div>
                    ) : null}
                  </div>

                  {carPhotos.length > 0 ? (
                    <div className="transfer-vehicle-hero">
                      <Image
                        src={carPhotos[0]?.src || ""}
                        alt={carPhotos[0]?.alt || "Vehicle photo"}
                        width={1200}
                        height={688}
                        unoptimized
                        className="transfer-vehicle-image"
                      />
                    </div>
                  ) : null}

                  {hasText(data?.trip?.driverInformation) ? (
                    <div className="transfer-info-grid">
                      <div className="transfer-info-card">
                        <h3 className="trip-content-card-title">Transfer Details</h3>
                        <div className="trip-content-card-copy">
                          <p className="trip-content-card-line">{data?.trip?.driverInformation}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}

          {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)" }}>{message}</p> : null}

          <div className="trip-back-action">
            <TripBackLink href={`/trips/${tripId}`} onClick={handleBackNavigation} ariaDisabled={isLeaving} />
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}
