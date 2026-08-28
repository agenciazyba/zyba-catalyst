"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultLoginPath } from "@/lib/auth";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(getDefaultLoginPath());
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="splash-screen">
      <Image
        className="splash-logo"
        src="/brand/Trans_Creme.png"
        alt="Zyba Outdoors"
        width={214}
        height={102}
        priority
      />
    </main>
  );
}
