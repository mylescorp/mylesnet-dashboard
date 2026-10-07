import { ArrowRight, LayoutDashboard, Mail } from "lucide-react";
import { resourceItems } from "@/landing/content/resources";
import { pageMetadata } from "@/landing/content/seo";
import StatusChip from "@/landing/components/StatusChip";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Resources",
  "Guides and playbooks for running small ISPs, WISPs, estate, and community networks — on MylesNet and beyond.",
  { canonical: "/resources" }
);

export default function ResourcesPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Resources"
            title="Guides built for the operator's day"
            body={
              <>
                Practical guides on billing, payment automation, network operations, and the
                realities of running a small internet service in East Africa.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {resourceItems.map((item) =>
              item.href ? (
                <LandingCard
                  key={item.title}
                  href={item.href}
                  variant="link"
                  title={item.title}
                  body={item.description}
                  meta={
                    <>
                      <StatusChip status="Available" />
                      <span>{item.meta}</span>
                    </>
                  }
                  footer={
                    <>
                      Read the guide
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  }
                />
              ) : (
                <LandingCard
                  key={item.title}
                  title={item.title}
                  body={item.description}
                  meta={
                    <>
                      <span className="landing-soon-chip">{item.meta}</span>
                      <span>On the editorial plan</span>
                    </>
                  }
                />
              )
            )}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              Want a guide you don&apos;t see here? Tell us what would help — we publish
              what we find useful, not filler.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Resources"
        title="Want a guide you do not see here?"
        subtitle="Tell us what would help — we publish what we find useful, not filler."
        items={[
          {
            href: "/contact",
            icon: <Mail size={19} aria-hidden="true" />,
            title: "Request a guide",
            body: "Tell us the topic you are stuck on and we will write it up.",
            action: "Ask for a guide",
          },
          {
            href: "/resources/how-it-works",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "How MylesNet works",
            body: "See how the areas fit together as one shared record of truth.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}
