"use client";

import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTraveler } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

type Traveler = {
  id?: string | null;
  travelerName?: string | null;
  email?: string | null;
  passport?: string | null;
  passportExpiration?: string | null;
  country?: string | null;
  recordImage?: unknown;
};

function getFileKeyFromRecordImage(recordImage: unknown, recordId: string) {
  if (!recordImage) return "";

  if (typeof recordImage === "string") {
    const value = recordImage.trim();
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.includes("_")) return value;
    return recordId ? `Accounts_${recordId}_${value}` : value;
  }

  const first = Array.isArray(recordImage) ? recordImage[0] : recordImage;
  if (!first || typeof first !== "object") return "";

  const file = first as Record<string, unknown>;
  const raw =
    file.id ||
    file.previewId ||
    file.attachment_Id ||
    file.attachment_id ||
    file.File_Id__s ||
    file.file_id ||
    "";

  const attachmentId = String(raw || "").trim();
  if (!attachmentId) return "";
  if (attachmentId.includes("_")) return attachmentId;
  return recordId ? `Accounts_${recordId}_${attachmentId}` : attachmentId;
}

function maskPassport(value?: string | null) {
  if (!value) return "-";
  if (value.length <= 2) return value;
  return `${"*".repeat(Math.max(0, value.length - 2))}${value.slice(-2)}`;
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<Traveler | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    async function load() {
      const token = getSessionToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const response = await getTraveler(token);
      if (!response.ok) {
        setMessage(response.error || response.message || "Failed to load profile.");
        setLoading(false);
        return;
      }
      setData((response.data as Traveler) || null);
      setLoading(false);
    }
    void load();
  }, [router]);

  const photoUrl = useMemo(() => {
    if (!data) return "";
    const token = getSessionToken();
    if (!token) return "";
    if (photoFailed) return "";

    const recordId = String(data.id || "").trim();
    const fileKey = getFileKeyFromRecordImage(data.recordImage, recordId);
    if (!fileKey) return "";

    if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) return fileKey;
    return `/api/crm/files/${fileKey}?sessionToken=${token}`;
  }, [data, photoFailed]);

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
            <h2 className="trip-details-greeting">Hi,{data?.travelerName?.split(" ")[0] || "Traveler"}</h2>
          </div>
          <NotificationsBell />
        </div>
      </header>

      <section className="trip-details-body">
        <h5 className="trip-details-section-title trip-details-title-first">Profile</h5>
        {message ? <p className="page-subtitle" style={{ color: "var(--color-orange)", marginTop: 12 }}>{message}</p> : null}

        <div className="trip-details-info hotel-info-content itinerary-days-list">
          <div className="hotel-info-field" style={{ placeItems: "center" }}>
            {loading ? (
              <span className="skeleton-block" style={{ width: 96, height: 96, borderRadius: "50%" }} />
            ) : photoUrl ? (
              <Image
                src={photoUrl}
                alt={data?.travelerName || "Traveler"}
                width={96}
                height={96}
                unoptimized
                onError={() => setPhotoFailed(true)}
                style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #232323" }}
              />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: "50%", border: "1px solid #232323", display: "grid", placeItems: "center" }}>
                Photo
              </div>
            )}
          </div>

          {loading ? (
            [0, 1, 2, 3, 4].map((idx) => (
              <div className="hotel-info-field itinerary-day-card" key={`profile-skeleton-${idx}`}>
                <span className="skeleton-block skeleton-line w-30" />
                <span className="skeleton-block skeleton-line w-80" />
              </div>
            ))
          ) : (
            <>
              <div className="hotel-info-field itinerary-day-card">
                <p className="hotel-info-label">Name</p>
                <p className="hotel-info-value">{data?.travelerName || "-"}</p>
              </div>
              <div className="hotel-info-field itinerary-day-card">
                <p className="hotel-info-label">Email</p>
                <p className="hotel-info-value">{data?.email || "-"}</p>
              </div>
              <div className="hotel-info-field itinerary-day-card">
                <p className="hotel-info-label">Passport</p>
                <p className="hotel-info-value">{maskPassport(data?.passport)}</p>
              </div>
              <div className="hotel-info-field itinerary-day-card">
                <p className="hotel-info-label">Expiration</p>
                <p className="hotel-info-value">{formatDate(data?.passportExpiration)}</p>
              </div>
              <div className="hotel-info-field itinerary-day-card">
                <p className="hotel-info-label">Country</p>
                <p className="hotel-info-value">{data?.country || "-"}</p>
              </div>
            </>
          )}

          <div className="profile-logout-wrap">
            <LogoutButton className="profile-logout-link" />
          </div>
        </div>

        <div className="hotel-info-back-fixed">
          <Link href="/trips" className="btn">Back to trip details</Link>
        </div>
      </section>
    </main>
  );
}
