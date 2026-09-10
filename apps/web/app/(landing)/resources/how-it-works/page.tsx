import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { howItWorksSteps } from "../../content/how-it-works";

export const metadata: Metadata = {
  title: "How MylesNet works",
  description:
    "A plain-language walkthrough of how MylesNet brings customers, packages, payments, and network operations together.",
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Resources</p>
          <h1>How MylesNet works</h1>
          <p className="landing-banner-lead">
            A plain-language look at how the platform supports the day-to-day work of
            running an internet service — and what each area means in practice.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-how-steps">
            {howItWorksSteps.map((step) => (
              <article className="landing-how-step" key={step.step}>
                <span className="landing-how-num">{step.step}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>
                    {step.about}{" "}
                    <strong>In practice:</strong> {step.inPractice}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="landing-prose" style={{ marginTop: 44 }}>
            <p>
              These areas work together as <strong>one platform</strong> — not five
              separate systems bolted on. That shared record of truth is what keeps an
              operation running smoothly as it grows.
            </p>
            <div className="landing-hero-actions" style={{ justifyContent: "flex-start" }}>
              <Link className="landing-cta-button" href="/get-started">
                Get started
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="landing-secondary-button" href="/features/customer-management">
                Browse features
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}