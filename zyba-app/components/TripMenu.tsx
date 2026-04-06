"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";

const items = [
  { label: "Transfers", slug: "transfer-information", icon: "🚐" },
  { label: "Hotel", slug: "hotel-information", icon: "🏨" },
  { label: "Itinerary", slug: "full-itinerary", icon: "🗺️" },
  { label: "Documents", slug: "documents", icon: "📄" },
];

export default function TripMenu() {
  const params = useParams();
  const pathname = usePathname();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  if (!tripId) return null;

  return (
    <nav style={{ display: 'flex', overflowX: 'auto', gap: 24, padding: '12px 0 24px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {items.map((item) => {
        const href = `/trips/${tripId}/${item.slug}`;
        const isActive = pathname === href;

        return (
          <Link
            key={item.slug}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              opacity: isActive ? 1 : 0.5,
              minWidth: '64px',
              textDecoration: 'none'
            }}
          >
            <div style={{ 
              width: 56, 
              height: 56, 
              borderRadius: '20px', 
              background: isActive ? 'var(--color-primary)' : 'var(--color-bg-card)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: isActive ? '0 8px 16px rgba(17, 96, 51, 0.2)' : '0 4px 12px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--color-primary)' : 'var(--color-dark)', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}