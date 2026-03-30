"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  acknowledgeRequirements,
  getTripRequirements,
} from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { getCache, setCache, clearCache } from "@/lib/cache";

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
    documentsRequirementsVersion?: string | null;
  };
  deal: {
    destinationCountry?: string | null;
  } | null;
  traveler: {
    travelerName: string | null;
    originCountry: string | null;
  } | null;
  requirements: RequirementItem[];
};

function renderText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function getDocumentsCacheKey(tripId: string) {
  return `trip-documents:${tripId}`;
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData(forceRefresh = false) {
    if (!tripId || tripId === "undefined") return;

    const cacheKey = getDocumentsCacheKey(tripId);

    if (!forceRefresh) {
      const cached = getCache<RequirementsResponse>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    const token = getSessionToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const result = await getTripRequirements(token, tripId);

    if (!result.ok) {
      setMessage(result.error || "Failed to load documents.");
      setLoading(false);
      return;
    }

    const parsed = result.data as RequirementsResponse;
    setData(parsed);
    setCache(cacheKey, parsed);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [tripId, router]);

  async function handleAcknowledge() {
    if (!tripId || tripId === "undefined") return;

    const token = getSessionToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const result = await acknowledgeRequirements(token, tripId, "v1");

    if (!result.ok) {
      setMessage(result.error || result.message || "Failed to acknowledge documents.");
      return;
    }

    clearCache(getDocumentsCacheKey(tripId));
    setMessage("Documents acknowledged successfully.");
    setLoading(true);
    await loadData(true);
  }

  if (loading) {
    return (
      <section className="card">
        <p>Loading...</p>
      </section>
    );
  }

  const requirements = data?.requirements || [];

  return (
    <section className="card">
      <div className="section-title">Documents</div>

      {message && <p>{message}</p>}

      <div className="info-grid" style={{ marginBottom: 16 }}>
        <div>
          <div className="label">Traveler</div>
          <div className="value">{renderText(data?.traveler?.travelerName)}</div>
        </div>

        <div>
          <div className="label">Origin Country</div>
          <div className="value">{renderText(data?.traveler?.originCountry)}</div>
        </div>

        <div>
          <div className="label">Destination Country</div>
          <div className="value">{renderText(data?.deal?.destinationCountry)}</div>
        </div>

        <div>
          <div className="label">Acknowledged</div>
          <div className="value">
            {data?.trip?.documentsAcknowledged ? "Yes" : "No"}
          </div>
        </div>

        <div>
          <div className="label">Acknowledged At</div>
          <div className="value">
            {renderText(data?.trip?.documentsAcknowledgedAt)}
          </div>
        </div>
      </div>

      {requirements.length === 0 ? (
        <p>No documents required.</p>
      ) : (
        <div className="trip-list">
          {requirements.map((item) => (
            <div key={item.id} className="trip-card">
              <div className="trip-card-top">
                <div className="trip-title">{renderText(item.name)}</div>
                <div className="trip-status">
                  {item.isMandatory ? "Mandatory" : "Optional"}
                </div>
              </div>

              <div className="trip-subtitle">
                {renderText(item.type)}
              </div>

              <div style={{ marginTop: 10 }}>
                {renderText(item.description)}
              </div>

              {item.helpLink && (
                <a
                  href={item.helpLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginTop: 10, display: "block" }}
                >
                  View instructions
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={handleAcknowledge}>
          I understand and acknowledge
        </button>
      </div>
    </section>
  );
}