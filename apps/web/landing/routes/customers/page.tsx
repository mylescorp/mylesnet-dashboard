import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import {
  customersIntro,
  customersToday,
  customersHonesty,
  earlyOperatorPerks,
  customersRoadmap,
} from "@/landing/content/customers";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

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
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={customersIntro.kicker}
            title={customersIntro.title}
            body={customersIntro.subtitle}
          />
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
              <LandingCard
                key={perk.title}
                title={perk.title}
                body={perk.description}
              />
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
              <LandingCard
                key={item.title}
                variant="compact"
                title={item.title}
                body={item.note}
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Customers"
        title="Talk to us about being an early operator"
        subtitle="If honest statuses and a shared build roadmap appeal to you, we would value a conversation about your network."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Tell us about your network and how you operate today.",
            action: "Start a conversation",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "See the product",
            body: "Check what is live today and what is on the roadmap.",
            action: "Browse modules",
          },
        ]}
      />
    </>
  );
}
