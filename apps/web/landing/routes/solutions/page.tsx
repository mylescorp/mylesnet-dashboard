import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { solutions } from "@/landing/content/pages";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Solutions",
  "MylesNet for market WiFi hotspots, estate and apartment networks, hospitality guest Wi-Fi, and community networks.",
  { canonical: "/solutions" }
);

export default function SolutionsIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Solutions"
            title="Built for how you operate"
            body={
              <>
                Whether you run a market hotspot, an estate network, a hotel, or a community
                network, MylesNet adapts to your business rather than the other way around.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-solutions-grid">
            {solutions.map((solution) => (
              <LandingCard
                key={solution.slug}
                href={`/solutions/${solution.slug}`}
                variant="link"
                icon={<Icon name={solution.icon} size={22} />}
                title={solution.title}
                eyebrow={solution.tagline}
                body={solution.summary}
                outcomes={solution.outcomes}
                footer={
                  <>
                    Explore solution
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Solutions"
        title="Do not see your setup here?"
        subtitle="Tell us how you operate — we scope the platform per network, not per template."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Describe your network and we will map the right starting point.",
            action: "Start a conversation",
          },
          {
            href: "/contact",
            icon: <Mail size={19} aria-hidden="true" />,
            title: "Talk to us",
            body: "Ask us directly about a setup that is not listed here.",
            action: "Ask a question",
          },
        ]}
      />
    </>
  );
}
