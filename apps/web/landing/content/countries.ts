/**
 * Country pages for the public site.
 *
 * One page per market, covering what an ISP operator actually needs to know
 * to run in that country: how subscribers pay, who regulates the market, and
 * how MylesNet fits. The market list deliberately matches the affiliate
 * programme's markets (see /become-an-affiliate) so both surfaces stay in
 * step. Content is honest and operational — no invented statistics — and
 * payment rails are named exactly as subscribers know them.
 */

export type CountrySection = {
  heading: string;
  paragraphs: string[];
};

export type CountryFaq = {
  question: string;
  answer: string;
};

export type CountryPage = {
  /** URL slug, e.g. "kenya". */
  slug: string;
  name: string;
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  /** Display currency, e.g. "Kenyan Shilling (KES)". */
  currency: string;
  /** Short currency code used in copy, e.g. "KES". */
  currencyShort: string;
  /** Primary telecoms regulator. */
  regulator: string;
  /** Payment rails subscribers actually use, best-known first. */
  paymentRails: string[];
  /** Hero body for the page. */
  intro: string;
  /** One-line card summary for the /country index. */
  summary: string;
  sections: CountrySection[];
  faq: CountryFaq[];
};

export const countries: CountryPage[] = [
  {
    slug: "kenya",
    name: "Kenya",
    code: "KE",
    currency: "Kenyan Shilling (KES)",
    currencyShort: "KES",
    regulator: "Communications Authority of Kenya (CAK)",
    paymentRails: ["M-Pesa (Safaricom)", "Airtel Money", "Bank transfer", "Cards"],
    intro:
      "Kenya's mobile-money rails are the fastest and deepest on the continent, and most households pay for internet with M-Pesa. The operators that grow smoothly here make that money arrive, reconcile, and entitle service without manual steps.",
    summary:
      "M-Pesa-first payments, CAK licensing, and a dense WISP and estate market.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "M-Pesa is the default way most Kenyan households and businesses pay for anything, internet included — through STK push, a till number, or a paybill. Airtel Money is the second large rail, and bank transfers and cards cover corporate and institutional accounts.",
          "For an ISP the practical rule is simple: whatever the payment channel, it should post once, match to the right invoice, and update the subscriber's service — with every step traceable. When that loop is manual, the daily reconciliation becomes the quiet leak.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "The licensed operator market spans mobile operators, fibre players in the cities, and a large number of WISPs and estate networks in the suburbs and counties. Estate and apartment connections are particularly common, which rewards clean per-household accounts over shared arrangements.",
          "Licensing sits with the Communications Authority of Kenya. An operator's own compliance — licensing, frequency and content rules — stays outside the platform; what MylesNet adds is the operational spine those licenses run on.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "Pricing on this site quotes in KES, UGX or USD from a cached rate snapshot, so nothing has to look up an exchange rate when a page loads. Kenyan operators compare plans and payouts in the currency they actually think in.",
          "Direct M-Pesa posting and reconciliation are specified on the roadmap. Until they ship, the practical habit is fixed-rule statement matching on a strict schedule, so no day's transactions wait more than one reconciliation cycle.",
        ],
      },
    ],
    faq: [
      {
        question: "Does MylesNet price in Kenyan Shillings?",
        answer:
          "Yes — plan rates on this site display in KES, UGX or USD from a cached snapshot, so Kenyan operators see prices in the currency they already work in.",
      },
      {
        question: "Can I run an M-Pesa paybill through MylesNet today?",
        answer:
          "Direct, automatic M-Pesa posting and recurring debits are specified on the roadmap. Until they ship, the supported habit is fixed-rule import matching from mobile-money statements on a strict schedule.",
      },
      {
        question: "Does MylesNet handle CAK-required records for me?",
        answer:
          "No — licensing and regulatory filings stay with your business. MylesNet keeps the subscriber, payment, and service records those filings are built from in one place, which makes preparing them far faster.",
      },
    ],
  },
  {
    slug: "uganda",
    name: "Uganda",
    code: "UG",
    currency: "Ugandan Shilling (UGX)",
    currencyShort: "UGX",
    regulator: "Uganda Communications Commission (UCC)",
    paymentRails: ["MTN MobileMoney", "Airtel Money", "Bank transfer"],
    intro:
      "Mobile money is how most Ugandans pay for internet, led by MTN MobileMoney and Airtel Money. Operators here run on a payment culture that is fast but paper-light, which is exactly why clean records matter.",
    summary:
      "MTN MobileMoney and Airtel Money rails, UCC licensing, and growing fibre estates.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "MTN MobileMoney and Airtel Money carry the majority of personal payments, including internet subscriptions. Bank transfer and corporate accounts cover institutions and businesses. Many subscribers pay in monthly cycles that line up with salary dates, so renewal windows cluster.",
          "The discipline that pays off: one account record per customer that carries their services, payment history, and network identity, so a renewal or an overdue check always starts from the same facts.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "Uganda's market is a mix of national mobile operators, fibre providers in Kampala and the major towns, and a large field of smaller WISPs and estate networks. Shared-infrastructure estates are common in and around Kampala, which rewards per-household accounts and visible revenue per building.",
          "The Uganda Communications Commission licenses operators; an operator keeps its own licence and compliance obligations, while MylesNet provides the subscriber, billing, and payment records behind them.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "Plan rates on this site display in KES, UGX or USD from a cached snapshot, so Ugandan operators can compare plans without converting anything by hand.",
          "Direct mobile-money posting is specified on the roadmap. Until then, fixed-rule statement matching on a strict schedule keeps mobile-money money reconciling with the same clock rhythm the rails run on.",
        ],
      },
    ],
    faq: [
      {
        question: "Does MylesNet price in Ugandan Shillings?",
        answer:
          "Yes — plan rates display in KES, UGX or USD from a cached rate snapshot, so Ugandan operators see prices in UGX without a manual conversion.",
      },
      {
        question: "Will MylesNet auto-post MTN MobileMoney or Airtel Money payments?",
        answer:
          "Direct mobile-money posting and reconciliation are specified on the roadmap. Until they ship, statement import with fixed matching rules on a set schedule is the supported workflow.",
      },
      {
        question: "Is MylesNet built for small Ugandan ISPs?",
        answer:
          "Yes — the platform targets WISPs, estate networks, hospitality, and community networks across East Africa, and Ugandan operators are a core part of that market.",
      },
    ],
  },
  {
    slug: "tanzania",
    name: "Tanzania",
    code: "TZ",
    currency: "Tanzanian Shilling (TZS)",
    currencyShort: "TZS",
    regulator: "Tanzania Communications Regulatory Authority (TCRA)",
    paymentRails: ["M-Pesa (Vodacom)", "Tigo Pesa", "Airtel Money", "Halopesa", "Bank transfer"],
    intro:
      "Tanzania's mobile-money market is multi-rail — M-Pesa, Tigo Pesa, Airtel Money, and Halopesa all carry payments. A billing setup that only understands one rail leaves money behind, so reconciliation breadth matters here more than almost anywhere.",
    summary:
      "Multi-rail mobile money, TCRA licensing, and a reseller-driven payment culture.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "Tanzanian subscribers pay across several rails at once: M-Pesa from Vodacom, Tigo Pesa, Airtel Money, and Halopesa from CRDB, plus bank transfer for businesses. A household might change rail when pricing or agents do, so the money flow has to be rail-agnostic on the records side.",
          "The working rule for multi-rail markets: every payment posts once with the channel recorded, unmatched items sit in a visible bucket until resolved, and nothing moves off the visible record.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "The operator market spans national mobile networks, fibre in Dar es Salaam, Arusha, and Mwanza, and a large field of local WISPs and community networks, often distributing access through resellers and agents.",
          "TCRA licenses operators and publishes the tariff and quality-of-service rules; an operator keeps those obligations with the regulator while MylesNet holds the operating records behind them.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "The platform is built for multi-rail payment reality: a subscriber's account records every payment channel the operator accepts, and reporting shows what the business earned per channel, per plan, per estate.",
          "Direct mobile-money posting across rails is specified on the roadmap. Until then, statement import with fixed matching rules on a strict schedule keeps every rail reconciled.",
        ],
      },
    ],
    faq: [
      {
        question: "Which payment rails does MylesNet account for?",
        answer:
          "The records model accepts any channel — M-Pesa, Tigo Pesa, Airtel Money, Halopesa, bank, or cash — and every posting carries its channel with it. Direct posting per rail is specified on the roadmap.",
      },
      {
        question: "Where are prices shown for Tanzanian operators?",
        answer:
          "Plan rates display in KES, UGX or USD from a cached snapshot today. Tanzanian Shilling display is not quoted yet; contact the team to discuss your market's pricing needs.",
      },
      {
        question: "Can resellers and agents be tracked?",
        answer:
          "Yes — voucher and package records support agent distribution, and reporting shows sold versus redeemed, which is the reconciliation conversation every multi-rail market needs.",
      },
    ],
  },
  {
    slug: "rwanda",
    name: "Rwanda",
    code: "RW",
    currency: "Rwandan Franc (RWF)",
    currencyShort: "RWF",
    regulator: "Rwanda Utilities Regulatory Authority (RURA)",
    paymentRails: ["MTN MoMo", "Airtel Money", "Bank transfer"],
    intro:
      "Rwanda is a fibre-forward market with disciplined records, where MTN MoMo and Airtel Money handle most personal payments. Operators here prize cleanliness and auditability — exactly the habits a good billing system formalises.",
    summary:
      "Fibre-forward market, MTN MoMo and Airtel Money rails, RURA licensing.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "MTN MoMo and Airtel Money carry most personal payments, with bank transfer covering institutions and corporate estates. Kigali's estates and business zones buy in predictable monthly cycles, which rewards clear renewal windows and reliable reminders.",
          "Rwandan operators tell us the market values trust: records that can answer 'who paid, when, and what did they get' in seconds are a selling point, not an internal convenience.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "Rwanda is one of the most fibre-connected markets in the region, with strong coverage in Kigali and the secondary towns, plus a growing tier of WISPs serving estates and institutions outside the fibre footprint.",
          "The Rwanda Utilities Regulatory Authority (RURA) licenses and oversees the sector. An operator keeps its RURA obligations while running its daily records on the platform.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "The platform's audit discipline matches the market: an append-only financial ledger, exchange snapshots on every posting, and activity that can be audited. These are the habits Rwandan operators already expect, formalised.",
          "Direct mobile-money posting is specified on the roadmap; until then, statement import with fixed matching rules on a set schedule is the supported workflow.",
        ],
      },
    ],
    faq: [
      {
        question: "Does MylesNet handle Rwandan Franc records?",
        answer:
          "The ledger stores an FX snapshot on every posting, so an RWF payment always carries the rate of its moment and owes no explanation later. Display pricing quotes KES, UGX or USD today.",
      },
      {
        question: "Is the platform auditable for Rwandan standards?",
        answer:
          "Yes — every posting is traceable, the financial ledger is append-only, and activity is recorded with who and when, which is the shape an audited operator needs.",
      },
      {
        question: "Do you support estate and building networks in Kigali?",
        answer:
          "Yes — per-household accounts, multiple services per customer, and revenue reporting per building are core to the platform and match how Kigali estates run.",
      },
    ],
  },
  {
    slug: "burundi",
    name: "Burundi",
    code: "BI",
    currency: "Burundian Franc (BIF)",
    currencyShort: "BIF",
    regulator: "Agence de Régulation et de Contrôle des Télécommunications (ARCT)",
    paymentRails: ["Lumicash (Lumitel)", "Ecocash (Econet)", "Bank transfer", "Cash"],
    intro:
      "Burundi's market is smaller and more cash-aware than its neighbours — Lumicash and Ecocash carry the mobile-money load, and many subscribers still hand over cash. Clean records matter most where money moves by habit, not by log.",
    summary:
      "Lumicash and Ecocash rails, ARCT licensing, and a cash-and-mobile-money mix.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "Lumicash from Lumitel and Ecocash from Econet are the main mobile-money rails, with bank transfer for institutions and cash still common in many neighbourhoods. An operator that records every channel uniformly turns this mix into one readable ledger.",
          "The rule that keeps a mixed market honest: every payment — cash included — posts exactly once with its channel and time, and balances are always derivable from posted events, never from a hand-edited number.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "The operator market is a mix of the national players and local WISPs and community networks serving Bujumbura and the provinces, often on shared estate and building infrastructure.",
          "ARCT licences and oversees telecommunications. An operator keeps its licence and compliance duties with the regulator; the platform holds the operational records underneath.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "MylesNet's records model accepts any payment channel an operator accepts — mobile money, bank, or cash — and reports revenue per channel so a mixed market is still legible at a glance.",
          "Direct mobile-money posting is specified on the roadmap; until then, statement import with fixed matching rules on a set schedule keeps Lumicash and Ecocash reconciling on a rhythm.",
        ],
      },
    ],
    faq: [
      {
        question: "Can I record cash payments alongside mobile money?",
        answer:
          "Yes — every posting carries its channel, and reporting shows revenue per channel, so cash-adjacent customers and mobile-money customers sit in the same clean ledger.",
      },
      {
        question: "Does MylesNet integrate Lumicash or Ecocash?",
        answer:
          "Direct mobile-money posting is specified on the roadmap. Until it ships, statement import with fixed matching rules on a set schedule is the supported workflow.",
      },
      {
        question: "Is the platform suitable for a small community network?",
        answer:
          "Yes — the platform is built for WISPs, estates, hospitality, and community networks, and pricing has no per-router or per-seat charges, which suits smaller operators.",
      },
    ],
  },
  {
    slug: "ethiopia",
    name: "Ethiopia",
    code: "ET",
    currency: "Ethiopian Birr (ETB)",
    currencyShort: "ETB",
    regulator: "Ethiopian Communications Authority (ECA)",
    paymentRails: ["Telebirr (Ethio Telecom)", "CBE Birr", "M-Pesa (Safaricom Ethiopia)", "Bank transfer"],
    intro:
      "Ethiopia's market has opened rapidly — Telebirr, CBE Birr, and Safaricom Ethiopia's M-Pesa now move payments alongside banks. Operators entering this market face both the fastest growth curve in the region and the least settled billing habits.",
    summary:
      "A liberalising market with Telebirr, CBE Birr and M-Pesa rails, ECA licensing.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "Telebirr from Ethio Telecom has the widest reach, CBE Birr covers the banking-led population, and M-Pesa from Safaricom Ethiopia is building fast. Bank transfer and cash complete the picture, with many enterprise contracts quoted in foreign currency.",
          "Because the rails are young and still competing, records that are rail-agnostic today will save an operator from re-architecting when the market settles — every payment posts once with its channel, and everything else follows from that.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "Ethiopia's telecoms liberalisation has opened licensing to new operators and created one of the region's strongest growth markets for fibre and local access. The operator base is newer, which means the operators who start with clean records gain a durable advantage.",
          "The Ethiopian Communications Authority oversees the sector. An operator keeps its licence and compliance duties with the ECA; the platform holds the daily operational records.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "The platform's multi-rail records model fits a market where the payment leader is still being decided — allocate each subscriber's rail, reconcile per channel, and never rebuild records when one rail overtakes another.",
          "Direct mobile-money posting is specified on the roadmap; until then, statement import with fixed matching rules on a strict schedule is the supported workflow.",
        ],
      },
    ],
    faq: [
      {
        question: "Which Ethiopian payment rails does MylesNet account for?",
        answer:
          "The records model accepts any channel — Telebirr, CBE Birr, M-Pesa, bank, or cash — with the channel recorded on every posting and per-channel reporting.",
      },
      {
        question: "Can I quote and bill in foreign currency for enterprise customers?",
        answer:
          "The ledger stores an exchange snapshot on every posting, so a foreign-currency contract can be recorded without its amounts acquiring a drifting meaning later.",
      },
      {
        question: "Is MylesNet active in Ethiopia today?",
        answer:
          "The market list for the affiliate programme includes Ethiopia by approval. Contact the team to discuss your network — the platform itself is built for markets like this one.",
      },
    ],
  },
  {
    slug: "ghana",
    name: "Ghana",
    code: "GH",
    currency: "Ghana Cedi (GHS)",
    currencyShort: "GHS",
    regulator: "National Communications Authority (NCA)",
    paymentRails: ["MTN MoMo", "Telecel Cash", "Bank transfer", "Cards"],
    intro:
      "Ghana's mobile-money market is dominated by MTN MoMo, with Telecel Cash and bank rails close behind, and a fibre and WISP market growing steadily in Accra, Kumasi, and the secondary cities.",
    summary:
      "MTN MoMo-led payments, NCA licensing, and a growing fibre and WISP market.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "MTN MoMo carries the majority of personal payments, with Telecel Cash and the banking rails handling much of the rest, and cards for premium and corporate accounts. Subscription payment in Ghana is a monthly habit for most households.",
          "The operator's edge is renewal discipline: predictable due dates, reminders before expiry, and a reconnection path that is already understood by the subscriber.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "The operator market spans the national mobile players, fibre providers in the cities, and a wide field of local WISPs and estate networks. The National Communications Authority licenses and oversees the sector.",
          "An operator keeps its NCA licence and compliance duties with the regulator; MylesNet provides the subscriber, billing, and payment records behind the day-to-day operation.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "Plan rates display in KES, UGX or USD from a cached snapshot today; Ghanaian pricing display can be discussed with the team for your market.",
          "Direct MoMo posting is specified on the roadmap. Until then, fixed-rule statement matching on a strict schedule keeps MTN MoMo and Telecel Cash reconciling cleanly.",
        ],
      },
    ],
    faq: [
      {
        question: "Does MylesNet support MTN MoMo accounting?",
        answer:
          "Yes — the records model accepts any channel and posts it once with the channel recorded. Direct MTN MoMo posting is specified on the roadmap; statement import covers today.",
      },
      {
        question: "Are prices shown in Ghana Cedis?",
        answer:
          "Display pricing quotes KES, UGX or USD today. Contact the team to discuss displaying rates for the Ghanaian market.",
      },
      {
        question: "Is MylesNet suitable for a growing Ghanaian WISP?",
        answer:
          "Yes — WISPs, estates, hospitality, and community networks are the platform's core audience, with no per-router or per-seat charges at small scale.",
      },
    ],
  },
  {
    slug: "nigeria",
    name: "Nigeria",
    code: "NG",
    currency: "Nigerian Naira (NGN)",
    currencyShort: "NGN",
    regulator: "Nigerian Communications Commission (NCC)",
    paymentRails: ["Bank transfer / USSD", "Fintech wallets (Opay, Palmpay)", "Cards", "Cash"],
    intro:
      "Nigeria is Africa's largest telecoms market, where payments move by bank transfer, USSD, and fintech wallets more than mobile-money wallets. Operators here win on payment breadth and honest collections discipline.",
    summary:
      "Bank-led payments, NCC licensing, and the continent's deepest operator market.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "Nigerian subscribers pay overwhelmingly by bank transfer, USSD, and fintech wallets such as Opay and Palmpay, with cards for premium accounts and cash still common in informal resale. Payment success — how much of what was attempted actually posts — is the operating number that matters.",
          "Collections discipline is the edge: overdue balances that are visible get collected, and a defined overdue-to-suspension path keeps renewals calm and disputes rare.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "The market is the continent's largest: national mobile operators, dense fibre competition in Lagos, Abuja, and the major cities, and a huge tier of local WISPs and estate networks serving the rest.",
          "The Nigerian Communications Commission licenses and oversees the sector. An operator keeps its NCC obligations while running its subscriber, billing, and network records on the platform.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "The platform's records model accepts every channel a Nigerian operator already runs — bank, wallet, card, USSD, or cash — and reports revenue per channel so collections stay legible.",
          "Direct bank and wallet integration rails are not quoted for Nigeria today; statement import with fixed matching rules keeps any channel reconciling on a schedule.",
        ],
      },
    ],
    faq: [
      {
        question: "Can MylesNet handle bank-transfer and wallet payments?",
        answer:
          "Yes — every channel posts once with its channel recorded, and reporting shows revenue per channel. Direct bank and wallet integrations are not quoted for Nigeria; statement import covers today.",
      },
      {
        question: "Is there per-router or per-seat pricing?",
        answer:
          "No — PPPoE pricing is per active subscriber and hotspot is a percentage of confirmed revenue; there are no per-router, per-seat, or per-site charges.",
      },
      {
        question: "Do you support large Nigerian operators?",
        answer:
          "Enterprise pricing covers 10,000+ subscriber operations and multi-region set-ups; contact the team to scope it for your network.",
      },
    ],
  },
  {
    slug: "south-africa",
    name: "South Africa",
    code: "ZA",
    currency: "South African Rand (ZAR)",
    currencyShort: "ZAR",
    regulator: "Independent Communications Authority of South Africa (ICASA)",
    paymentRails: ["Bank transfer (EFT)", "Cards", "SnapScan / Zapper", "PayShap"],
    intro:
      "South Africa's market runs on a mature bank-led payment culture — EFT, cards, PayShap, and point-of-sale wallets — with one of the world's densest fibre and WISP landscapes. Operators here expect enterprise-grade records discipline.",
    summary:
      "Bank-led rails, ICASA licensing, and a mature fibre and WISP landscape.",
    sections: [
      {
        heading: "How subscribers pay",
        paragraphs: [
          "South African subscribers pay by EFT and card first, with PayShap instant transfers and wallets like SnapScan and Zapper for retail and small-business contexts. Monthly debit orders are common for residential fibre, which rewards predictable billing cycles.",
          "The operator's discipline is the same as everywhere else but at higher volume: one account record per customer, statements that reconcile, and an overdue path that is defined in advance and visible to the subscriber.",
        ],
      },
      {
        heading: "The market context",
        paragraphs: [
          "South Africa has one of the deepest fibre rollouts in the world, served by national and regional fibre operators alongside a vast tier of WISPs. The Independent Communications Authority of South Africa (ICASA) licenses the sector.",
          "An operator keeps its ICASA licence and compliance duties with the regulator; the platform holds the subscriber, billing, and payment records those obligations are built from.",
        ],
      },
      {
        heading: "Running on MylesNet here",
        paragraphs: [
          "The platform targets operators from a few hundred to tens of thousands of subscribers, with usage-based pricing that scales — no per-router or per-seat charges at any size.",
          "Direct payment integrations are not quoted for South Africa today; statement import with fixed matching rules keeps EFT, card, and wallet channels reconciling on a schedule.",
        ],
      },
    ],
    faq: [
      {
        question: "Does MylesNet support EFT and card payments?",
        answer:
          "The records model accepts any channel and posts it once with the channel recorded. Direct bank and card integrations are not quoted for South Africa; statement import covers today.",
      },
      {
        question: "Can MylesNet handle 10,000+ subscribers?",
        answer:
          "Yes — enterprise pricing covers 10,000+ subscriber operations and multi-region set-ups, which matches the scale of established South African fibre operators.",
      },
      {
        question: "Is MylesNet available in South Africa?",
        answer:
          "The affiliate programme operates there, and the platform is built for operators at South African scale. Contact the team to scope onboarding.",
      },
    ],
  },
];

export function getCountry(slug: string): CountryPage | undefined {
  return countries.find((country) => country.slug === slug);
}