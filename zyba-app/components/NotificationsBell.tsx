"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { loadUserNotifications } from "@/lib/notifications-service";

export default function NotificationsBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;

    const run = async () => {
      const notifications = await loadUserNotifications(token);
      setCount(notifications.length);
    };

    const idleApi = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleApi.requestIdleCallback) {
      const idleId = idleApi.requestIdleCallback(() => {
        void run();
      });
      return () => {
        if (idleApi.cancelIdleCallback) idleApi.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(() => {
      void run();
    }, 300);

    return () => globalThis.clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      className="trips-notify-btn"
      aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
      onClick={() => router.push("/notifications")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="trips-notify-icon">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.5H4.5a1 1 0 0 1-.78-1.63l1.02-1.28c.5-.62.76-1.4.76-2.2V10a6.5 6.5 0 1 1 13 0v2.39c0 .8.27 1.58.76 2.2l1.02 1.28a1 1 0 0 1-.78 1.63h-2.14" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20a2.5 2.5 0 0 0 5 0" />
      </svg>
      {count > 0 ? <span className="trips-notify-badge">{count}</span> : null}
    </button>
  );
}
