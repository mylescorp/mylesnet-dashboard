import { ArrowUpRight, LayoutDashboard, Truck, ShieldCheck } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Shop",
  "Network hardware and operator merchandise — curated for the ISPs, WISPs, and estate networks that run on MylesNet.",
  { canonical: "/shop" }
);

const categories = [
  {
    icon: <Truck size={20} aria-hidden="true" />,
    title: "Router hardware",
    body: "MikroTik RouterBOARDs and accessories we have tested in the field — power supplies, antennas, and rack ears that fit.",
    status: "Coming soon",
    statusClass: "landing-soon-chip",
  },
  {
    icon: <ShieldCheck size={20} aria-hidden="true" />,
    title: "Operator gear",
    body: "Branded shirts, caps, and cable organisers — the things that make a site visit look like a site visit.",
    status: "Coming soon",
    statusClass: "landing-soon-chip",
  },
];

export default function ShopPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Learn"
            title="Shop"
            body={
              <>
                Hardware and merch for the operators who run on MylesNet. Nothing here is drop-shipped
                — we stock what we have installed ourselves, and the margins go back into the platform.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {categories.map((cat) => (
              <LandingCard
                key={cat.title}
                icon={cat.icon}
                title={cat.title}
                body={cat.body}
                meta={<span className={cat.statusClass}>{cat.status}</span>}
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              The shop is not open yet. If there is a router, a power supply, or a piece of kit
              you buy repeatedly and want us to carry, tell us — we add what our operators ask for.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Shop"
        title="Hardware you trust, bought from the same team that runs the software"
        subtitle="When the router and the billing come from the same conversation, the handoff disappears."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources/mikrotik-radius-operations",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "MikroTik guide",
            body: "Health checks, backups, and the AAA upgrade path.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}