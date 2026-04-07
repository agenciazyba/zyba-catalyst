"use client";

import { useRouter } from "next/navigation";
import { clearSessionToken } from "@/lib/auth";

type LogoutButtonProps = {
  className?: string;
};

export default function LogoutButton({ className = "" }: LogoutButtonProps) {
  const router = useRouter();

  function handleLogout() {
    clearSessionToken();
    router.push("/login");
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Logout
    </button>
  );
}
