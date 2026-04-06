"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTraveler, getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import Image from "next/image";

type TripDetailsResponse = {
  trip: {
    id: string | null;
    salesOrderNumber?: string | null;
    status?: string | null;
    deal: {
      name: string | null;
    };
    destination?: string | null;
    tripStatus?: string | null;
    arrivalDate?: string | null;
    vendorName?: string | null;
    destinationCountry?: string | null;
  };
  deal: {
    arrivalDate: string | null;
    departureDate: string | null;
    airport: string | null;
    vendorName?: string | null;
    destinationCountry?: string | null;
    status?: string | null;
    salesOrderNumber?: string | null;
  } | null;
};

type Traveler = {
  travelerName?: string | null;
};

const links = [
  { label: "Hotel Informations", slug: "hotel-information", icon: "hotel" as const },
  { label: "Transfer Informations", slug: "transfer-information", icon: "transfer" as const },
  { label: "Full Itinerary", slug: "full-itinerary", icon: "itinerary" as const },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function TripIndexPage() {
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
    async function load() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const [tripResponse, travelerResponse] = await Promise.all([
        getTripDetails(token, tripId),
        getTraveler(token),
      ]);

      if (!tripResponse.ok) {
        setMessage(tripResponse.error || tripResponse.message || "Failed to load trip.");
        return;
      }
      setData((tripResponse.data as TripDetailsResponse) || null);

      if (travelerResponse.ok) {
        setTraveler((travelerResponse.data as Traveler) || null);
      }
    }
    if (tripId) void load();
  }, [tripId, router]);

  const confirmationNumber =
    data?.trip?.salesOrderNumber ||
    data?.deal?.salesOrderNumber ||
    data?.trip?.id ||
    "-";
  const destinationVendor =
    data?.trip?.vendorName ||
    data?.deal?.vendorName ||
    data?.trip?.deal?.name ||
    "-";
  const destinationCountry =
    data?.trip?.destinationCountry ||
    data?.deal?.destinationCountry ||
    data?.trip?.destination ||
    "-";
  const arrivalDate =
    data?.trip?.arrivalDate ||
    data?.deal?.arrivalDate ||
    null;
  const tripStatus =
    data?.trip?.tripStatus ||
    data?.trip?.status ||
    data?.deal?.status ||
    "-";

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
        <h5 className="trip-details-section-title trip-details-title-first">Notifications</h5>

        <div className="trip-details-info">
          <p className="trip-details-info-line">
            <strong>Confirmation number:</strong>{" "}
            {confirmationNumber}
          </p>
          <p className="trip-details-info-line">
            <strong>Destination:</strong>{" "}
            {destinationVendor} - {destinationCountry}
          </p>
          <p className="trip-details-info-line">
            <strong>Arrival Date:</strong>{" "}
            {formatDate(arrivalDate)}
          </p>
          <p className="trip-details-info-line">
            <strong>Status:</strong>{" "}
            <span className="trip-details-status">{tripStatus}</span>
          </p>
        </div>

        <div className="trip-details-gap-lg" />

        <h5 className="trip-details-section-title">Trip Details</h5>

        <div className="trip-details-cards-row">
          <Link href={`/trips/${tripId}/flight-information`} className="trip-details-card-btn">
            <Image src="/icons/Icon_flight.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
            <span className="trip-details-card-label">Flight Info</span>
          </Link>

          <Link href={`/trips/${tripId}/documents`} className="trip-details-card-btn">
            <Image src="/icons/Icon_Document.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
            <span className="trip-details-card-label">Documents</span>
          </Link>

          <Link href={`/trips/${tripId}/shop-gears`} className="trip-details-card-btn is-shop">
            <Image src="/icons/Icon_shop.svg" alt="" width={24} height={24} className="trip-details-card-icon" />
            <span className="trip-details-card-label">Shop gears</span>
          </Link>
        </div>

        <div className="trip-details-gap-lg" />

        <div className="trip-details-links-list">
          {links.map((item) => (
            <Link key={item.label} href={`/trips/${tripId}/${item.slug}`} className="trip-details-link-row">
              <span className="trip-details-link-left">
                {item.icon === "hotel" ? (
                  <Image src="/icons/Icon_Hotel.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
                ) : item.icon === "transfer" ? (
                  <Image src="/icons/Icon_TRansfer.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
                ) : (
                  <Image src="/icons/Icon_Itinerary.svg" alt="" width={24} height={29} className="trip-details-link-icon" />
                )}
                <span className="trip-details-link-text">{item.label}</span>
              </span>
              <span className="trip-details-link-arrow">›</span>
            </Link>
          ))}
        </div>

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  );
}
