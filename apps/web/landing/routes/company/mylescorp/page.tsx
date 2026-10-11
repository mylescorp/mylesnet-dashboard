import {
  Building2,
  Compass,
  Globe,
  LayoutDashboard,
  MapPin,
  Target,
} from "lucide-react";
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
  "About MylesCorp Technologies Ltd",
  "MylesCorp Technologies Ltd is the software company behind MylesNet — practical, locally aware products for East African organizations, built from Nairobi, Kenya.",
  { canonical: "/company/mylescorp" }
);

export default function MylesCorpPage() {
  const contact = getCompanyContact();

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Company"
            title="About MylesCorp Technologies Ltd"
            body={`${MYLESCORP.tagline} We build SaaS products, deliver client
              implementation, and improve them continuously — with the
              operational needs of East African organizations at the centre.`}
            tags={[
              <>
                <MapPin size={15} aria-hidden="true" />
                {MYLESCORP.location}
              </>,
              <>
                <Building2 size={15} aria-hidden="true" />
                Parent company of MylesNet
              </>,
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Who we are</h2>
            <p>
              {MYLESCORP.legalName} is a software company based in Nairobi,
              Kenya. We build operational software for organisations that have
              to keep things running accurately — customers, payments, records,
              and field work — often where the tools on sale are built for much
              larger markets far away.
            </p>
            <p>
              Our working model is {MYLESCORP.operatingModel.toLowerCase()}. We
              believe institutions in East Africa are best served by software
              that is modern and affordable, and that is designed with local
              realities in mind from the first line of code — not adapted
              afterwards.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            <LandingCard
              icon={<MapPin size={19} aria-hidden="true" />}
              eyebrow="Where we are based"
              title={MYLESCORP.location}
              body="Our team works from Nairobi, serving customers across East Africa."
            />
            <LandingCard
              icon={<Target size={19} aria-hidden="true" />}
              eyebrow="Who we serve"
              title="East African organizations"
              body={MYLESCORP.coreMarket}
            />
            <LandingCard
              href={MYLESCORP.website}
              icon={<Globe size={19} aria-hidden="true" />}
              eyebrow="On the web"
              title="mylescorptech.com"
              body="The MylesCorp site carries the company story, portfolio, and contact details."
            />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>How we work</h2>
            <p>
              We are a product company with an implementation mindset. Each
              product is designed as a focused tool that a real team can adopt,
              then improved on a recurring cycle so it keeps earning its place
              in daily operations.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            <LandingCard
              variant="compact"
              step="1"
              title="SaaS products"
              body="Modern, subscription software that stays current without big project rollouts."
            />
            <LandingCard
              variant="compact"
              step="2"
              title="AI-assisted operations"
              body="Careful use of AI where it clarifies routine decisions and reduces manual work."
            />
            <LandingCard
              variant="compact"
              step="3"
              title="Client implementation"
              body="Agreed, evidence-led scope before any rollout is proposed — nothing over-promised."
            />
            <LandingCard
              variant="compact"
              step="4"
              title="Recurring improvement"
              body="Continuous product updates driven by what teams actually need next."
            />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>The company behind MylesNet</h2>
            <p>
              {MYLESNET_STORY.summary} The platform is our flagship product and
              the clearest example of how we work: one system for subscriber
              service, network operations, billing, and support.
            </p>
            <p>{MYLESNET_PORTFOLIO_NOTE}</p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            <LandingCard
              href="/company/about"
              icon={<Compass size={19} aria-hidden="true" />}
              eyebrow="MylesNet"
              title="The connectivity platform"
              body={`${MYLESNET_STORY.tagline} Subscriber service, billing, network operations, and support in one operating system.`}
            />
            <LandingCard
              href="/product"
              icon={<LayoutDashboard size={19} aria-hidden="true" />}
              eyebrow="What it does today"
              title="See the full product"
              body="Every module of the platform, and the honest status each one is at right now."
            />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Built from operators&apos; realities</h2>
            <p>
              Our founders run connectivity businesses themselves in Uganda and
              Kenya. That means the products are designed for the conditions
              operators actually work in: field staff on low-end Android
              devices, unreliable connections, and mobile money as the primary
              payment method. Problems we have lived are problems we are
              motivated to solve properly.
            </p>
            <p>
              This is why MylesNet keeps public statements to what can be
              supported, agrees scope with each operator before a rollout, and
              treats every deployment as a working relationship rather than a
              handover.
            </p>
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

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Leadership</h2>
            <p>
              The company is led by its founders, who stay directly reachable
              for customers — from first conversations to technical escalations.
            </p>
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

      <LandingCtaSection
        kicker="Company"
        title="An open door"
        subtitle="Whether you want to understand the company, the platform, or how we could work together, the conversation starts here."
        items={[
          {
            href: "/company/about",
            icon: <Compass size={19} aria-hidden="true" />,
            title: "About MylesNet",
            body: "The story, mission, and values behind the platform.",
            action: "Read the story",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "See the product",
            body: "Review every module and the status it is at today.",
            action: "Browse modules",
          },
          {
            href: MYLESCORP.aboutUrl,
            icon: <Globe size={19} aria-hidden="true" />,
            title: "Visit the MylesCorp site",
            body: "The wider company portfolio across sectors and markets.",
            action: "Visit site",
          },
        ]}
      />
    </>
  );
}