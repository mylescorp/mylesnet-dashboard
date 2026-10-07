import {
  ArrowRight,
  ArrowUpRight,
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
  "MylesNet pricing is based on hotspot revenue or active PPPoE subscribers. See the indicative rates and estimate a monthly fee; confirm billing terms with our team.",
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
    cta: "Discuss your setup",
    href: "/contact",
  },
  {
    id: "pppoe",
    name: "PPPoE",
    audience: "For fibre and wireless broadband subscribers on monthly plans.",
    lede:
      "The indicative fee is $0.25 per subscriber active during the month.",
    value: "$0.25",
    period: "per active user / month",
    cta: "Discuss your setup",
    href: "/contact",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "For operators who need a tailored commercial arrangement.",
    lede: "Volume pricing is agreed with the team against the network you operate.",
    value: "Custom",
    period: "volume pricing",
    cta: "Talk to sales",
    href: "/contact",
  },
];

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How is the MylesNet PPPoE fee counted?",
    answer:
      "The indicative rate is $0.25 for each PPPoE subscriber active during the month. Your quote confirms the applicable billing terms.",
  },
  {
    question: "How is the MylesNet Hotspot fee counted?",
    answer:
      "The indicative rate is 3% of Hotspot revenue confirmed for the month. Your quote confirms the revenue basis and any other billing terms.",
  },
  {
    question: "What if I run both Hotspot and PPPoE?",
    answer:
      "The two fees are added together. For example, a 3% fee on $1,000 of hotspot revenue ($30) plus 100 active PPPoE users ($25) comes to $55 per month.",
  },
  {
    question: "How are billing terms confirmed?",
    answer:
      "Your written quote will confirm the applicable fees, invoice timing, payment method and any other commercial terms before you proceed. Contact our team to discuss your network.",
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
                Indicative usage rates are 3% of confirmed hotspot revenue or
                $0.25 per active PPPoE subscriber per month. Custom pricing is
                available by quote. Contact us to confirm billing terms for your
                network.
              </>
            }
            tags={["KES · UGX · USD", "Indicative estimates"]}
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
            The PPPoE rate is set in USD. KES and UGX conversions are estimates
            based on the CBK commercial-bank average closing rates for 6 Oct
            2026; your quote confirms the applicable amount. See the
            <a href="https://www.centralbank.go.ke/forex/" target="_blank" rel="noreferrer">
              CBK rates and methodology
            </a>
            .
          </p>
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
            kicker="Billing terms"
            title="Confirm the details before you proceed"
            subtitle="The calculator is an estimate. Your written quote sets the fees and billing terms that apply to your network."
          />
          <div className="landing-prose">
            <p>
              We will confirm the applicable rate, invoice schedule, payment
              method, and any implementation or support charges in writing
              before you proceed. The displayed currency conversions are
              indicative estimates and may differ from your final quote.
            </p>
            <p>
              <Link href="/contact">Contact our team</Link> to discuss your setup.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="FAQ"
            title="Questions operators ask about pricing"
            subtitle="Answers about the published indicative rates and estimates."
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
            body: "Discuss your network and receive a written quote with the applicable commercial terms.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}
