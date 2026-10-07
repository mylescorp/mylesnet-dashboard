import { ArrowRight, ArrowUpRight, Landmark } from "lucide-react";
import { countries } from "@/landing/content/countries";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "ISP billing by country",
  "What running a small internet service provider looks like in Kenya, Uganda, Tanzania, Rwanda, and the wider market — payment rails, regulation, and how MylesNet fits.",
  { canonical: "/country" }
);

export default function CountryIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="By country"
            title="What running an ISP looks like, market by market"
            body={
              <>
                Each country page covers what an operator actually needs to know before
                going live there — how subscribers pay, who regulates the market, and how
                MylesNet fits the day-to-day.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {countries.map((country) => (
              <LandingCard
                key={country.slug}
                href={`/country/${country.slug}`}
                variant="link"
                eyebrow={country.currencyShort}
                title={country.name}
                body={country.summary}
                meta={<span>{country.paymentRails.slice(0, 2).join(" · ")}</span>}
                footer={
                  <>
                    Read the guide
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>How the guides stay honest</h2>
            <p>
              We do not publish invented statistics. Each page names the payment rails
              subscribers actually use, the regulator that licenses operators, and what
              MylesNet does today versus what is specified on the roadmap — the same
              standard we hold the rest of the site to.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="By country"
        title="Wherever you are, the first step is the same"
        subtitle="Tell us how your network runs and we will map the right starting point for your market."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources/how-it-works",
            icon: <Landmark size={19} aria-hidden="true" />,
            title: "How MylesNet works",
            body: "Subscribers, billing, network, and reporting as one shared record.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}