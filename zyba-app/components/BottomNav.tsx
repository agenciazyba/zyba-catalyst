"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const isProfileActive = pathname?.startsWith("/profile");
  const isTripsActive = pathname?.startsWith("/trips");
  const isOrdersActive = pathname?.startsWith("/orders");

  return (
    <nav className="bottom-nav">
      <Link href="/profile" className={`nav-item ${isProfileActive ? "active" : ""}`}>
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="nav-icon">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a7.5 7.5 0 0 1 15 0" />
        </svg>
        <span>Profile</span>
      </Link>

      <Link href="/trips" className={`nav-item ${isTripsActive ? "active" : ""}`}>
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="nav-icon">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h5.25v10.5H4.5V7.5Zm9.75-2.25H19.5V18h-5.25V5.25ZM7.125 4.5h10.5M12 10.5l1.5 1.5m0 0 2.25-2.25M13.5 12l-1.5 1.5" />
        </svg>
        <span>My trips</span>
      </Link>

      <Link href="/orders" className={`nav-item ${isOrdersActive ? "active" : ""}`}>
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="nav-icon">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.25 4.75h11.5v14.5l-1.85-1.05-1.9 1.05-2-1.05-2 1.05-1.9-1.05-1.85 1.05V4.75Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 8.25h6.5M8.75 11.5h6.5M8.75 14.75h4.25" />
        </svg>
        <span>My orders</span>
      </Link>
    </nav>
  );
}
