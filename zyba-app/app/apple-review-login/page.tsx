"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { appleReviewLogin } from "@/lib/api";
import { setSessionToken } from "@/lib/auth";
import { clearAllShopCartSnapshots } from "@/lib/shop-cart";

// Temporary App Store review route. Remove this page after approval.
export default function AppleReviewLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      setMessage("");

      const result = await appleReviewLogin(email, password);
      if (result.ok && result.sessionToken) {
        clearAllShopCartSnapshots();
        setSessionToken(result.sessionToken);
        router.push("/trips");
        return;
      }

      setMessage(result.error || result.message || "Invalid login credentials.");
    } catch {
      setMessage("Unable to contact server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-logo-wrap">
        <Image src="/brand/Trans_Creme.png" alt="Zyba Outdoors" width={113} height={53} priority />
      </div>

      <section className="login-body apple-review-login-body">
        <Image src="/icons/email.png" alt="Email icon" width={112} height={62} priority />

        <div className="login-headline-block">
          <h2 className="login-title">SIGN IN</h2>
          <h4 className="login-subtitle">Access your Zyba Outdoors trip</h4>
        </div>

        <form
          className="login-form apple-review-login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading && email && password) void handleLogin();
          }}
        >
          <label className="text-h4 login-label" htmlFor="apple-review-email">
            Email
          </label>
          <input
            id="apple-review-email"
            type="email"
            className="input-login"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="Your Email here"
          />

          <label className="text-h4 login-label apple-review-password-label" htmlFor="apple-review-password">
            Password
          </label>
          <input
            id="apple-review-password"
            type="password"
            className="input-login"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Your password here"
          />

          {message ? <p className="login-message">{message}</p> : null}

          <button
            type="submit"
            className="btn"
            disabled={loading || !email || !password}
            style={{ marginTop: 20 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
