import { ArrowUpRight, Compass, LayoutDashboard, MapPin, Target } from "lucide-react";
import { getCompanyContact } from "@/landing/content/contact";
import {
  COMPANY_LEADERSHIP,
  COMPANY_VALUES,
  MYLESCORP,
  MYLESNET_PORTFOLIO_NOTE,
  MYLESNET_STORY,
} from "@/landing/content/company";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "About MylesNet",
  "MylesNet is built by MylesCorp Technologies Ltd to serve East African internet service providers, communities, and connectivity businesses.",
  { canonical: "/company/about" }
);

export default function AboutPage() {
  const contact = getCompanyContact();

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Company"
            title={MYLESNET_STORY.tagline}
            body={MYLESNET_STORY.summary}
            tags={[
              <>
                <MapPin size={15} aria-hidden="true" />
                {MYLESCORP.location}
              </>,
              <>
                <Compass size={15} aria-hidden="true" />
                {MYLESNET_STORY.tagline}
              </>,
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Why we built it</h2>
            <p>
              Running an internet service means juggling customers, plans, money,
              and network equipment — often across spreadsheets and paper
              systems. As networks grow, that becomes harder and harder to keep
              accurate. MylesNet brings these into one place so operators can
              focus on connecting people well.
            </p>

            <h2>Built for the way you operate</h2>
            <p>
              Whether you operate a market hotspot, an estate, a guest network,
              or a community service, the daily work is the same: sell access,
              track payments, and keep people online. MylesNet is designed
              around that work rather than asking you to adapt to a rigid
              enterprise mould.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Who it is for</h2>
            <p>
              MylesNet is built for the operators keeping real communities
              online across East Africa.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {MYLESNET_STORY.audiences.map((audience) => (
              <LandingCard
                key={audience}
                variant="compact"
                title={audience}
                body="Subscriber service, billing, network operations, and support in one tenant."
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Mission and vision</h2>
          </div>
          <div className="landing-grid landing-grid-spaced">
            <LandingCard
              icon={<Target size={19} aria-hidden="true" />}
              eyebrow="Mission"
              title="What we are here to do"
              body={MYLESNET_STORY.mission}
            />
            <LandingCard
              icon={<Compass size={19} aria-hidden="true" />}
              eyebrow="Vision"
              title="Where we are heading"
              body={MYLESNET_STORY.vision}
            />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Built by {MYLESCORP.legalName}</h2>
            <p>
              {MYLESCORP.tagline} {MYLESCORP.operatingModel}
            </p>
            <p>{MYLESNET_PORTFOLIO_NOTE}</p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {COMPANY_LEADERSHIP.map((leader) => (
              <LandingCard
                key={leader.name}
                eyebrow={leader.role}
                title={leader.name}
                body={leader.scope}
                outcomes={[
                  contact[leader.phoneKey]
                    ? `Direct line ${contact[leader.phoneKey]}`
                    : null,
                  contact[leader.emailKey] ? `Email ${contact[leader.emailKey]}` : null,
                ].filter((line): line is string => Boolean(line))}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>The M.Y.L.E.S. Principle</h2>
            <p>
              The principle our company applies across every product and every
              customer engagement.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {COMPANY_VALUES.map((value) => (
              <LandingCard
                key={value.letter}
                variant="compact"
                step={value.letter}
                title={value.value}
                body={value.commitment}
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Company"
        title="See it on your network"
        subtitle="If what we have built sounds like the work you are trying to simplify, we would like to hear about your network."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Start a conversation",
            body: "Walk through the platform with our team on your own setup.",
            action: "Get started",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "See the product",
            body: "Review every module and the status it is at today.",
            action: "Browse modules",
          },
        ]}
      />
    </>
  );
}
