import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "../components/icon";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pricing for MylesNet is confirmed with our team based on your network size and needs.",
};

const PRICE_FACTORS: { icon: string; title: string; description: string }[] = [
  {
    icon: "Users",
    title: "Network size",
    description:
      "The number of customers you serve today and expect to grow to. Pricing scales with what you actually run.",
  },
  {
    icon: "Layers",
    title: "Services",
    description:
      "Which MylesNet areas you use — from customer management and payments to network operations and support.",
  },
  {
    icon: "ClipboardList",
    title: "Setup and onboarding",
    description:
      "How much help you want getting configured and going live. We handle the technical details either way.",
  },
];

const PRICE_STEPS: { step: string; title: string }[] = [
  { step: "1", title: "Tell us what you operate" },
  { step: "2", title: "We confirm the right starting point" },
  { step: "3", title: "You decide before committing" },
];

export default function PricingPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Pricing</p>
          <h1>Pricing that fits your network</h1>
          <p className="landing-banner-lead">
            Every network has different needs, so we confirm pricing based on your
            customer count, plan types, and the services you operate. There is no
            one-size-fits-all price — and nothing is committed before you have a
            clear picture.
          </p>
          <div className="landing-banner-meta">
            <Link className="landing-cta-button" href="/get-started" style={{ gap: 8 }}>
              Get a tailored price
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {PRICE_FACTORS.map((factor) => (
              <article className="landing-card" key={factor.title}>
                <span className="landing-card-icon">
                  <Icon name={factor.icon} size={19} />
                </span>
                <h3 className="landing-card-title">{factor.title}</h3>
                <p className="landing-card-body">{factor.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>How pricing confirmation works</h2>
            <ul>
              {PRICE_STEPS.map((step) => (
                <li key={step.step}>
                  <strong>Step {step.step} — {step.title}.</strong> We move one stage
                  at a time so you always know where you stand before the next step.
                </li>
              ))}
            </ul>
            <p>
              We will talk through your situation and give you a clear picture before
              you commit to anything — no surprises, no pressure.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Pricing</p>
          <h2>Get a tailored price for your network</h2>
          <p>Share what you operate and hear back from our team promptly.</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get a tailored price
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}