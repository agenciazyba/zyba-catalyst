"use client";

import { useEffect, useMemo, useState } from "react";
import TripBackLink from "@/components/TripBackLink";
import AppTopBar from "@/components/AppTopBar";
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
  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} />

      <section className="trip-details-body">
        <h5 className="trip-details-section-title">Documents</h5>
        {isAcknowledged ? (
          <div className="documents-verified-badge" aria-live="polite">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="documents-verified-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
            <span>Documents VERIFIED{acknowledgedAt ? ` - ${acknowledgedAt}` : ""}</span>
          </div>
        ) : null}

        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        <div className="documents-page-stack">
          {loading ? (
            [0, 1].map((idx) => (
              <div className="documents-card skeleton-card" key={`doc-skeleton-${idx}`}>
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
            <div className="documents-card">
              <p className="documents-card-copy">No mandatory documents found for this trip.</p>
            </div>
          ) : null}

          {!loading &&
            requirements.map((item) => (
              <div className="documents-card" key={item.id}>
                <div className="documents-card-head">
                  <p className="documents-card-title">{item.name || "Document"}</p>
                  <span className={item.isMandatory ? "documents-badge is-mandatory" : "documents-badge is-recommended"}>
                    {item.isMandatory ? "Mandatory" : "Recommended"}
                  </span>
                </div>
                {item.type ? <p className="documents-card-meta">{item.type}</p> : null}
                <p className="documents-card-copy">{item.description || "No description provided."}</p>
                {item.helpLink ? (
                  <a href={item.helpLink} target="_blank" rel="noreferrer" className="documents-instruction-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="documents-instruction-icon" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14 14 10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 14v-4h-4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h10v10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                    </svg>
                    <span>Apply now</span>
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

        <div className="trip-back-action">
          <TripBackLink href={`/trips/${tripId}`} />
        </div>
      </section>
    </main>
  );
}
