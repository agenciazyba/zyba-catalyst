"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
        return;
      }

      setData((tripResult.data as TripDetailsResponse) || null);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
    }

    void loadData();
  }, [tripId, router]);

  return (
    <main className="trip-details-page">
      <header className="trip-details-header">
        <div className="trip-details-header-top">
          <div className="trip-details-user-block">
            <Image
              src="/brand/Trans_Simb_Creme.png"
              alt="Zyba symbol"
              width={31}
              height={31}
              style={{ width: 31, height: "auto" }}
            />
            <h2 className="trip-details-greeting">Hi,{traveler?.travelerName?.split(" ")[0] || "Traveler"}</h2>
          </div>
          <button type="button" className="trips-notify-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="trips-notify-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.5H4.5a1 1 0 0 1-.78-1.63l1.02-1.28c.5-.62.76-1.4.76-2.2V10a6.5 6.5 0 1 1 13 0v2.39c0 .8.27 1.58.76 2.2l1.02 1.28a1 1 0 0 1-.78 1.63h-2.14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20a2.5 2.5 0 0 0 5 0" />
            </svg>
          </button>
        </div>
      </header>

      <section className="trip-details-body">
        <h5 className="trip-details-section-title trip-details-title-first">Hotel Informations</h5>

        <div className="trip-details-info hotel-info-content">
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
