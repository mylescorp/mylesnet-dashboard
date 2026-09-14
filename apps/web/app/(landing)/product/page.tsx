import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { productModules, moduleStatusLegend } from "../content/product";
import { pageMetadata } from "../content/seo";
import { Icon } from "../components/LandingIcon";
import StatusChip from "../components/StatusChip";
import { Button } from "@/components/ui/button";

export const metadata = pageMetadata(
  "Product",
  "The MylesNet platform: customers, services, billing, network operations, and reporting — with an honest status against each module.",
  { canonical: "/product" }
);

export default function ProductPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Product</p>
          <h1>One platform for the life of every connection</h1>
          <p className="landing-banner-lead">
            MylesNet brings subscribers, services, billing, network operations, support,
            and reporting into one console — built for the small ISPs, WISPs, estates,
            hotels, and community networks that carry East Africa online.
          </p>
          <div className="landing-banner-meta">
            <span className="landing-banner-meta-item">Subscriber CRM</span>
            <span className="landing-banner-meta-item">Packages &amp; vouchers</span>
            <span className="landing-banner-meta-item">Verified payments &amp; ledger</span>
            <span className="landing-banner-meta-item">Network health &amp; telemetry</span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <h2 className="landing-section-title">Platform modules</h2>
            <span className="landing-legend-note">
              <Info size={15} aria-hidden="true" />
              Status labels are honest — read what each one means below.
            </span>
          </div>

          <div className="landing-product-grid">
            {productModules.map((module) => (
              <article className="landing-card landing-product-card" key={module.slug}>
                <div className="landing-card-head">
                  <span className="landing-card-icon">
                    <Icon name={module.icon} size={20} />
                  </span>
                  <StatusChip status={module.status} />
                </div>
                <h3 className="landing-card-title">{module.title}</h3>
                <p className="landing-card-body">{module.summary}</p>
                {module.note ? <p className="landing-product-note">{module.note}</p> : null}
                {module.href ? (
                  <Button asChild variant="outline" size="sm">
                    <Link className="landing-card-link" href={module.href}>
                      {module.cta ?? (module.status === "Planned" ? "See on the roadmap" : "See how it works")}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <span className="landing-card-link landing-card-link-plain">Module detail on request</span>
                )}
              </article>
            ))}
          </div>

          <div className="landing-legend">
            {moduleStatusLegend.map((entry) => (
              <span className="landing-legend-item" key={entry.status}>
                <StatusChip status={entry.status} />
                <span>{entry.meaning}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Product</p>
          <h2>See which modules fit your network</h2>
          <p>
            Tell us what you operate and we will map the right starting point — network
            operations, sales and billing, or the full platform.
          </p>
          <div className="landing-hero-actions">
            <Button asChild variant="default" size="lg">
              <Link href="/get-started">
                Get started
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/integrations">
                Explore integrations
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}