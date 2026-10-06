import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { securityPillars } from "@/landing/content/home";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Security & trust",
  "How MylesNet protects operator accounts, customer records, router credentials, and money records.",
  { canonical: "/security" }
);

const securityDetail: { title: string; description: string }[] = [
  {
    title: "Operator accounts, role-controlled",
    description:
      "Sign-in through your own identity provider (SAML / OIDC) with role-based access, so only the right people reach sensitive settings.",
  },
  {
    title: "Activity that can be audited",
    description:
      "A traceable audit trail records who did what and when — across customers, billing, and configuration.",
  },
  {
    title: "Router credentials protected",
    description:
      "Network device credentials are stored in encrypted form and released only where and when they are needed.",
  },
  {
    title: "Money records you trust",
    description:
      "An append-only financial ledger stores an FX snapshot on every posting. Nothing is silently edited.",
  },
  {
    title: "Your network stays yours",
    description:
      "Live access integrations use tenant-scoped, secure platform workflows for private networks that must not touch the public internet.",
  },
  {
    title: "The boundary is explicit",
    description:
      "MylesNet never claims to open your network to the world — the platform operates alongside your existing infrastructure, not in front of it.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Security & trust"
            title="Serious about your data and your money"
            body={
              <>
                Running a network means owning real customer records, real router credentials,
                and real money. MylesNet treats all three with the care they deserve — and we
                are explicit about the boundary.
              </>
            }
            tags={[
              "Role-based access",
              "Audit trail",
              "Encrypted credentials",
              "Append-only ledger",
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-trust-grid">
            {securityPillars.map((pillar) => (
              <LandingCard
                key={pillar.title}
                icon={<Icon name={pillar.icon} size={21} />}
                title={pillar.title}
                body={pillar.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>What that means in practice</h2>
          </div>
          <ul className="landing-checklist">
            {securityDetail.map((item) => (
              <li key={item.title}>
                <LandingCard
                  variant="compact"
                  icon={<CheckCircle2 size={17} aria-hidden="true" />}
                  title={item.title}
                  body={item.description}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LandingCtaSection
        kicker="Security & trust"
        title="Questions about how your data is handled?"
        subtitle="Ask us directly — we would rather explain the boundary than blur it."
        items={[
          {
            href: "/contact",
            icon: <Mail size={19} aria-hidden="true" />,
            title: "Talk to us",
            body: "Ask us anything about data handling, access, or retention.",
            action: "Ask a question",
          },
          {
            href: "/get-started",
            icon: <ShieldCheck size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Set up your network with access controls in place from the start.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}
