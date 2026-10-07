import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { integrationGroups, integrationStatusLegend } from "@/landing/content/integrations";
import { pageMetadata } from "@/landing/content/seo";
import StatusChip from "@/landing/components/StatusChip";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

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
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Integrations"
            title="Plays well with the tools you already run"
            body={
              <>
                Payment rails, network gear, messaging, and data tools — connected without
                replacing your infrastructure. Every integration carries an honest status:
                available, in pilot, on the roadmap, or scoped per operator.
              </>
            }
            tags={[
              "MikroTik RouterOS",
              "M-Pesa & Airtel Money",
              "RADIUS & FreeRADIUS",
              "REST API & webhooks",
            ]}
          />
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
                <div className="landing-int-list">
                  {group.items.map((item) => (
                    <LandingCard
                      key={item.name}
                      variant="compact"
                      title={<span className="landing-int-name">{item.name}</span>}
                      meta={<StatusChip status={item.status} />}
                      body={item.note}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Integrations"
        title="Need something on this list?"
        subtitle="If a tool, vendor, or payment rail you depend on is not listed, ask us — we scope integrations per operator and publish what's verified."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Tell us what you depend on and we will scope the integration.",
            action: "Start a conversation",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "See the product",
            body: "Review the modules these integrations plug into.",
            action: "Browse modules",
          },
        ]}
      />
    </>
  );
}
