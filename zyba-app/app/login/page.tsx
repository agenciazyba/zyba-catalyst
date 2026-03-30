"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/api";
import { setSessionToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("agenciazyba@gmail.com");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp() {
    setLoading(true);
    setMessage("");

    const result = await requestOtp(email);

    if (result.ok) {
      setMessage("OTP sent successfully.");
    } else {
      setMessage(result.error || result.message || "Failed to request OTP.");
    }

    setLoading(false);
  }

  async function handleVerifyOtp() {
    setLoading(true);
    setMessage("");

    const result = await verifyOtp(email, otp);

    if (result.ok && result.sessionToken) {
      setSessionToken(result.sessionToken);
      router.push("/trips");
      return;
    }

    setMessage(result.error || result.message || "Failed to verify OTP.");
    setLoading(false);
  }

  return (
    <main>
      <h1>Login</h1>

      <div>
        <div>Email</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div>
        <button onClick={handleRequestOtp} disabled={loading}>
          Send OTP
        </button>
      </div>

      <div>
        <div>OTP</div>
        <input value={otp} onChange={(e) => setOtp(e.target.value)} />
      </div>

      <div>
        <button onClick={handleVerifyOtp} disabled={loading}>
          Verify OTP
        </button>
      </div>

      <p>{message}</p>
    </main>
  );
}
