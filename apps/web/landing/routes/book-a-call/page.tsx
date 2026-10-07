import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import { Button } from "@/shared/ui/button";

export const metadata = pageMetadata(
  "Book a call",
  "Pick a slot for a 30-minute walkthrough of the MylesNet platform — screen shared, on your own subscriber list or a sandbox tenant.",
  { canonical: "/book-a-call" }
);

const topics = [
  {
    icon: <Users size={20} aria-hidden="true" />,
    title: "Platform walkthrough",
    body: "Subscribers, billing, vouchers, network, support, reports — the full operator day in 30 minutes.",
  },
  {
    icon: <Activity size={20} aria-hidden="true" />,
    title: "Network & MikroTik",
    body: "Provisioning queue, health checks, RADIUS, firmware, and the router swap that is just a swap.",
  },
  {
    icon: <CreditCard size={20} aria-hidden="true" />,
    title: "Billing & payments",
    body: "Prepaid, postpaid, M-Pesa matching, vouchers, invoices, and the suspension path that never surprises.",
  },
  {
    icon: <CheckCircle2 size={20} aria-hidden="true" />,
    title: "Migration & onboarding",
    body: "Moving off spreadsheets or another system — staging, cutoff, one full cycle reconciled, then cut over.",
  },
];

const slots = [
  { day: "Monday–Friday", windows: ["08:00–10:00 EAT", "14:00–16:00 EAT", "18:00–20:00 EAT"] },
  { day: "Saturday", windows: ["09:00–12:00 EAT"] },
];

export default function BookACallPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Company"
            title="Book a call"
            body={
              <>
                Thirty minutes, screen shared, on your own setup or a sandbox tenant. Pick the
                topic that matters and a slot that works — no sales script, just the platform.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose landing-prose-spaced">
            <h2>What we cover</h2>
            <div className="landing-grid">
              {topics.map((topic) => (
                <LandingCard key={topic.title} icon={topic.icon} title={topic.title} body={topic.body} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Available windows (East Africa Time)</h2>
            <div className="landing-grid">
              {slots.map((slot) => (
                <LandingCard
                  key={slot.day}
                  icon={<CalendarClock size={20} aria-hidden="true" />}
                  title={slot.day}
                  body={slot.windows.join(", ")}
                />
              ))}
            </div>
            <p className="landing-prose-note">
              If none of these fit, email us and we will find a time.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose landing-prose-spaced">
            <h2>Book now</h2>
            <p>
              Pick a topic and a window, and we will confirm with a calendar invite and a link to
              join. If you would rather start by email, that works too.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
              <Button asChild variant="default" size="lg">
                <a href="/contact?subject=book-a-call">Request a slot by email</a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://wa.me/254700000000?text=I%27d%20like%20to%20book%20a%20MylesNet%20walkthrough">WhatsApp us</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Book a call"
        title="Or just explore first"
        subtitle="The product overview and the resources hub are open — no gate, no form."
        items={[
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Product overview",
            body: "What the platform covers, module by module.",
            action: "Read the overview",
          },
          {
            href: "/resources",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "All resources",
            body: "Guides and playbooks behind the features you will see.",
            action: "Browse guides",
          },
        ]}
      />
    </>
  );
}