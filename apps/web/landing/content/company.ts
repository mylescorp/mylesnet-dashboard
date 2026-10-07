/**
 * Public company and product narrative.
 *
 * Source of truth is the vault: `products/mylesnet/about.md` (MylesNet story)
 * and `MylesCorp Technologies Ltd.md` (company identity, leadership, values).
 * Vault paths are noted per block so drift is traceable. Nothing here may
 * contradict `Contact Page Standards` — contact values come from the
 * environment, never from this file.
 */

export const MYLESCORP = {
  legalName: "MylesCorp Technologies Ltd",
  tagline: "Practical software for African institutions that need to run with more clarity.",
  location: "Nairobi, Kenya",
  domain: "mylescorptech.com",
  website: "https://mylescorptech.com/",
  operatingModel:
    "SaaS products, AI-assisted operations, client implementation, and recurring product improvement.",
  coreMarket:
    "East African organizations that need modern, affordable, locally aware operational software.",
  aboutUrl: "https://mylescorptech.com/about",
} as const;

export const COMPANY_LEADERSHIP = [
  {
    name: "Jonathan Myles",
    role: "Founder, CEO and CTO",
    scope: "Technical issues, implementation escalations, system access, and engineering ownership.",
    emailKey: "infoEmail" as const,
    phoneKey: "technicalPhone" as const,
  },
  {
    name: "Pauline Moraa",
    role: "Co-founder, COO, Sales and Marketing lead",
    scope: "Sales inquiries, demos, onboarding commercial questions, and marketing follow-up.",
    emailKey: "salesEmail" as const,
    phoneKey: "salesPhone" as const,
  },
] as const;

/** The M.Y.L.E.S. Principle — company-wide, applied to every product. */
export const COMPANY_VALUES = [
  {
    letter: "M",
    value: "Mastery",
    commitment: "Build excellent, reliable, improving products that do not settle for average execution.",
  },
  {
    letter: "Y",
    value: "Youth Empowerment",
    commitment:
      "Support Africa's next generation through education, opportunity, mentorship, and tools that expand access.",
  },
  {
    letter: "L",
    value: "Leadership",
    commitment:
      "Lead with integrity, accountability, courage, and responsible decisions for every stakeholder.",
  },
  {
    letter: "E",
    value: "Entrepreneurship",
    commitment:
      "Encourage ownership, innovation, calculated risk, and practical problem-solving.",
  },
  {
    letter: "S",
    value: "Service",
    commitment:
      "Build for community impact and make company success useful to the people and markets served.",
  },
] as const;

export const MYLESNET_STORY = {
  name: "MylesNet",
  tagline: "Connecting communities, one mile at a time.",
  summary:
    "MylesNet helps East African connectivity operators deliver reliable, auditable, and commercially sustainable internet access. It brings subscriber service, network operations, billing, and support into one multi-tenant operating system.",
  mission:
    "Enable local connectivity providers to run secure, reliable, and accountable internet services without fragmented subscriber, payment, and network operations.",
  vision:
    "Become the trusted operating platform for growing ISP and WISP businesses across East Africa.",
  audiences: [
    "Market and estate hotspot operators",
    "Small and regional ISPs",
    "Hospitality and guest networks",
    "Community networks and estates",
  ],
} as const;

/**
 * Portfolio mention. Per the approved scope this is one short line linking to
 * the parent company, not a cross-sell grid — the portfolio list itself lives in
 * the vault, not on the MylesNet public site.
 */
export const MYLESNET_PORTFOLIO_NOTE =
  "MylesNet is one of several MylesCorp products covering education, healthcare, agriculture, transport, property, customer management, and connectivity. The full portfolio is listed on the MylesCorp site.";
