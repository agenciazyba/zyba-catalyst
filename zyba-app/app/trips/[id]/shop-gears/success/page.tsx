"use client";

import AppTopBar from "@/components/AppTopBar";
import LottieFilePlayer from "@/components/LottieFilePlayer";
import { getSessionToken } from "@/lib/auth";
import {
  finalizeCheckout,
  getCheckoutStatus,
  getTraveler,
} from "@/lib/api";
import { clearShopCartSnapshot } from "@/lib/shop-cart";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

export default function ShopGearsSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tripId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] || "";
    return typeof raw === "string" ? raw : "";
  }, [params]);

  const [traveler, setTraveler] = useState<Traveler | null>(null);
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const stripeSessionId = searchParams?.get("session_id") || "";
  const previewMode = String(searchParams?.get("preview") || "").trim().toLowerCase();
  const isPendingPreview = previewMode === "pending" || previewMode === "processing";
  const isSuccessPreview = previewMode === "success";
  const isErrorPreview = previewMode === "error" || previewMode === "failed";
  const effectiveStatus = isPendingPreview
    ? "pending"
    : isSuccessPreview
      ? "success"
      : isErrorPreview
        ? "error"
        : status;

  const completeIfPaid = useEffectEvent(async (token: string) => {
    if (!tripId) return false;

    const finalizeResult = await finalizeCheckout(token, tripId, stripeSessionId);
    if (!finalizeResult.ok || !finalizeResult.data) {
      if ((finalizeResult.error || "").includes("not confirmed as paid yet")) {
        const checkoutStatusResult = await getCheckoutStatus(token, tripId);
        if (!checkoutStatusResult.ok) {
          setStatus("error");
          return true;
        }

        return false;
      }

      setStatus("error");
      return true;
    }

    clearShopCartSnapshot(tripId);
    setStatus("success");
    return true;
  });

  useEffect(() => {
    if (isPendingPreview || isSuccessPreview || isErrorPreview) {
      return;
    }

    const token = getSessionToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    async function load() {
      const travelerResult = await getTraveler(token);
      if (travelerResult.ok) {
        setTraveler((travelerResult.data as Traveler) || null);
      }

      const finished = await completeIfPaid(token);
      if (finished) return;

      const poll = window.setInterval(() => {
        void completeIfPaid(token).then((done) => {
          if (done) {
            window.clearInterval(poll);
          }
        });
      }, 3500);

      return () => {
        window.clearInterval(poll);
      };
    }

    let cleanup: (() => void) | undefined;
    void load().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [isErrorPreview, isPendingPreview, isSuccessPreview, router, tripId]);

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} cartCount={0} />

      <section
        className={
          effectiveStatus === "pending"
            ? "trip-details-body shop-gears-success-body"
            : "trip-details-body"
        }
      >
        {effectiveStatus === "pending" ? (
          <section className="shop-gears-success-pending-stage">
            <LottieFilePlayer
              src="/lotties-processing-payment.json"
              className="shop-gears-lottie"
            />
          </section>
        ) : effectiveStatus === "error" ? (
          <section className="shop-gears-success-pending-stage">
            <LottieFilePlayer
              src="/lotties-payment-error.json"
              className="shop-gears-lottie"
              loop={false}
            />
          </section>
        ) : (
          <section className="shop-gears-success-pending-stage">
            <LottieFilePlayer
              src="/lotties-stripe-transfer-success.json"
              className="shop-gears-lottie"
              loop={false}
            />
          </section>
        )}
      </section>
    </main>
  );
}
