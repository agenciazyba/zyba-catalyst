"use client";

import Link from "next/link";
import Image from "next/image";
import NotificationsBell from "@/components/NotificationsBell";

type AppTopBarProps = {
  firstName?: string | null;
};

export default function AppTopBar({ firstName }: AppTopBarProps) {
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
        <NotificationsBell />
      </div>
    </header>
  );
}
