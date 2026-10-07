import {
  Activity,
  ArrowUpRight,
  ChartColumn,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  Ticket,
  Users,
} from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Documentation",
  "Setup guides for every part of the MylesNet platform — subscribers, billing, vouchers, network, and reporting.",
  { canonical: "/docs" }
);

const docSections = [
  {
    icon: <Users size={20} aria-hidden="true" />,
    title: "Subscribers",
    body: "Create, edit, suspend, and reactivate. Search by name, phone, or MAC — one record holds services, payments, and network identity.",
    href: "/resources/billing-and-payments",
  },
  {
    icon: <CreditCard size={20} aria-hidden="true" />,
    title: "Plans & billing",
    body: "Prepaid and postpaid plans, invoice cycles, renewal rules, and the suspension path that never surprises a customer.",
    href: "/resources/billing-and-payments",
  },
  {
    icon: <Ticket size={20} aria-hidden="true" />,
    title: "Vouchers",
    body: "Generate batches, assign to agents or counters, track redemption, and set fraud flags on suspicious velocity.",
    href: "/resources/wisp-launch-playbook",
  },
  {
    icon: <Activity size={20} aria-hidden="true" />,
    title: "Network & provisioning",
    body: "Devices, firmware, RADIUS, and the provisioning queue — a router swap is a hardware swap, not a configuration rebuild.",
    href: "/resources/mikrotik-radius-operations",
  },
  {
    icon: <LifeBuoy size={20} aria-hidden="true" />,
    title: "Support & tickets",
    body: "Tickets tied to the subscriber, so the person answering sees service state, balance, and history together.",
    href: "/resources/kenya-payment-automation",
  },
  {
    icon: <ChartColumn size={20} aria-hidden="true" />,
    title: "Reports & exports",
    body: "The four numbers to watch every morning, plus exports that reconcile with your bank and mobile-money statements.",
    href: "/resources/isp-kpi-primer",
  },
];

export default function DocsPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Learn"
            title="Documentation"
            body={
              <>
                Setup guides for every part of the platform. Each section links to the operator
                guide that covers it end to end.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {docSections.map((section) => (
              <LandingCard
                key={section.title}
                href={section.href}
                variant="link"
                icon={section.icon}
                title={section.title}
                body={section.body}
                footer={
                  <>
                    Open guide
                    <ExternalLink size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              This page is an index — the detail lives in the guides under Resources. If something
              is missing, tell us; we publish what we find useful, not filler.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Documentation"
        title="Run it, don't just read it"
        subtitle="Guides show the approach — the platform is where you apply it to your own network."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "All resources",
            body: "Browse every guide and playbook we have published.",
            action: "Browse guides",
          },
        ]}
      />
    </>
  );
}