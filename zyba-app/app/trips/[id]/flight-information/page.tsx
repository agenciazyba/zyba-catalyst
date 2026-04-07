"use client";

import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTraveler } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type Traveler = {
  travelerName?: string | null;
};

export default function FlightInformationPage() {
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
        <h5 className="trip-details-section-title trip-details-title-first">Flight Information</h5>

        <div className="trip-details-info hotel-info-content itinerary-days-list">
          <div className="hotel-info-field itinerary-day-card">
            <p className="hotel-info-label">Coming soon</p>
            <p className="hotel-info-value">This screen is being finalized for V1.1.</p>
          </div>
        </div>

        <div className="hotel-info-back-fixed">
          <Link href={`/trips/${tripId}`} className="btn">
            Back to trip details
          </Link>
        </div>
      </section>
    </main>
  );
}
