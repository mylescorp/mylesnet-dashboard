import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { productModules, moduleStatusLegend } from "@/landing/content/product";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import StatusChip from "@/landing/components/StatusChip";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import { Button } from "@/shared/ui/button";

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
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Product"
            title="One platform for the life of every connection"
            body={
              <>
                MylesNet brings subscribers, services, billing, network operations, support,
                and reporting into one console — built for the small ISPs, WISPs, estates,
                hotels, and community networks that carry East Africa online.
              </>
            }
            tags={[
              "Subscriber CRM",
              "Packages & vouchers",
              "Verified payments & ledger",
              "Network health & telemetry",
            ]}
          />
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
              <LandingCard
                key={module.slug}
                className="landing-product-card"
                icon={<Icon name={module.icon} size={20} />}
                title={module.title}
                body={module.summary}
                meta={<StatusChip status={module.status} />}
                footer={
                  module.href ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={module.href}>
                        {module.cta ?? (module.status === "Planned" ? "See on the roadmap" : "See how it works")}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="landing-card-link landing-card-link-plain">
                      Module detail on request
                    </span>
                  )
                }
              >
                {module.note ? <p className="landing-product-note">{module.note}</p> : null}
              </LandingCard>
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

      <LandingCtaSection
        kicker="Product"
        title="See which modules fit your network"
        subtitle="Tell us what you operate and we will map the right starting point — network operations, sales and billing, or the full platform."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Map your network to the modules you need first.",
            action: "Start a conversation",
          },
          {
            href: "/integrations",
            icon: <Activity size={19} aria-hidden="true" />,
            title: "Explore integrations",
            body: "See the routers, payment rails, and tools we connect to.",
            action: "Browse integrations",
          },
        ]}
      />
    </>
  );
}
