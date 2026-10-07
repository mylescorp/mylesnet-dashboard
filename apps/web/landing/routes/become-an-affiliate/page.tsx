import { ArrowUpRight, LayoutDashboard, Handshake, CreditCard, Users, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import { Button } from "@/shared/ui/button";

export const metadata = pageMetadata(
  "Become an affiliate",
  "Earn a recurring commission when you refer operators to MylesNet — transparent rates, monthly payouts, and a portal that shows every lead and payment.",
  { canonical: "/become-an-affiliate" }
);

const howItWorks = [
  {
    icon: <Users size={20} aria-hidden="true" />,
    title: "1. Sign up",
    body: "Tell us who you are and how you reach operators — consultant, agent, community, or reseller.",
  },
  {
    icon: <Handshake size={20} aria-hidden="true" />,
    title: "2. Get your link",
    body: "A personal referral link and a landing page that carries your brand alongside ours.",
  },
  {
    icon: <CreditCard size={20} aria-hidden="true" />,
    title: "3. Earn on every bill",
    body: "A fixed percentage of the platform fee for every subscriber the referred operator bills, paid monthly.",
  },
  {
    icon: <CheckCircle2 size={20} aria-hidden="true" />,
    title: "4. See it all in the portal",
    body: "Leads, sign-ups, active subscribers, and payouts — no black box, no end-of-quarter surprises.",
  },
];

const terms = [
  "Commission is calculated on the platform fee after any volume discounts, not on the gross bill.",
  "Payouts are monthly, to the bank or mobile-money account you nominate, with a minimum threshold of the equivalent of $50.",
  "Self-referrals and circular referrals are not paid — the operator must be a new tenant to MylesNet.",
  "The programme is open in Kenya, Uganda, Tanzania, Rwanda, Burundi, Ethiopia, Ghana, Nigeria, and South Africa; other markets by approval.",
];

export default function BecomeAnAffiliatePage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Company"
            title="Become an affiliate"
            body={
              <>
                Refer operators to MylesNet and earn a recurring share of the platform fee. No
                quota, no tier game — the rate is fixed, the portal is transparent, and the
                payout is monthly.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {howItWorks.map((step) => (
              <LandingCard
                key={step.title}
                icon={step.icon}
                title={step.title}
                body={step.body}
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>Terms you should know</h2>
            <ul>
              {terms.map((term) => (
                <li key={term.slice(0, 40)}>{term}</li>
              ))}
            </ul>
            <p>
              The full programme policy — commission basis, attribution, payouts, conduct,
              and how either side ends the relationship — is published in{" "}
              <Link href="/legal/affiliate-policy">the affiliate programme policy</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Ready to join?</h2>
            <p>
              Fill in the short form and we will set up your portal within one business day.
              There is no cost to join and no obligation to refer a minimum number of operators.
            </p>
            <Button asChild size="lg" className="landing-cta-primary">
              <a href="/contact?subject=affiliate">Apply to the affiliate programme</a>
            </Button>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Affiliates"
        title="The platform does the work — you get the credit"
        subtitle="Every referred operator runs on the same billing, network, and support stack you already trust."
        items={[
          {
            href: "/contact",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Contact us",
            body: "Questions about the programme? We answer directly.",
            action: "Ask a question",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Product overview",
            body: "What the platform covers, so you can describe it accurately.",
            action: "Read the overview",
          },
        ]}
      />
    </>
  );
}