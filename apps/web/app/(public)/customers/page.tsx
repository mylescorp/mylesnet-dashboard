import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "../content/seo";
import {
  customersIntro,
  customersToday,
  customersHonesty,
  earlyOperatorPerks,
  customersRoadmap,
} from "../content/customers";

export const metadata = pageMetadata(
  "Customers",
  "MylesNet is launching with pilot operators. Here is exactly where the platform stands — and how early operators work with us.",
  { canonical: "/customers" }
);

export default function CustomersPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">{customersIntro.kicker}</p>
          <h1>{customersIntro.title}</h1>
          <p className="landing-banner-lead">{customersIntro.subtitle}</p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>{customersToday.heading}</h2>
            {customersToday.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>{customersHonesty.heading}</h2>
            {customersHonesty.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">What early operators get</h2>
          <div className="landing-grid">
            {earlyOperatorPerks.map((perk) => (
              <article className="landing-card" key={perk.title}>
                <h3 className="landing-card-title">{perk.title}</h3>
                <p className="landing-card-body">{perk.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">The public roadmap</h2>
          <p className="landing-section-subtitle landing-section-subtitle-spaced">
            What is specified and sequenced — shown honestly, so nobody is surprised.
          </p>
          <div className="landing-roadmap">
            {customersRoadmap.map((item) => (
              <article className="landing-roadmap-item" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Customers</p>
          <h2>Talk to us about being an early operator</h2>
          <p>
            If honest statuses and a shared build roadmap appeal to you, we would value a
            conversation about your network.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/product">
              See the product
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
