"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTrips, getTraveler, type Trip } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { getCache, setCache } from "@/lib/cache";
import { getTravelerCacheKey, getTripsListCacheKey } from "@/lib/trip-cache";

type Traveler = {
  travelerName?: string | null;
  email?: string | null;
  passport?: string | null;
};

function formatCurrency(value: number | null) {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function TripsPage() {
  const router = useRouter();
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const token = getSessionToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const cachedTraveler = getCache<Traveler>(getTravelerCacheKey());
      const cachedTrips = getCache<Trip[]>(getTripsListCacheKey());

      if (cachedTraveler) {
        setTraveler(cachedTraveler);
      }

      if (cachedTrips) {
        setTrips(cachedTrips);
        setLoading(false);
      }

      if (cachedTraveler && cachedTrips) {
        return;
      }

      const travelerResult = await getTraveler(token);
      const tripsResult = await getTrips(token);

      if (!travelerResult.ok) {
        setError(travelerResult.error || travelerResult.message || "Failed to load traveler.");
        setLoading(false);
        return;
      }

      if (!tripsResult.ok) {
        setError(tripsResult.error || tripsResult.message || "Failed to load trips.");
        setLoading(false);
        return;
      }

      const parsedTraveler = (travelerResult.data as Traveler) || null;

      const tripsData = Array.isArray(tripsResult.data) ? tripsResult.data : [];
      const normalizedTrips = tripsData
        .filter((item: any) => item && item.id)
        .map((item: any) => ({
          id: String(item.id),
          dealName: item.dealName ?? null,
          subject: item.subject ?? null,
          status: item.status ?? null,
          totalAmount: item.totalAmount ?? null,
        }));

      setTraveler(parsedTraveler);
      setTrips(normalizedTrips);

      if (parsedTraveler) {
        setCache(getTravelerCacheKey(), parsedTraveler);
      }

      setCache(getTripsListCacheKey(), normalizedTrips);
      setLoading(false);
    }

    loadData();
  }, [router]);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Zyba App</div>
          <h1 className="page-title">My Trips</h1>
        </div>

        <LogoutButton />
      </div>

      {traveler && (
        <section className="card">
          <div className="section-title">Traveler</div>
          <div className="info-grid">
            <div>
              <div className="label">Name</div>
              <div className="value">{traveler.travelerName || "-"}</div>
            </div>

            <div>
              <div className="label">Email</div>
              <div className="value">{traveler.email || "-"}</div>
            </div>

            <div>
              <div className="label">Passport</div>
              <div className="value">{traveler.passport || "-"}</div>
            </div>
          </div>
        </section>
      )}

      <section className="section-block">
        <div className="section-title">Trips</div>

        {loading && <p>Loading...</p>}
        {!loading && error && <p>{error}</p>}
        {!loading && !error && trips.length === 0 && <p>No trips available.</p>}

        {!loading && !error && trips.length > 0 && (
          <div className="trip-list">
            {trips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`} className="trip-card">
                <div className="trip-card-top">
                  <div className="trip-title">{trip.dealName || "Untitled trip"}</div>
                  <div className="trip-status">{trip.status || "-"}</div>
                </div>

                <div className="trip-subtitle">{trip.subject || "-"}</div>

                <div className="trip-footer">
                  <span>Total</span>
                  <strong>{formatCurrency(trip.totalAmount)}</strong>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                  ID: {trip.id}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}