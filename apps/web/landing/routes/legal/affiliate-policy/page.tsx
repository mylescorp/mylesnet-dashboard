import { ArrowUpRight, Handshake } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Affiliate programme policy",
  "The full terms of the MylesNet affiliate programme — commission basis, payouts, eligibility, attribution, and what happens when either party ends the relationship.",
  { canonical: "/legal/affiliate-policy" }
);

const policySections: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "1. Scope",
    paragraphs: [
      "This policy governs the MylesNet affiliate programme: a recurring commission paid to individuals or organisations who refer a new operator tenant to MylesNet. Joining is free and carries no obligation to refer a minimum number of operators.",
      "The programme is open in the markets listed on the Become an affiliate page — Kenya, Uganda, Tanzania, Rwanda, Burundi, Ethiopia, Ghana, Nigeria, and South Africa — and in other markets by prior approval from the MylesNet team.",
    ],
  },
  {
    heading: "2. Commission",
    paragraphs: [
      "Commission is calculated on the platform fee after any volume discounts, not on the gross bill of the referred operator. The rate is fixed at sign-up and is not reduced because a referred operator grows or churns within the attribution window.",
      "Commission is earned on active billable activity of the referred tenant — a new tenant must be created through the affiliate's referral link for the referral to count. Self-referrals and circular referrals are not paid: the referred operator must be a new tenant to MylesNet, and the affiliate must not be the same person or business that controls the referred tenant.",
    ],
  },
  {
    heading: "3. Payouts",
    paragraphs: [
      "Payouts are monthly, to the bank or mobile-money account the affiliate nominates, with a minimum threshold of the equivalent of $50 per payout. Balances below the threshold carry forward to the next payout; the affiliate may close their balance at any time once the threshold is met.",
      "Payout amounts are shown in the affiliate's portal alongside the leads and active subscribers they were calculated from, so every payment can be verified rather than trusted on invoice.",
    ],
  },
  {
    heading: "4. Attribution",
    paragraphs: [
      "A referral is attributed to the affiliate whose personal link the operator used to create their tenant, at the point the tenant is first created. Attribution is not retroactive: operators already in conversation with MylesNet through another channel do not become attributable by later using a referral link.",
      "The affiliate portal shows each attributed lead and its status, so an affiliate can see a referral before it becomes a tenant and spot a dispute while it is still small.",
    ],
  },
  {
    heading: "5. Conduct",
    paragraphs: [
      "Affiliates may describe MylesNet in their own words, but must not misrepresent the platform — its features, pricing, status, or roadmap — and must not bid on MylesNet trademark terms in paid search or impersonate MylesNet domains.",
      "Marketing that misleads an operator into becoming a tenant, or that appears to come from MylesNet itself, ends the relationship immediately and voids unpaid commission.",
    ],
  },
  {
    heading: "6. Taxes and compliance",
    paragraphs: [
      "Commission is income and is the affiliate's responsibility to declare under the tax law that applies to them. MylesNet reports what it pays where the law requires it to, and provides the affiliate with a statement of paid commission on request.",
      "The programme is not available in jurisdictions where it would violate local law, and either party may ask the other to confirm eligibility before payouts begin.",
    ],
  },
  {
    heading: "7. Ending the relationship",
    paragraphs: [
      "Either party may end the affiliate relationship with written notice. Commission earned before the end date is still paid according to the payout schedule; commission earned after the end date is not.",
      "MylesNet may end the relationship immediately for a breach of Section 5 (conduct). The affiliate may end the relationship at any time, and any balance above the payout threshold is settled at the next scheduled payout.",
    ],
  },
  {
    heading: "8. Changes to this policy",
    paragraphs: [
      "This policy is part of the site's legal terms and may be updated as the programme matures. Material changes are announced before they take effect, and the date of the latest revision is kept at the foot of this page.",
      "Questions about the programme or this policy are answered directly — contact the team through the Become an affiliate page.",
    ],
  },
];

export default function AffiliatePolicyPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Legal"
            title="Affiliate programme policy"
            body={
              <>
                The full terms behind the programme summary on the Become an affiliate
                page — commission, payouts, attribution, conduct, and what happens when
                either side ends the relationship.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <p>
              This policy is dated 6 October 2026 and forms part of the site&apos;s legal terms.
              It works alongside the summary on the Become an affiliate page; where they
              differ, the policy governs.
            </p>
            {policySections.map((section) => (
              <article key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Affiliates"
        title="Prefer to talk it through?"
        subtitle="Questions about commission, attribution, or a payout are answered directly by the team."
        items={[
          {
            href: "/become-an-affiliate",
            icon: <Handshake size={19} aria-hidden="true" />,
            title: "Become an affiliate",
            body: "The programme in plain language, with the terms you should know up front.",
            action: "Read the summary",
          },
          {
            href: "/contact?subject=affiliate",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Ask a question",
            body: "Contact the team about the programme or this policy.",
            action: "Contact us",
          },
        ]}
      />
    </>
  );
}
