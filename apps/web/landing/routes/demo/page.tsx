import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CirclePlay,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Ticket,
  Users,
} from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Live demo",
  "A tour of the MylesNet operator console — subscribers, billing, vouchers, network and support, the way a working day moves through them.",
  { canonical: "/demo" }
);

const surfaces = [
  {
    icon: <Users size={20} aria-hidden="true" />,
    title: "Subscribers",
    body: "One record per customer: services, balances, sessions, and history, with search that answers 'who is this' in one line.",
  },
  {
    icon: <CreditCard size={20} aria-hidden="true" />,
    title: "Plans & billing",
    body: "Prepaid and postpaid plans, invoices, renewals and suspensions — the dates are computed from the payment, never typed twice.",
  },
  {
    icon: <Ticket size={20} aria-hidden="true" />,
    title: "Vouchers",
    body: "Generate, sell, and track codes by agent or counter, with redemption recorded against the device it came in on.",
  },
  {
    icon: <Activity size={20} aria-hidden="true" />,
    title: "Network",
    body: "Devices, firmware, and provisioning status per site, so a router swap is a swap and not an afternoon of reconstruction.",
  },
  {
    icon: <LifeBuoy size={20} aria-hidden="true" />,
    title: "Support",
    body: "Tickets tied to the subscriber, not to a spreadsheet tab — the person answering can see service and payment state together.",
  },
  {
    icon: <ChartColumn size={20} aria-hidden="true" />,
    title: "Reports",
    body: "Daily revenue, renewals due against renewals done, overdue balances, and active subscribers, on one morning page.",
  },
];

export default function DemoPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Free tools"
            title="Live demo"
            body={
              <>
                The operator console, walked through surface by surface. A hosted demo environment
                with sample data is in preparation — until it opens, this tour shows what is
                inside it, and a walkthrough on your own numbers takes half an hour.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {surfaces.map((surface) => (
              <LandingCard
                key={surface.title}
                icon={surface.icon}
                title={surface.title}
                body={surface.body}
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              Nothing here is a screenshot of a plan: these are the surfaces operators use every
              day, in the order a day usually moves through them. If you want to see them live,
              book a call and we will open the console with you — on your own subscriber list, or
              on a sandbox tenant we set up first.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Live demo"
        title="See it with your own numbers"
        subtitle="A tour is a start; the useful part is opening your own list and asking awkward questions."
        items={[
          {
            href: "/book-a-call",
            icon: <CalendarClock size={19} aria-hidden="true" />,
            title: "Book a walkthrough",
            body: "Thirty minutes, screen shared, on your own setup or a sandbox.",
            action: "Book a call",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Product overview",
            body: "What the platform covers, module by module.",
            action: "Read the overview",
          },
        ]}
      />
    </>
  );
}
