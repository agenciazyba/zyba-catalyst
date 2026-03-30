"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import TripMenu from "@/components/TripMenu";
import { getTripDetails } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type TripSummaryData = {
  trip: {
    totalAmount: number | null;
    deal: {
      id: string | null;
      name: string | null;
    };
  };
  deal: {
    destination: {
      id: string | null;
      name: string | null;
    } | null;
  } | null;
};

function formatCurrency(value: number | null) {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

export default function TripLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [summary, setSummary] = useState<TripSummaryData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSummary() {
      if (!tripId || tripId === "undefined" || tripId === "null") {
        return;
      }

      const token = getSessionToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const result = await getTripDetails(token, tripId);

      if (!result.ok) {
        setMessage(result.error || result.message || "Failed to load trip summary.");
        return;
      }

      setSummary((result.data as TripSummaryData) || null);
    }

    loadSummary();
  }, [tripId, router]);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Zyba App</div>
          <h1 className="page-title">Trip Details</h1>
        </div>

        <LogoutButton />
      </div>

      <p>
        <Link href="/trips">← Back to Trips</Link>
      </p>

      <section className="card">
        <div className="section-title">Trip Summary</div>

        {message && <p>{message}</p>}

        <div className="info-grid">
          <div>
            <div className="label">Deal Name</div>
            <div className="value">{renderText(summary?.trip?.deal?.name)}</div>
          </div>

          <div>
            <div className="label">Vendor / Destination</div>
            <div className="value">{renderText(summary?.deal?.destination?.name)}</div>
          </div>

          <div>
            <div className="label">Total Amount</div>
            <div className="value">{formatCurrency(summary?.trip?.totalAmount ?? null)}</div>
          </div>
        </div>
      </section>

      <TripMenu />

      <div className="section-block">{children}</div>
    </main>
  );
}