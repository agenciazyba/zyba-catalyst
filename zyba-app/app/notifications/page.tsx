"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { type AppNotification } from "@/lib/notifications";
import { loadUserNotifications } from "@/lib/notifications-service";

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const timer = window.setTimeout(async () => {
      const items = await loadUserNotifications(token);
      setNotifications(items);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="notifications-overlay-page">
      <section className="notifications-panel">
        <header className="notifications-top">
          <h2 className="notifications-title">Notifications</h2>
          <button type="button" className="notifications-close" onClick={() => router.back()} aria-label="Close notifications">
            ×
          </button>
        </header>

        {loading ? (
          <p className="notifications-empty">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className="notifications-empty">No active notifications.</p>
        ) : (
          <ul className="notifications-list">
            {notifications.map((item) => (
              <li key={item.id} className="notifications-item">
                <p className="notifications-message">{item.message}</p>
                <Link href={item.href} className="notifications-link">
                  Open trip documents
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
