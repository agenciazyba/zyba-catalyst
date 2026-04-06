"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTrips, getTraveler, type Trip } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Traveler = {
  travelerName?: string | null;
};

function formatDateUs(value: string | null | undefined) {
  if (!value) return "July 14th 2026";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const day = d.getUTCDate();
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);
  const year = d.getUTCFullYear();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${month} ${day}${suffix} ${year}`;
}

export default function TripsPage() {
  const router = useRouter();
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const token = getSessionToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const [travelerResult, tripsResult] = await Promise.all([getTraveler(token), getTrips(token)]);

      if (!travelerResult.ok || !tripsResult.ok) {
        setLoading(false);
        return;
      }

      const parsedTraveler = (travelerResult.data as Traveler) || null;
      const tripsData = Array.isArray(tripsResult.data) ? tripsResult.data : [];
      const normalizedTrips = tripsData
        .filter((item: Trip) => item && item.id)
        .map((item: Trip) => ({
          id: String(item.id),
          dealName: item.dealName ?? null,
          subject: item.subject ?? null,
          status: item.status ?? null,
          totalAmount: item.totalAmount ?? null,
          arrivalDate: item.arrivalDate ?? null,
          coverId: item.coverId ?? null,
        }));

      setTraveler(parsedTraveler);
      setTrips(normalizedTrips);
      setLoading(false);
    }

    void loadData();
  }, [router]);

  const token = getSessionToken() || "";

  function getBgUrl(trip: Trip) {
    return trip.coverId
      ? `/api/crm/files/${trip.coverId}?sessionToken=${token}`
      : "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80";
  }

  return (
    <main className="trips-page">
      <header className="trips-header">
        <div className="trips-header-top">
          <div className="trips-user-block">
            <Image
              src="/brand/Trans_Simb_Creme.png"
              alt="Zyba symbol"
              width={31}
              height={31}
              style={{ width: 31, height: "auto" }}
            />
            <h2 className="trips-greeting">Hi,{traveler?.travelerName?.split(" ")[0] || "Traveler"}</h2>
          </div>
          <button type="button" className="trips-notify-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="trips-notify-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.5H4.5a1 1 0 0 1-.78-1.63l1.02-1.28c.5-.62.76-1.4.76-2.2V10a6.5 6.5 0 1 1 13 0v2.39c0 .8.27 1.58.76 2.2l1.02 1.28a1 1 0 0 1-.78 1.63h-2.14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20a2.5 2.5 0 0 0 5 0" />
            </svg>
          </button>
        </div>

        <p className="trips-header-note">
          Avisos para o viajante , importante....
        </p>
      </header>

      <section className="trips-body">
        <h4 className="trips-section-title">Your Trips</h4>

        {loading ? (
          <p className="text-h5" style={{ marginTop: 25, color: "var(--color-black)" }}>Loading trips...</p>
        ) : trips.length === 0 ? (
          <p className="text-h5" style={{ marginTop: 25, color: "var(--color-black)" }}>No trips available.</p>
        ) : (
          <div className="trips-carousel-view">
            <div className="trips-carousel-track">
              {trips.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.id}`} className="trip-card-link">
                  <article
                    className="trip-card-modern"
                    style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.9) 100%), url('${getBgUrl(trip)}')` }}
                  >
                    <span className="trip-date-badge">{formatDateUs(trip.arrivalDate)}</span>
                    <div className="trip-card-bottom">
                      <h5 className="trip-card-title">Trip name</h5>
                      <p className="trip-card-subtitle">{trip.dealName || "Lorem ipsum is simply dummy text of the printing and typesetting industry."}</p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
