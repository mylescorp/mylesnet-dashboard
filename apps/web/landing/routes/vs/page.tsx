import { ArrowRight, ArrowUpRight, Scale } from "lucide-react";
import { comparisons } from "@/landing/content/comparisons";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "MylesNet vs the tools operators run today",
  "Honest comparisons of MylesNet with FreeRADIUS, daloRADIUS, Mikhmon, and PHPNuxBill — where each genuinely wins, where it strains, and how the platform compares.",
  { canonical: "/vs" }
);

export default function VsIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Compare"
            title="MylesNet vs the tools operators run today"
            body={
              <>
                Straight comparisons with the free and open-source tools small ISPs actually
                run — where each one genuinely wins, where it strains, and what running the
                whole operation on MylesNet changes.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {comparisons.map((comparison) => (
              <LandingCard
                key={comparison.slug}
                href={`/vs/${comparison.slug}`}
                variant="link"
                eyebrow={comparison.kind}
                title={`${comparison.name} vs MylesNet`}
                body={comparison.tagline}
                footer={
                  <>
                    Read the comparison
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>How these comparisons stay honest</h2>
            <p>
              Every tool here is a real, respected choice — some of them are the right one.
              We name where each genuinely wins and where it strains, and where MylesNet
              does not do something yet we say so and point to the roadmap. If a claim
              looks off, verify it against the tool itself; that is the point.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Compare"
        title="A comparison reads differently from a day in the system"
        subtitle="The honest way to decide is to see the platform doing the operator's day."
        items={[
          {
            href: "/demo",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Live demo",
            body: "A guided tour of the operator console, surface by surface.",
            action: "See the demo",
          },
          {
            href: "/get-started",
            icon: <Scale size={19} aria-hidden="true" />,
            title: "Talk to the team",
            body: "Bring your current setup and compare it side by side with us.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}