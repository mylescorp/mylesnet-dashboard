import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  CreditCard,
  Gift,
  Landmark,
  MessageSquare,
  Minus,
  Percent,
  Router,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import SectionHead from "@/landing/components/SectionHead";
import JsonLd from "@/landing/components/JsonLd";
import PricingCalculator from "@/landing/components/PricingCalculator";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import { Button } from "@/shared/ui/button";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { pageMetadata } from "@/landing/content/seo";

export const metadata = pageMetadata(
  "Pricing — 3% Hotspot, $0.25 per active PPPoE user",
  "MylesNet costs 3% of hotspot revenue or $0.25 per active PPPoE user a month, with custom Enterprise pricing. No per-router, per-seat or per-site charges; 14-day free trial, no card.",
  { canonical: "/pricing" }
);

type UsagePlan = {
  id: string;
  name: string;
  audience: string;
  lede: string;
  value: string;
  period: string;
  cta: string;
  href: string;
};

const USAGE_PLANS: UsagePlan[] = [
  {
    id: "hotspot",
    name: "Hotspot",
    audience: "For public WiFi, voucher and captive-portal networks.",
    lede: "The fee is 3% of the hotspot revenue MylesNet confirms in a month.",
    value: "3%",
    period: "of hotspot revenue",
    cta: "Start free trial",
    href: "/get-started",
  },
  {
    id: "pppoe",
    name: "PPPoE",
    audience: "For fibre and wireless broadband subscribers on monthly plans.",
    lede:
      "The fee is $0.25 for each subscriber who was active during the month. Suspended and expired accounts are not charged.",
    value: "$0.25",
    period: "per active user / month",
    cta: "Start free trial",
    href: "/get-started",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience:
      "For operators with 10,000+ subscribers, operations in multiple regions or regulatory requirements.",
    lede: "Volume pricing is agreed with the team against the network you operate.",
    value: "Custom",
    period: "volume pricing",
    cta: "Talk to sales",
    href: "/contact",
  },
];

const SHARED_ROWS: { label: string; cells: string[] }[] = [
  { label: "Unlimited customers, vouchers and revenue", cells: ["Included", "Included", "Included"] },
  { label: "Router, network and hotspot monitoring", cells: ["Included", "Included", "Included"] },
  { label: "Packages, vouchers and free-trial selling", cells: ["Included", "Included", "Included"] },
  { label: "Invoices, payments and an audit-safe ledger", cells: ["Included", "Included", "Included"] },
  { label: "Data usage and heavy-user visibility", cells: ["Included", "Included", "Included"] },
  { label: "Support tickets and in-portal notifications", cells: ["Included", "Included", "Included"] },
  { label: "No per-router, per-seat or per-site charges", cells: ["Included", "Included", "Included"] },
  { label: "Email support and guided onboarding", cells: ["Included", "Included", "Included"] },
];

const ENTERPRISE_ROWS: { label: string; cells: string[] }[] = [
  { label: "Dedicated resources", cells: ["Not included", "Not included", "Included"] },
  { label: "A dedicated account manager and onboarding", cells: ["Not included", "Not included", "Included"] },
  { label: "A written uptime SLA and 24/7 support", cells: ["Not included", "Not included", "Included"] },
  { label: "Data migration from your current system", cells: ["Not included", "Not included", "Included"] },
  { label: "Custom integrations, API limits and branding", cells: ["Not included", "Not included", "Included"] },
  { label: "Invoicing in local currency and annual contracts", cells: ["Not included", "Not included", "Included"] },
];

const HOW_RATES_ARE_COUNTED: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Percent size={19} aria-hidden="true" />,
    title: "Hotspot is 3% of what you collect",
    body: "The fee follows the hotspot revenue MylesNet confirms in a month. A quiet month costs less. A month that sells nothing costs nothing.",
  },
  {
    icon: <Users size={19} aria-hidden="true" />,
    title: "PPPoE is $0.25 per active subscriber",
    body: "The fee counts only the subscribers who were active during the month. Suspended and expired accounts stay in the system for free.",
  },
  {
    icon: <Router size={19} aria-hidden="true" />,
    title: "Routers and staff are not metered",
    body: "Every plan includes unlimited routers, staff accounts and vouchers. MylesNet does not charge per device, per seat or per site.",
  },
  {
    icon: <Gift size={19} aria-hidden="true" />,
    title: "The 14-day free trial comes first",
    body: "You get the whole product for fourteen days with no card required. Your real subscribers can be running on MylesNet before you are charged anything.",
  },
];

