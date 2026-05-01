"use client";

import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";

type AppTopBarProps = {
  firstName?: string | null;
  cartHref?: string | null;
  cartCount?: number;
};

export default function AppTopBar({ firstName, cartHref, cartCount = 0 }: AppTopBarProps) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-row">
        <div className="app-topbar-brand">
          <Link href="/trips" aria-label="Go to trips" className="app-topbar-logo">
            <Image
              src="/brand/Trans_Simb_Creme.png"
              alt="Zyba symbol"
              width={31}
              height={31}
              style={{ width: 31, height: "auto" }}
            />
          </Link>
          <h2 className="app-topbar-greeting">Hi,{firstName || "Traveler"}</h2>
        </div>
        <div className="app-topbar-actions">
          {cartHref ? (
            <Link
              href={cartHref}
              aria-label={`Cart${cartCount > 0 ? ` (${cartCount})` : ""}`}
              className="app-topbar-cart-link"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="app-topbar-cart-icon" aria-hidden="true">
                <rect x="4" y="8.5" width="16" height="10" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.5V7a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 7v1.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12.5h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 12.5h2v2h-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 15.5h2.5M13.5 15.5H16" />
              </svg>
              {cartCount > 0 ? <span className="app-topbar-cart-badge">{cartCount}</span> : null}
            </Link>
          ) : null}
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
