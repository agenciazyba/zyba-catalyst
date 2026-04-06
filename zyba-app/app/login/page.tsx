"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/api";
import { setSessionToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agenciazyba@gmail.com");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
              className="input-login text-h4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
          <h4 style={{ margin: 0 }}>Need help?</h4>
        </div>
      </section>
    </main>
  );
}
