"use client";

import { useRouter } from "next/navigation";
import { clearSessionToken } from "@/lib/auth";

export default function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearSessionToken();
    router.push("/login");
  }

  return <button onClick={handleLogout}>Logout</button>;
}
