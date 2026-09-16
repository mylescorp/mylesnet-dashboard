import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { resourceItems } from "@/landing/content/resources";
import { pageMetadata } from "@/landing/content/seo";
import StatusChip from "@/landing/components/StatusChip";

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
          <p className="landing-section-kicker">Resources</p>
          <h1>Guides built for the operator&apos;s day</h1>
          <p className="landing-banner-lead">
            Practical guides on billing, payment automation, network operations, and the
            realities of running a small internet service in East Africa.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {resourceItems.map((item) =>
              item.href ? (
                <Link className="landing-resource-card" href={item.href} key={item.title}>
                  <span className="landing-resource-meta">
                    <StatusChip status="Available" />
                    <span>{item.meta}</span>
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span className="landing-bento-cta">
                    Read the guide
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <article className="landing-resource-card landing-resource-card-soon" key={item.title}>
                  <span className="landing-resource-meta">
                    <span className="landing-soon-chip">{item.meta}</span>
                    <span>On the editorial plan</span>
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              )
            )}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              Want a guide you don&apos;t see here? Tell us what would help — we publish
              what we find useful, not filler.
            </p>
            <div className="landing-hero-actions landing-hero-actions-start">
              <Link className="landing-cta-button" href="/contact">
                Request a guide
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="landing-secondary-button" href="/resources/how-it-works">
                How MylesNet works
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
