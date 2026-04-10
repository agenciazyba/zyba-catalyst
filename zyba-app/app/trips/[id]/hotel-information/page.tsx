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
    hotelName: string | null;
    hotelInformation: string | null;
    hotelConfirmationCode: string | null;
    hotelAddress: string | null;
    checkIn: string | null;
    checkOut: string | null;
  };
};

type Traveler = {
  travelerName?: string | null;
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
        setMessage(tripResult.error || tripResult.message || "Failed to load hotel info.");
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
          <h5 className="trip-details-section-title">Hotel Informations</h5>
        </div>

        <div className="trip-details-info hotel-info-content">
          {loading
            ? [0, 1, 2, 3].map((idx) => (
                <div className="hotel-info-field skeleton-card" style={{ padding: 12 }} key={`hotel-skeleton-${idx}`}>
                  <span className="skeleton-block skeleton-line w-30" />
                  <span className="skeleton-block skeleton-line w-80" />
                  <span className="skeleton-block skeleton-line w-100" />
                </div>
              ))
            : (
              <>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Hotel Name</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.hotelName)}</p>
                </div>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Information</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.hotelInformation)}</p>
                </div>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Confirmation</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.hotelConfirmationCode)}</p>
                </div>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Address</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.hotelAddress)}</p>
                </div>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Check in</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.checkIn)}</p>
                </div>
                <div className="hotel-info-field">
                  <p className="hotel-info-label">Check out</p>
                  <p className="hotel-info-value">{renderText(data?.trip?.checkOut)}</p>
                </div>
              </>
            )}
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
