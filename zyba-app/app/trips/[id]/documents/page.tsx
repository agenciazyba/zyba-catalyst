"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { acknowledgeRequirements, getTraveler, getTripRequirements } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type RequirementItem = {
  id: string | null;
  name: string | null;
  type: string | null;
  description: string | null;
  helpLink: string | null;
  isMandatory: boolean;
};

type RequirementsResponse = {
  trip: {
    documentsAcknowledged?: boolean;
    documentsAcknowledgedAt?: string | null;
  };
  requirements: RequirementItem[];
};

type Traveler = {
  travelerName?: string | null;
};

function formatVerifiedDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!tripId || tripId === "undefined") return;

      const token = getSessionToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const [requirementsResult, travelerResult] = await Promise.all([
        getTripRequirements(token, tripId),
        getTraveler(token),
      ]);

      if (!requirementsResult.ok) {
        setMessage(requirementsResult.error || "Failed to load documents.");
        setLoading(false);
        return;
      }

      setData((requirementsResult.data as RequirementsResponse) || null);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }
      setLoading(false);
    }

    void loadData();
  }, [tripId, router]);

  async function handleAcknowledge() {
    if (!tripId || tripId === "undefined") return;

    const token = getSessionToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const result = await acknowledgeRequirements(token, tripId, "v1");

    if (!result.ok) {
      setMessage(result.error || result.message || "Failed to verify documents.");
      setLoading(false);
      return;
    }

    const updated = await getTripRequirements(token, tripId);
    if (updated.ok) {
      setData((updated.data as RequirementsResponse) || null);
      setMessage("");
    }
    setLoading(false);
  }

  const requirements = data?.requirements || [];
  const isAcknowledged = data?.trip?.documentsAcknowledged === true;
  const acknowledgedAt = formatVerifiedDate(data?.trip?.documentsAcknowledgedAt);

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
        <h5 className="trip-details-section-title trip-details-title-first">Documents</h5>
        {isAcknowledged ? (
          <div className="documents-verified-badge" aria-live="polite">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="documents-verified-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
            <span>Documents VERIFIED{acknowledgedAt ? ` - ${acknowledgedAt}` : ""}</span>
          </div>
        ) : null}

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        <div className="trip-details-info hotel-info-content itinerary-days-list">
          {loading ? (
            <div className="hotel-info-field itinerary-day-card">
              <p className="hotel-info-value">Loading documents...</p>
            </div>
          ) : null}

          {!loading && requirements.length === 0 ? (
            <div className="hotel-info-field itinerary-day-card">
              <p className="hotel-info-value">No mandatory documents found for this trip.</p>
            </div>
          ) : null}

          {!loading &&
            requirements.map((item) => (
              <div className="hotel-info-field itinerary-day-card" key={item.id}>
                <div className="documents-card-head">
                  <p className="hotel-info-label">{item.name || "Document"}</p>
                  {item.isMandatory ? <span className="documents-mandatory">Mandatory</span> : null}
                </div>
                <p className="hotel-info-value">
                  {item.type || "Type not provided"}
                </p>
                <p className="hotel-info-value">{item.description || "No description provided."}</p>
                {item.helpLink ? (
                  <a href={item.helpLink} target="_blank" rel="noreferrer" className="documents-instruction-link">
                    Click here to apply
                  </a>
                ) : null}
              </div>
            ))}
        </div>

        {!loading && !isAcknowledged ? (
          <button className="btn" onClick={handleAcknowledge} disabled={loading}>
            {loading ? "Verifying..." : "I understand and acknowledge"}
          </button>
        ) : null}

        <div className="hotel-info-back-fixed">
          <Link href={`/trips/${tripId}`} className="btn">
            Back to trip details
          </Link>
        </div>
      </section>
    </main>
  );
}
