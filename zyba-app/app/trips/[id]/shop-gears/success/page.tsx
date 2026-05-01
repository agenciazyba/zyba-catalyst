"use client";

import AppTopBar from "@/components/AppTopBar";
import TripBackLink from "@/components/TripBackLink";
import { getSessionToken } from "@/lib/auth";
import {
  finalizeCheckout,
  getCheckoutStatus,
  getTraveler,
  type FinalizeCheckoutResponse,
} from "@/lib/api";
import { clearShopCartSnapshot } from "@/lib/shop-cart";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

type Traveler = {
  travelerName?: string | null;
};

function formatCurrency(value?: number | null, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "USD").toUpperCase(),
  }).format(Number(value));
}

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
  const [message, setMessage] = useState("We are confirming your payment with Stripe.");
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [summary, setSummary] = useState<FinalizeCheckoutResponse | null>(null);
  const stripeSessionId = searchParams?.get("session_id") || "";

  const completeIfPaid = useEffectEvent(async (token: string) => {
    if (!tripId) return false;

    const finalizeResult = await finalizeCheckout(token, tripId, stripeSessionId);
    if (!finalizeResult.ok || !finalizeResult.data) {
      if ((finalizeResult.error || "").includes("not confirmed as paid yet")) {
        const checkoutStatusResult = await getCheckoutStatus(token, tripId);
        if (!checkoutStatusResult.ok) {
          setStatus("error");
          setMessage(checkoutStatusResult.error || checkoutStatusResult.message || "Failed to confirm payment status.");
          return true;
        }

        return false;
      }

      setStatus("error");
      setMessage(finalizeResult.error || finalizeResult.message || "Failed to finalize your checkout.");
      return true;
    }

    clearShopCartSnapshot(tripId);
    setSummary(finalizeResult.data);
    setStatus("success");
    setMessage("Payment confirmed. Your order has been recorded successfully.");
    return true;
  });

  useEffect(() => {
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
  }, [router, tripId]);

  return (
    <main className="trip-details-page">
      <AppTopBar firstName={traveler?.travelerName?.split(" ")[0] || "Traveler"} cartCount={0} />

      <section className="trip-details-body">
        <div className="shop-gears-shell">
          <section className="shop-gears-section">
            <div className="shop-gears-success-card">
              <span className="shop-gears-kicker">SHOP GEARS</span>
              <h5 className="trip-details-section-title">Payment Success</h5>
              <p className="shop-gears-api-purpose">{message}</p>

              {status === "success" && summary ? (
                <div className="shop-gears-success-grid">
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Status</span>
                    <p className="shop-gears-detail-value">Paid</p>
                  </div>
                  <div className="shop-gears-detail-row">
                    <span className="shop-gears-detail-label">Amount</span>
                    <p className="shop-gears-detail-value">
                      {formatCurrency(summary.amountTotal, summary.currency || "USD")}
                    </p>
                  </div>
                  {summary.checkoutSessionId ? (
                    <div className="shop-gears-detail-row">
                      <span className="shop-gears-detail-label">Stripe Session</span>
                      <p className="shop-gears-detail-value">{summary.checkoutSessionId}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {status === "pending" ? (
                <p className="shop-gears-summary">
                  Session: {searchParams?.get("session_id") || "Waiting for Stripe confirmation"}
                </p>
              ) : null}
            </div>

            <div className="trip-back-action">
              <TripBackLink href={`/trips/${tripId}/shop-gears`} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
