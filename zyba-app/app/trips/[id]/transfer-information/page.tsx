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
  const [traveler, setTraveler] = useState<Traveler | null>(null);
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
        return;
      }

      setData((tripResult.data as TripDetailsResponse) || null);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
    }

    void loadData();
  }, [tripId, router]);

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
          <h5 className="trip-details-section-title">Transfer Informations</h5>
        </div>

        <div className="trip-details-info hotel-info-content">
          <div className="hotel-info-field">
            <p className="hotel-info-label">Driver Name</p>
            <p className="hotel-info-value">{renderText(data?.trip?.driverName)}</p>
          </div>
          <div className="hotel-info-field">
            <p className="hotel-info-label">Driver Phone</p>
            <p className="hotel-info-value">{renderText(data?.trip?.driverPhone)}</p>
          </div>
          <div className="hotel-info-field">
            <p className="hotel-info-label">Driver Information</p>
            <p className="hotel-info-value">{renderText(data?.trip?.driverInformation)}</p>
          </div>
          <div className="hotel-info-field">
            <p className="hotel-info-label">License Plate</p>
            <p className="hotel-info-value">{renderText(data?.trip?.licensePlate)}</p>
          </div>
          <div className="hotel-info-field">
            <p className="hotel-info-label">Car Photo Files</p>
            {data?.trip?.carPhoto && data.trip.carPhoto.length > 0 ? (
              <div className="transfer-car-photos">
                {data.trip.carPhoto.map((file, index) => {
                  const fileId = file?.id || file?.previewId;
                  if (!fileId || !sessionToken) return null;
                  return (
                    <img
                      key={file.id || file.previewId || `${index}`}
                      src={`/api/crm/files/${fileId}?sessionToken=${encodeURIComponent(sessionToken)}`}
                      alt={file.fileName || `Car photo ${index + 1}`}
                      className="transfer-car-photo"
                    />
                  );
                })}
              </div>
            ) : (
              <p className="hotel-info-value">-</p>
            )}
          </div>
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        <div className="hotel-info-back-fixed">
          <Link href={`/trips/${tripId}`} className="btn">
            Back to trip details
          </Link>
        </div>
      </section>
    </main>
  );
}
