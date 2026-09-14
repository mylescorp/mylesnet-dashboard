import Link from "next/link";
import { ArrowRight, CalendarCheck, Gift } from "lucide-react";
import PricingPlans from "../components/PricingPlans";
import { pageMetadata } from "../content/seo";
import { FX_SNAPSHOT } from "../content/rates";

export const metadata = pageMetadata(
  "Pricing",
  "Simple monthly plans for East African ISPs — Starter, Growth, and Pro. Flat monthly pricing, 14-day free trial, and a 20% referral commission.",
  { canonical: "/pricing" }
);

const SHARED_FEATURES: string[] = [
  "Router, network, and hotspot monitoring",
  "Invoices, payments, and an audit-safe ledger",
  "Support tickets and in-portal notifications (SMS & email coming)",
  "Data usage and heavy-user visibility",
  "Package, voucher, and free-trial selling",
];

export default function PricingPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Pricing</p>
          <h1>Simple monthly pricing for your network</h1>
          <p className="landing-banner-lead">
            Three clear plans that grow with you. A flat monthly price for your
            whole network — no revenue share, no per-customer fees, and a
            14-day free trial for every new operator.
          </p>
          <div className="landing-banner-meta">
            <span className="landing-banner-meta-item">
              <CalendarCheck size={14} aria-hidden="true" />
              14-day free trial
            </span>
            <span className="landing-banner-meta-item">
              Flat monthly price
            </span>
            <span className="landing-banner-meta-item">
              KES &middot; UGX &middot; USD
            </span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-head landing-section-head-center">
            <p className="landing-section-kicker">Plans</p>
            <h2 className="landing-section-title">
              From KES 500 per month, for your whole network
            </h2>
            <p className="landing-section-subtitle">
              Pick the plan that matches where your network is today. You can
              move up as you grow.
            </p>
          </div>

          <PricingPlans />

          <p className="landing-plans-footnote">
            Prices are per month and converted from the approved KES base using
            a reference-rate snapshot ({FX_SNAPSHOT.asOf}). Currency is chosen
            automatically from your browser region and you can switch it any time.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-section-head landing-section-head-center">
            <p className="landing-section-kicker">Included</p>
            <h2 className="landing-section-title">Everything you get on any plan</h2>
            <p className="landing-section-subtitle">
              The core platform is the same on every plan — the plans differ in
              reach, reporting, and support.
            </p>
          </div>
          <ul className="landing-checklist">
            {SHARED_FEATURES.map((feature) => (
              <li className="landing-checklist-item" key={feature}>
                <CheckMark />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-head landing-section-head-center">
            <p className="landing-section-kicker">Start with no risk</p>
            <h2 className="landing-section-title">
              Try it free for 14 days — and earn 20% when you refer
            </h2>
          </div>
          <div className="landing-grid">
            <div className="landing-card">
              <span className="landing-card-icon">
                <Gift size={19} aria-hidden="true" />
              </span>
              <h3 className="landing-card-title">14-day free trial</h3>
              <p className="landing-card-body">
                New operators run any plan free for 14 days, with our team
                alongside while you set up and go live. No card details.
              </p>
            </div>
            <div className="landing-card">
              <span className="landing-card-icon">
                <ArrowRight size={19} aria-hidden="true" />
              </span>
              <h3 className="landing-card-title">20% referral commission</h3>
              <p className="landing-card-body">
                When an operator you referred takes a paid plan, you earn 20% of
                their subscription payments for 12 months.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Pricing</p>
          <h2>Ready to see it on your own network?</h2>
          <p>
            Tell us what you operate and we will help you choose the right
            starting plan.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function CheckMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}