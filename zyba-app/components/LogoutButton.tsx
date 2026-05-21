"use client";

import { useRouter } from "next/navigation";
import { logoutSession } from "@/lib/api";
import { clearSessionToken, getSessionToken } from "@/lib/auth";
import { clearAllShopCartSnapshots } from "@/lib/shop-cart";

type LogoutButtonProps = {
  className?: string;
};

export default function LogoutButton({ className = "" }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    const sessionToken = getSessionToken();
    clearAllShopCartSnapshots();
    clearSessionToken();

    if (sessionToken) {
      await logoutSession(sessionToken).catch(() => {
        // Local logout should still complete if backend session invalidation fails.
      });
    }

    router.push("/login");
  }

  return (
    <button type="button" onClick={() => void handleLogout()} className={className}>
      Logout
    </button>
  );
}
