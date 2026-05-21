"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/api";
import { setSessionToken } from "@/lib/auth";
import { clearAllShopCartSnapshots } from "@/lib/shop-cart";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  async function handleRequestOtp() {
    try {
      setLoading(true);
      setMessage("");
      const result = await requestOtp(email);
      if (result.ok) {
        setStep("otp");
        return;
      }
      setMessage(result.error || result.message || "Failed to request code.");
    } catch {
      setMessage("Unable to contact server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    try {
      setLoading(true);
      setMessage("");
      const otp = otpDigits.join("");
      const result = await verifyOtp(email, otp);
      if (result.ok && result.sessionToken) {
        clearAllShopCartSnapshots();
        setSessionToken(result.sessionToken);
        router.push("/trips");
        return;
      }
      setMessage("Invalid code, please try again!");
    } catch {
      setMessage("Unable to contact server.");
    } finally {
      setLoading(false);
    }
  }

  const isEmailStep = step === "email";
  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);

  function handleOtpDigitChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
    if (cleaned && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  }

  return (
    <main className="login-screen">
      <div className="login-logo-wrap">
        <Image src="/brand/Trans_Creme.png" alt="Zyba Outdoors" width={113} height={53} priority />
      </div>

      <section className="login-body">
        <Image src="/icons/email.png" alt="Email icon" width={112} height={62} priority />

        <div className="login-headline-block">
          <h2 className="login-title">
            {isEmailStep ? "VERIFICATION CODE" : "Email sent successfully"}
          </h2>
          <h4 className="login-subtitle">
            {isEmailStep
              ? "Email one time password"
              : "Please enter the code sent to your email below to sign in"}
          </h4>
        </div>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isEmailStep) {
              if (!loading && email) void handleRequestOtp();
              return;
            }
            if (!loading && otpValue.length === 6) void handleVerifyOtp();
          }}
        >
          <label className="text-h4 login-label" htmlFor={isEmailStep ? "email" : "otp"}>
            {isEmailStep ? "Email" : "Code"}
          </label>

          {isEmailStep ? (
            <input
              id="email"
              type="email"
              className="input-login"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Your Email here"
            />
          ) : (
            <div className="otp-grid" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  id={index === 0 ? "otp" : undefined}
                  type="text"
                  inputMode="numeric"
                  className="otp-box text-h4"
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>
          )}

          {!isEmailStep && message ? <p className="login-message">{message}</p> : null}

          <button
            type="submit"
            className="btn"
            disabled={loading || (isEmailStep ? !email : otpValue.length !== 6)}
            style={{ marginTop: 20 }}
          >
            {isEmailStep
              ? loading
                ? "Sending..."
                : "Send me the code"
              : loading
                ? "Verifying..."
                : "Verify your code"}
          </button>
        </form>

        <div className="login-help-wrap">
          <button type="button" className="login-help-link" onClick={() => setHelpOpen(true)}>
            Need help?
          </button>
        </div>
      </section>

      {helpOpen ? (
        <div className="login-help-modal" role="dialog" aria-modal="true" aria-label="Need help">
          <button
            type="button"
            className="login-help-overlay"
            aria-label="Close help"
            onClick={() => setHelpOpen(false)}
          />
          <section className="login-help-sheet">
            <button
              type="button"
              className="login-help-close"
              aria-label="Close help"
              onClick={() => setHelpOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="login-help-close-icon" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18" />
              </svg>
            </button>
            <h3 className="login-help-sheet-title">Do you need help?</h3>

            <nav className="login-help-menu" aria-label="Help channels">
              <a href="mailto:fishingtrips@zybaoutdoors.com" className="login-help-menu-row">
                <span className="login-help-menu-left">
                  <Image src="/icons/help-mail.svg" alt="" width={24} height={24} className="login-help-menu-icon" />
                  <span className="login-help-menu-text">Mail us</span>
                </span>
                <span className="login-help-menu-arrow">›</span>
              </a>

              <a href="tel:+15076367758" className="login-help-menu-row">
                <span className="login-help-menu-left">
                  <Image src="/icons/help-call.svg" alt="" width={24} height={24} className="login-help-menu-icon" />
                  <span className="login-help-menu-text">Call us</span>
                </span>
                <span className="login-help-menu-arrow">›</span>
              </a>

              <a
                href="https://wa.me/5519998305875"
                className="login-help-menu-row"
                target="_blank"
                rel="noreferrer"
              >
                <span className="login-help-menu-left">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="login-help-menu-icon"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 18.4 4.5 21l2.85-1.02A8.08 8.08 0 1 0 3.95 13.4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.35 8.85c.18-.38.36-.4.56-.4h.45c.16 0 .38.06.58.46.22.43.74 1.8.8 1.93.06.13.1.29.02.46-.08.18-.13.29-.26.44l-.39.45c-.13.13-.27.28-.12.54.14.26.64 1.05 1.38 1.7.95.84 1.75 1.1 2.01 1.24.26.14.41.12.56-.07.16-.18.64-.74.81-1 .17-.26.34-.22.58-.13.24.08 1.5.7 1.76.83.26.13.43.2.5.31.06.12.06.67-.16 1.31-.22.64-1.28 1.22-1.79 1.27-.46.05-1.04.07-1.68-.1-.39-.1-.89-.29-1.53-.56-2.69-1.16-4.45-3.85-4.59-4.03-.14-.18-1.09-1.45-1.09-2.77 0-1.32.69-1.97.94-2.24" />
                  </svg>
                  <span className="login-help-menu-text">Whatsapp</span>
                </span>
                <span className="login-help-menu-arrow">›</span>
              </a>
            </nav>
          </section>
        </div>
      ) : null}
    </main>
  );
}
