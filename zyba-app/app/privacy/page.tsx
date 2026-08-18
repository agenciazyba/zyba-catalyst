import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Zyba Outdoors",
  description: "Privacy Policy for the Zyba Outdoors app.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <section className="legal-content">
        <p className="legal-kicker">Zyba Outdoors</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: August 18, 2026</p>

        <p>
          Zyba Outdoors provides travel planning, trip management, customer support, and
          related shopping features for fishing travel customers. This Privacy Policy
          explains how we collect, use, and protect information when you use the Zyba
          Outdoors app.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We may collect information needed to provide and support your trip experience,
          including your name, email address, phone number, user account identifier,
          purchase history, payment-related information, and customer support messages.
        </p>
        <p>
          Payment card details are processed by Stripe. Zyba Outdoors does not store full
          card numbers in the app.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use information to authenticate users, display trips and itinerary details,
          process orders and payments, provide customer support, manage bookings, send
          relevant service notifications, prevent fraud, and maintain app reliability.
        </p>

        <h2>Service Providers</h2>
        <p>
          We use trusted service providers to operate the app, including payment
          processing, customer records, hosting, analytics, messaging, and support tools.
          These providers may process information only as needed to provide their services
          to Zyba Outdoors.
        </p>

        <h2>Content and Media</h2>
        <p>
          The app may display trip, destination, product, and itinerary content provided
          by Zyba Outdoors, partners, suppliers, or authorized service providers.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain information for as long as needed to provide the app, support customer
          travel services, comply with legal obligations, resolve disputes, and maintain
          business records.
        </p>

        <h2>Your Choices</h2>
        <p>
          You may contact us to request access, correction, or deletion of personal
          information, subject to legal, security, and operational requirements.
        </p>

        <h2>Children</h2>
        <p>
          The Zyba Outdoors app is not directed to children and is intended for travel
          customers and authorized users.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions or requests, contact us at{" "}
          <a href="mailto:fishingtrips@zybaoutdoors.com">
            fishingtrips@zybaoutdoors.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
