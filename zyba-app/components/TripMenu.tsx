"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, usePathname } from "next/navigation";

const items = [
  { label: "Transfer Information", slug: "transfer-information" },
  { label: "Hotel Information", slug: "hotel-information" },
  { label: "Full Itinerary", slug: "full-itinerary" },
  { label: "Documents", slug: "documents" },
];

export default function TripMenu() {
  const params = useParams();
  const pathname = usePathname();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  if (!tripId || tripId === "undefined" || tripId === "null") {
    return null;
  }

  return (
    <nav className="trip-menu">
      {items.map((item) => {
        const href = `/trips/${tripId}/${item.slug}`;
        const isActive = pathname === href;

        return (
          <Link
            key={item.slug}
            href={href}
            className={`trip-menu-link ${isActive ? "active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}