const PAY_METHODS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Smartphone size={19} aria-hidden="true" />,
    title: "M-PESA and mobile money",
    body: "Pay in your own shillings from the same phone your network already collects on.",
  },
  {
    icon: <Wallet size={19} aria-hidden="true" />,
    title: "Your MylesNet balance",
    body: "If you collect payments through MylesNet, you can settle the invoice from the balance you already hold. You don't need to withdraw it first.",
  },
  {
    icon: <CreditCard size={19} aria-hidden="true" />,
    title: "PayPal and cards",
    body: "This option suits operators paying in dollars or from outside the region. You send the payment each month, and MylesNet does not keep your card.",
  },
  {
    icon: <Landmark size={19} aria-hidden="true" />,
    title: "Bank transfer",
    body: "Send the payment from your business account, and MylesNet reconciles it against your invoice.",
  },
];

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Is there a free trial of MylesNet?",
    answer: "Yes. You get the whole product for fourteen days, and no card is required.",
  },
  {
    question: "How is the MylesNet PPPoE fee counted?",
    answer:
      "The fee is $0.25 for each subscriber who was active during the month. Suspended and expired accounts are free.",
  },
  {
    question: "How is the MylesNet Hotspot fee counted?",
    answer:
      "The fee is 3% of the hotspot revenue MylesNet confirms in a month. A Hotspot month with no sales costs nothing.",
  },
  {
    question: "What if I run both Hotspot and PPPoE?",
    answer:
      "The two fees are added together. For example, a 3% fee on $1,000 of hotspot revenue ($30) plus 100 active PPPoE users ($25) comes to $55 per month.",
  },
  {
    question: "Does MylesNet charge per router, staff account or voucher?",
    answer:
      "No. Routers, staff accounts and vouchers are not metered, and there are no per-device, per-seat or per-site charges.",
  },
  {
    question: "Does MylesNet charge me automatically?",
    answer:
      "No. MylesNet sends you an invoice for the month just past, with a grace period, and you pay it. No card is kept on file.",
  },
  {
    question: "Who is the Enterprise plan for?",
    answer:
      "The Enterprise plan is for operators with 10,000+ subscribers, multiple regions or regulatory requirements. It uses custom volume pricing and adds a written uptime SLA, 24/7 support, a dedicated account manager, data migration, custom integrations, local-currency invoicing and annual contracts.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

function CompareCell({ value }: { value: string }) {
  if (value === "Included") {
    return (
      <span className="landing-compare-yes">
        <Check size={15} aria-hidden="true" />
        Included
      </span>
    );
  }
  if (value === "Not included") {
    return (
      <span className="landing-compare-no">
        <Minus size={15} aria-hidden="true" />
        Not included
      </span>
    );
  }
  return <span className="landing-compare-value">{value}</span>;
}

function CompareGroup({ title, rows }: { title: string; rows: { label: string; cells: string[] }[] }) {
  return (
    <>
      <tr className="landing-compare-group">
        <th scope="rowgroup" colSpan={4}>
          {title}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.label}>
          <th scope="row">{row.label}</th>
          {row.cells.map((cell, index) => (
            <td key={`${row.label}-${index}`}>
              <CompareCell value={cell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PricingPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Pricing"
            title="MylesNet pricing plans"
            body={
              <>
                Three ways to pay: 3% of the hotspot revenue MylesNet confirms in a
                month, $0.25 for each PPPoE subscriber active during the month, or
                custom Enterprise pricing. Routers, staff and vouchers are not
                metered — and every plan starts with a 14-day free trial, with no
                card required.
              </>
            }
            tags={[
              <>
                <CalendarCheck size={14} aria-hidden="true" />
                14-day free trial
              </>,
              <>
                <CreditCard size={14} aria-hidden="true" />
                No card required
              </>,
              "KES · UGX · USD",
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Plans"
            title="Pick the model that matches your network"
            subtitle="Hotspot for public WiFi, voucher and captive-portal networks; PPPoE for fibre and wireless broadband subscribers. If you run both, the two fees add up."
          />

          <div className="landing-plans-grid">
            {USAGE_PLANS.map((plan) => (
              <LandingCard
                key={plan.id}
                className="landing-plan-card"
                title={<span className="landing-plan-name">{plan.name}</span>}
                body={
                  <>
                    <span className="landing-plan-audience">{plan.audience}</span>
                    <span className="landing-plan-fee-lede">{plan.lede}</span>
                  </>
                }
                footer={
                  <Button asChild className="landing-plan-cta w-full">
                    <Link href={plan.href}>
                      {plan.cta}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                }
              >
                <div className="landing-plan-price">
                  <span className="landing-plan-price-value">{plan.value}</span>
                  <span className="landing-plan-price-period">{plan.period}</span>
                </div>
              </LandingCard>
            ))}
          </div>

          <p className="landing-plans-footnote">
            The PPPoE rate is set in USD and shown against the approved
            reference-rate snapshot for KES and UGX. Currency is chosen
            automatically from your browser region and you can switch it any time.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Compare"
            title="Compare the three plans"
            subtitle="Every plan runs the same core platform — Enterprise adds the guarantees large operations need."
          />
          <div className="landing-compare-wrap">
            <table className="landing-compare">
              <caption className="landing-compare-caption">
                What every MylesNet plan includes, and what Enterprise adds
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col">Hotspot</th>
                  <th scope="col">PPPoE</th>
                  <th scope="col">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <CompareGroup title="What every MylesNet plan includes" rows={SHARED_ROWS} />
                <CompareGroup title="Enterprise adds" rows={ENTERPRISE_ROWS} />
              </tbody>
            </table>
          </div>
          <p className="landing-compare-hint">Scroll sideways to see every plan.</p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Estimate"
            title="Estimate your monthly MylesNet fee"
            subtitle="If you run both Hotspot and PPPoE, the two fees add up. Use 0 for any service you don't run."
          />
          <PricingCalculator />
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <SectionHead
            kicker="How it works"
            title="How each rate is counted"
            subtitle="Both rates follow what your network earns and carries, so your MylesNet bill moves with it."
          />
          <div className="landing-grid">
            {HOW_RATES_ARE_COUNTED.map((item) => (
              <LandingCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead kicker="Billing" title="MylesNet invoices you, and you pay" />
          <div className="landing-prose">
            <p>
              <strong>MylesNet does not bill you automatically:</strong>
            </p>
            <ul>
              <li>No card is kept on file.</li>
              <li>Nothing is taken on a schedule.</li>
              <li>
                Nothing is drawn from your MylesNet balance on MylesNet&apos;s
                own initiative.
              </li>
            </ul>
            <p>
              The invoice arrives and you send the payment. MylesNet&apos;s
              automation works on your subscribers, not on you.
            </p>
            <p>
              Each invoice covers the month just past, so you are never asked to
              pay before your network has earned the money. Every invoice
              includes a grace period, and the MylesNet team contacts you before
              anything about your access changes.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Payments"
            title="Ways to pay your MylesNet invoice"
            subtitle="Send the payment each month through the channel that suits your business — nothing is kept on file."
          />
          <div className="landing-grid">
            {PAY_METHODS.map((method) => (
              <LandingCard
                key={method.title}
                icon={method.icon}
                title={method.title}
                body={method.body}
              />
            ))}
            <LandingCard
              href="/contact"
              icon={<MessageSquare size={19} aria-hidden="true" />}
              title="Ask about billing"
              body="Questions about rates, invoices, or moving to volume pricing — the team answers them directly."
              footer={
                <span className="landing-card-link landing-card-link-plain">
                  Contact the team <ArrowRight size={15} aria-hidden="true" />
                </span>
              }
            />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="FAQ"
            title="Questions operators ask about pricing"
            subtitle="Straight answers about how each rate is counted, trials, and Enterprise."
          />
          <Accordion type="single" collapsible className="landing-faq">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="landing-faq-answer">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <JsonLd data={faqJsonLd} />
        </div>
      </section>

      <LandingCtaSection
        kicker="Pricing"
        title="Ready to see it on your own network?"
        subtitle="Tell us what you operate and we will help you choose the right model for it."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Run the whole platform free for 14 days, with our team alongside while you set up.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}
