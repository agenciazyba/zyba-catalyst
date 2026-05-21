"use client";

import AppTopBar from "@/components/AppTopBar";
import { getTraveler } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

export default function OrdersPage() {
  const router = useRouter();
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTraveler() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const result = await getTraveler(token);
      if (result.ok) {
        setTraveler((result.data as Traveler) || null);
      }
      setLoading(false);
    }

    void loadTraveler();
  }, [router]);

  return (
    <main className="orders-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="orders-body">
        <h4 className="orders-title">My orders</h4>
        <div className="orders-empty-card">
          <p className="orders-empty-title">{loading ? "Loading orders..." : "No orders yet"}</p>
          {!loading ? <p className="orders-empty-copy">Your gear orders will appear here.</p> : null}
        </div>
      </section>
    </main>
  );
}
