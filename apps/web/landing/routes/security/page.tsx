import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { securityPillars } from "@/landing/content/home";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";

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
          <p className="landing-section-kicker">Security &amp; trust</p>
          <h1>Serious about your data and your money</h1>
          <p className="landing-banner-lead">
            Running a network means owning real customer records, real router credentials,
            and real money. MylesNet treats all three with the care they deserve — and we
            are explicit about the boundary.
          </p>
          <div className="landing-banner-meta">
            <span className="landing-banner-meta-item">Role-based access</span>
            <span className="landing-banner-meta-item">Audit trail</span>
            <span className="landing-banner-meta-item">Encrypted credentials</span>
            <span className="landing-banner-meta-item">Append-only ledger</span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-trust-grid">
            {securityPillars.map((pillar) => (
              <article className="landing-trust-card" key={pillar.title}>
                <span className="landing-trust-icon">
                  <Icon name={pillar.icon} size={21} />
                </span>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>What that means in practice</h2>
            <ul className="landing-checklist">
              {securityDetail.map((item) => (
                <li className="landing-checklist-item" key={item.title}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>
                    <strong>{item.title}.</strong> {item.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Security &amp; trust</p>
          <h2>Questions about how your data is handled?</h2>
          <p>Ask us directly — we would rather explain the boundary than blur it.</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/contact">
              Talk to us
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/get-started">
              Get started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
