"use client";

import TripBackLink from "@/components/TripBackLink";
import AppTopBar from "@/components/AppTopBar";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTraveler } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type Traveler = {
  travelerName?: string | null;
};

export default function ShopGearsPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [traveler, setTraveler] = useState<Traveler | null>(null);

  useEffect(() => {
    async function loadData() {
      const token = getSessionToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const travelerResult = await getTraveler(token);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
    }

    void loadData();
  }, [router]);

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <h5 className="trip-details-section-title trip-details-title-first">Shop gears</h5>

        <div className="trip-details-info hotel-info-content itinerary-days-list">
          <div className="hotel-info-field itinerary-day-card">
            <p className="hotel-info-label">Coming soon</p>
            <p className="hotel-info-value">We are preparing the best gear for your trip. Soon, you will be able to buy everything you need at the best prices.</p>
          </div>
        </div>

        <div className="trip-back-action">
          <TripBackLink href={`/trips/${tripId}`} />
        </div>
      </section>
    </main>
  );
}
