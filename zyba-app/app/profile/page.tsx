"use client";

import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getTraveler } from "@/lib/api";
import { getDefaultLoginPath, getSessionToken } from "@/lib/auth";

type Traveler = {
  id?: string | null;
  travelerName?: string | null;
  email?: string | null;
  passport?: string | null;
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
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= 4) return text;

  const start = text.slice(0, Math.min(4, text.length - 2));
  const end = text.slice(-2);
  const hiddenCount = Math.max(2, text.length - start.length - end.length);
  return `${start}${"*".repeat(hiddenCount)}${end}`;
}

function getCountryFlag(country?: string | null) {
  const normalized = String(country || "").trim().toLowerCase();

  if (normalized === "sweden") return "🇸🇪";
  if (normalized === "brazil") return "🇧🇷";
  if (normalized === "usa" || normalized === "united states" || normalized === "united states of america") return "🇺🇸";
  if (normalized === "argentina") return "🇦🇷";
  if (normalized === "colombia") return "🇨🇴";
  return "🌍";
}

function ProfileCard({
  label,
  value,
  icon,
  trailing,
}: {
  label: string;
  value: string;
  icon: string;
  trailing?: ReactNode;
}) {
  return (
    <article className="profile-card">
      <div className="profile-card-head">
        <h3 className="profile-card-label">{label}</h3>
        <span className="profile-card-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="profile-card-value-wrap">
        <p className="profile-card-value">{value}</p>
        {trailing}
      </div>
    </article>
  );
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
        router.replace(getDefaultLoginPath());
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
    if (!token || photoFailed) return "";

    const recordId = String(data.id || "").trim();
    const fileKey = getFileKeyFromRecordImage(data.recordImage, recordId);
    if (!fileKey) return "";
    if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) return fileKey;
    return `/api/crm/files/${fileKey}?sessionToken=${token}`;
  }, [data, photoFailed]);

  const firstName = data?.travelerName?.split(" ")[0] || "Traveler";
  const country = data?.country || "-";
  const countryFlag = getCountryFlag(data?.country);

  return (
    <main className="profile-page-shell">
      <AppTopBar firstName={firstName} />

      <section className="profile-page-body">
        <TripBackLink href="/trips" label="Return to trips" />
        <div className="profile-hero">
          <div className="profile-avatar-wrap">
            {loading ? (
              <span className="skeleton-block profile-avatar-skeleton" />
            ) : photoUrl ? (
              <Image
                src={photoUrl}
                alt={data?.travelerName || "Traveler"}
                width={128}
                height={128}
                unoptimized
                onError={() => setPhotoFailed(true)}
                className="profile-avatar-image"
              />
            ) : (
              <div className="profile-avatar-fallback">{firstName.slice(0, 1)}</div>
            )}
          </div>

          <h1 className="profile-hero-name">{loading ? "Loading..." : data?.travelerName || "Traveler"}</h1>
        </div>

        {message ? <p className="page-subtitle profile-error">{message}</p> : null}

        <div className="profile-cards-grid">
          {loading ? (
            [0, 1, 2, 3].map((idx) => (
              <div className="profile-card skeleton-card" key={`profile-card-skeleton-${idx}`}>
                <span className="skeleton-block skeleton-line w-30" />
                <span className="skeleton-block skeleton-line w-80" />
              </div>
            ))
          ) : (
            <>
              <ProfileCard label="Full Name" value={data?.travelerName || "-"} icon="🪪" />
              <ProfileCard label="Email" value={data?.email || "-"} icon="✉" />
              <ProfileCard
                label="Country"
                value={country}
                icon="◔"
                trailing={<span className="profile-card-trailing-flag">{countryFlag}</span>}
              />
              <ProfileCard
                label="Passport Number"
                value={maskPassport(data?.passport)}
                icon="✈"
                trailing={<span className="profile-card-meta">On file</span>}
              />
            </>
          )}
        </div>

        {!loading ? (
          <div className="profile-logout-wrap">
            <LogoutButton className="profile-logout-link" />
          </div>
        ) : null}
      </section>
    </main>
  );
}
