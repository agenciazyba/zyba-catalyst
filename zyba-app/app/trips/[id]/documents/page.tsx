"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    setIsSubmitting(true);
    const result = await acknowledgeRequirements(token, tripId, "v1");

    if (!result.ok) {
      setMessage(result.error || result.message || "Failed to verify documents.");
      setIsSubmitting(false);
      return;
    }

    const nowIso = new Date().toISOString();

    // Optimistic UX: hides action button immediately and avoids repeated user validation.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        trip: {
          ...prev.trip,
          documentsAcknowledged: true,
          documentsAcknowledgedAt: prev.trip?.documentsAcknowledgedAt || nowIso,
        },
      };
    });
    setMessage("");

    // Background sync with short retries to absorb eventual Zoho propagation delay.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const updated = await getTripRequirements(token, tripId);
      if (updated.ok) {
        const payload = (updated.data as RequirementsResponse) || null;
        if (payload) {
          setData(payload);
          if (payload.trip?.documentsAcknowledged === true) break;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }

    setIsSubmitting(false);
  }

  const requirements = data?.requirements || [];
  const isAcknowledged = data?.trip?.documentsAcknowledged === true;
  const acknowledgedAt = formatVerifiedDate(data?.trip?.documentsAcknowledgedAt);
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
          <h5 className="trip-details-section-title">Documents</h5>
        </div>
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
            [0, 1].map((idx) => (
              <div className="hotel-info-field itinerary-day-card" key={`doc-skeleton-${idx}`}>
                <div className="documents-card-head">
                  <span className="skeleton-block skeleton-line w-40" />
                  <span className="skeleton-block" style={{ width: 72, height: 24, borderRadius: 10 }} />
                </div>
                <span className="skeleton-block skeleton-line w-30" />
                <span className="skeleton-block skeleton-line w-100" />
                <span className="skeleton-block skeleton-line w-80" />
              </div>
            ))
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

          {!loading && !isAcknowledged ? (
            <button className="btn documents-ack-btn" onClick={handleAcknowledge} disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "I understand and acknowledge"}
            </button>
          ) : null}
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
