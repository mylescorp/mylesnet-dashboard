import { Building2, Mail, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCompanyContact } from "@/landing/content/contact";
import { COMPANY_LEADERSHIP, MYLESCORP } from "@/landing/content/company";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Contact us",
  "Reach the MylesNet team for sales enquiries, product information, and technical support.",
  { canonical: "/contact" }
);

/** Canonical contact paths, per Contact Page Standards. Values come from env. */
const CONTACT_PATHS = [
  {
    key: "contactEmail" as const,
    icon: <Mail size={18} aria-hidden="true" />,
    title: "General contact",
    body: "Anything that does not fit the other two paths. We will route it to the right person.",
  },
  {
    key: "infoEmail" as const,
    icon: <Building2 size={18} aria-hidden="true" />,
    title: "Company and product information",
    body: `Questions about ${MYLESCORP.legalName} or the wider product portfolio.`,
  },
  {
    key: "salesEmail" as const,
    icon: <Phone size={18} aria-hidden="true" />,
    title: "Sales and demos",
    body: "Pricing, demos, and getting a new network started on MylesNet.",
  },
];

export default function ContactPage() {
  const contact = getCompanyContact();
  const configuredPaths = CONTACT_PATHS.filter((path) => contact[path.key]);
  const configuredLeaders = COMPANY_LEADERSHIP.filter(
    (leader) => contact[leader.emailKey] || contact[leader.phoneKey]
  );
  const hasAnyContact = configuredPaths.length > 0 || configuredLeaders.length > 0;

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Contact"
            title="Talk to the people who build it"
            body={
              <>
                Questions about MylesNet, a demo run against your own numbers, or
                support on an existing network — every path below reaches a named
                person at {MYLESCORP.legalName}, not a shared inbox.
              </>
            }
            tags={[
              <>
                <ShieldCheck size={15} aria-hidden="true" />
                Named owners per path
              </>,
              <>
                <Building2 size={15} aria-hidden="true" />
                Based in {MYLESCORP.location}
              </>,
              <>
                <Mail size={15} aria-hidden="true" />
                Replies from {MYLESCORP.domain}
              </>,
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Choose the right path</h2>
            <p>
              Each address below is monitored by the person who owns that area,
              so your question reaches the right desk the first time.
            </p>
            {!hasAnyContact ? (
              <p className="landing-prose-note">
                Contact details are configured per deployment environment. If
                these cards are empty, the company contact variables are not set
                for this environment.
              </p>
            ) : null}
          </div>

          <div className="landing-grid landing-grid-spaced">
            {configuredPaths.map((path) => (
              <LandingCard
                key={path.key}
                icon={path.icon}
                title={path.title}
                body={path.body}
                footer={
                  <a className="landing-card-link" href={`mailto:${contact[path.key]}`}>
                    {contact[path.key]}
                  </a>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Who you will hear from</h2>
            <p>
              {MYLESCORP.legalName} is led by {COMPANY_LEADERSHIP.map((l) => l.name).join(" and ")}.
              Calls and escalations go straight to them.
            </p>
          </div>

          <div className="landing-grid landing-grid-spaced">
            {configuredLeaders.map((leader) => (
              <LandingCard
                key={leader.name}
                icon={<Phone size={18} aria-hidden="true" />}
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
        kicker="Next step"
        title="Prefer to see it first?"
        subtitle="If you would rather look at the platform than read about it, these are the fastest routes in."
        items={[
          {
            href: "/get-started",
            icon: <ShieldCheck size={19} aria-hidden="true" />,
            title: "Start a rollout",
            body: "Walk through onboarding with our team and scope your own network.",
            action: "Get started",
          },
          {
            href: "/pricing",
            icon: <Building2 size={19} aria-hidden="true" />,
            title: "Check pricing",
            body: "Plan tiers and what each one includes before you talk to anyone.",
            action: "See pricing",
          },
        ]}
        alt={true}
        altText={
          <>
            Prefer email? Write to{" "}
            <Link href="/company/about">the company</Link> to learn more about who
            builds MylesNet.
          </>
        }
      />
    </>
  );
}
