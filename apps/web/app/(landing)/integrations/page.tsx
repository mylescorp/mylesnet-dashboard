import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { integrationGroups, integrationStatusLegend } from "../content/integrations";
import { pageMetadata } from "../content/seo";
import StatusChip from "../components/StatusChip";

export const metadata = pageMetadata(
  "Integrations",
  "The payment rails, network devices, and tools MylesNet connects to — each with an honest availability label.",
  { canonical: "/integrations" }
);

export default function IntegrationsPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Integrations</p>
          <h1>Plays well with the tools you already run</h1>
          <p className="landing-banner-lead">
            Payment rails, network gear, messaging, and data tools — connected without
            replacing your infrastructure. Every integration carries an honest status:
            available, in pilot, on the roadmap, or scoped per operator.
          </p>
          <div className="landing-banner-meta">
            <span className="landing-banner-meta-item">MikroTik RouterOS</span>
            <span className="landing-banner-meta-item">M-Pesa &amp; Airtel Money</span>
            <span className="landing-banner-meta-item">RADIUS &amp; FreeRADIUS</span>
            <span className="landing-banner-meta-item">REST API &amp; webhooks</span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-legend">
            {integrationStatusLegend.map((entry) => (
              <span className="landing-legend-item" key={entry.status}>
                <StatusChip status={entry.status} />
                <span>{entry.meaning}</span>
              </span>
            ))}
          </div>

          <div className="landing-int-groups">
            {integrationGroups.map((group) => (
              <div className="landing-int-group" key={group.id}>
                <h2>{group.title}</h2>
                <p className="landing-int-group-desc">{group.description}</p>
                <ul className="landing-int-list">
                  {group.items.map((item) => (
                    <li className="landing-int-row" key={item.name}>
                      <span className="landing-int-name">{item.name}</span>
                      <StatusChip status={item.status} />
                      <span className="landing-int-note">{item.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Integrations</p>
          <h2>Need something on this list?</h2>
          <p>
            If a tool, vendor, or payment rail you depend on is not listed, ask us — we
            scope integrations per operator and publish what&apos;s verified.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/product">
              See the product
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}