import {
  Activity,
  ArrowUpRight,
  ChartColumn,
  CreditCard,
  GraduationCap,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Academy",
  "Practical ISP lessons, free to read — billing, network operations, payments, and the habits that keep a small network healthy.",
  { canonical: "/academy" }
);

const lessons = [
  {
    icon: <Users size={20} aria-hidden="true" />,
    title: "Subscriber lifecycle",
    body: "From lead to active, through suspension and reconnection — the loop every operator runs every day.",
    href: "/resources/how-it-works",
  },
  {
    icon: <CreditCard size={20} aria-hidden="true" />,
    title: "Billing discipline",
    body: "Prepaid, postpaid, vouchers, and the reconciliation rhythm that keeps money honest.",
    href: "/resources/billing-and-payments",
  },
  {
    icon: <Activity size={20} aria-hidden="true" />,
    title: "Network health",
    body: "The five-minute watchlist for MikroTik, what capacity drift looks like, and backups that save you.",
    href: "/resources/mikrotik-radius-operations",
  },
  {
    icon: <MapPin size={20} aria-hidden="true" />,
    title: "Estate & building networks",
    body: "Shared billing, per-household accounts, and the support flow that prevents neighbour disputes.",
    href: "/resources/estate-network-playbook",
  },
  {
    icon: <Ticket size={20} aria-hidden="true" />,
    title: "Voucher hygiene",
    body: "Codes that cannot be guessed, redemption tied to a device, and the sweep that cleans expired stock.",
    href: "/resources/wisp-launch-playbook",
  },
  {
    icon: <ChartColumn size={20} aria-hidden="true" />,
    title: "The Monday KPIs",
    body: "Four numbers — revenue, renewals, overdue, active — and what to do when one of them moves.",
    href: "/resources/isp-kpi-primer",
  },
];

export default function AcademyPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Learn"
            title="Academy"
            body={
              <>
                Short, practical lessons for ISP operators. Each one is a path through the
                guides under Resources — no sign-up, no schedule, no certificate. Just the
                habits that work.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {lessons.map((lesson) => (
              <LandingCard
                key={lesson.title}
                href={lesson.href}
                variant="link"
                icon={lesson.icon}
                title={lesson.title}
                body={lesson.body}
                footer={
                  <>
                    Start lesson
                    <GraduationCap size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              This is a lightweight index. The full lessons live in the guides and playbooks under
              Resources. If a topic you need is not here, tell us — the next lesson usually comes
              from a question an operator actually asked.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Academy"
        title="Lessons are the map; the platform is the terrain"
        subtitle="Read the habits here, then run them on your own subscriber list."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/blog",
            icon: <GraduationCap size={19} aria-hidden="true" />,
            title: "Blog",
            body: "Deeper pieces on payments, MikroTik, and the economics of small networks.",
            action: "Read the blog",
          },
        ]}
      />
    </>
  );
}