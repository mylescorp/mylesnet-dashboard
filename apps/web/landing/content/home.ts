export type IndustryStat = {
  value: string;
  label: string;
  detail: string;
  source: { label: string; url: string };
};

export type ProcessStep = {
  step: string;
  title: string;
  description: string;
};

export type ComparisonRow = {
  without: string;
  with: string;
};

export type TrustPillar = {
  icon: string;
  title: string;
  description: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const audiences: string[] = [
  "WISPs & small ISPs",
  "Estate & apartment networks",
  "Market WiFi hotspots",
  "Hotels & guest Wi-Fi",
  "Community networks",
  "Campus & enterprise LANs",
];

export const heroAttributes: string[] = [
  "Prepaid & postpaid billing",
  "Voucher & QR sales",
  "MikroTik-ready operations",
  "In-portal alerts — SMS & email next",
];

export const industryStats: IndustryStat[] = [
  {
    value: "3B+",
    label: "people still offline",
    detail:
      "Most of the offline world is in low- and middle-income countries, and is overwhelmingly rural.",
    source: { label: "Internet Society", url: "https://www.internetsociety.org/" },
  },
  {
    value: "25–40",
    label: "shared users per connection",
    detail:
      "A single shared community connection can carry 25–40 simultaneous users when sessions are managed well.",
    source: { label: "Internet Backpack", url: "https://internetbackpack.org/" },
  },
  {
    value: "3–4%",
    label: "annual churn benchmark",
    detail:
      "Subscriber revenue starts leaking once annual churn climbs above the 3–4% healthy-operators benchmark.",
    source: { label: "Preseem ISP Network Report", url: "https://www.preseem.com/" },
  },
  {
    value: "5–25×",
    label: "cost of recovery vs retention",
    detail:
      "Winning back a lost subscriber can cost 5–25× more than keeping a clear renewal experience in place.",
    source: { label: "Subscriber economics benchmark", url: "https://www.bain.com/" },
  },
];

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Tell us about your network",
    description:
      "How many customers you serve, which plan types you offer, and how you operate today — so we start from your reality, not a template.",
  },
  {
    step: "02",
    title: "See it on your own numbers",
    description:
      "We walk through customer management, packages, and payments with your setup so you can judge the fit before any commitment.",
  },
  {
    step: "03",
    title: "Configure in your style",
    description:
      "We bring your plans, vouchers, billing rules, and network devices in with you — no manual required on your side.",
  },
  {
    step: "04",
    title: "Go live together",
    description:
      "Launch at a pace that suits you, with monitoring, support, and follow-up in place so your customers notice an upgrade, not a disruption.",
  },
];

export const comparisonRows: ComparisonRow[] = [
  {
    without:
      "Customer names scattered across notebooks, call logs, and chat messages.",
    with: "One account per customer, with every service, note, and interaction on a single timeline.",
  },
  {
    without:
      "Balances held in memory and paper receipts — argued at every renewal.",
    with: "Invoices, payments, and an append-only financial ledger you can always trace.",
  },
  {
    without:
      "A single fixed plan for everyone, or a new negotiation at every sale.",
    with: "Speed, data, time, and hotspot packages designed for your market and sold consistently.",
  },
  {
    without:
      "Outages discovered when the first customer calls to complain.",
    with: "Router health, monitoring, and usage visibility that surface problems early.",
  },
  {
    without:
      "Every support call re-explained to whoever answers the phone.",
    with: "Full customer history on every ticket, from every channel, for whoever picks it up.",
  },
];

export const securityPillars: TrustPillar[] = [
  {
    icon: "ShieldCheck",
    title: "Controlled access",
    description:
      "Operator accounts with role-based control, and sensitive settings protected from casual access.",
  },
  {
    icon: "Lock",
    title: "Encrypted & secure",
    description:
      "Connections encrypted in transit and credentials stored securely, following platform security practice.",
  },
  {
    icon: "Receipt",
    title: "Trustworthy money records",
    description:
      "An append-only financial ledger with an FX snapshot on every posting — no silent edits.",
  },
  {
    icon: "Server",
    title: "Protected configuration",
    description:
      "Device configuration backups with drift detection so a change never disappears without a trace.",
  },
];

export const faqItems: FaqItem[] = [
  {
    question: "Do we need to replace our routers or hotspot system?",
    answer:
      "No. MylesNet is designed to run alongside the MikroTik and network gear you already operate. The platform brings customers, packages, payments, and network operations into one console while your existing infrastructure stays in place.",
  },
  {
    question: "Do we need technical staff to get started?",
    answer:
      "No. We handle the technical setup during onboarding. If your team later wants to manage devices, monitoring, and configuration backups directly, we make that safe and visible — but it is never a requirement to start.",
  },
  {
    question: "Can we sell access through vouchers and QR codes?",
    answer:
      "Yes. You can create voucher batches with redeemable codes and QR support, in addition to selling packages directly to accounts. Voucher redemption is live in operator pilots today, and suits market hotspots, guest Wi-Fi, trials, and giveaways.",
  },
  {
    question: "How are payments tracked?",
    answer:
      "Prepaid and postpaid billing are both built in, running in operator pilots as they are hardened. Invoices, payments, and receipts flow through a verified end-to-end process into an append-only ledger, so you can always see daily revenue, MRR, ARPU, and overdue balances.",
  },
  {
    question: "Who is responsible for our customers' data?",
    answer:
      "You are. Your network operator account owns the customer and billing records you manage. MylesNet stores and serves them securely on that basis, and end customers direct data questions to you first.",
  },
  {
    question: "How long until we are live?",
    answer:
      "Most networks start with customers, plans, and payments configured and go live within days once we understand your setup — and we stay with you through the launch so operations continue cleanly.",
  },
  {
    question: "What does MylesNet cost?",
    answer:
      "Pricing is confirmed with our team based on your customer count, plan types, and the services you use. There is no one-size-fits-all price — tell us what you operate and we will give you a clear picture before anything is committed.",
  },
];

export const sourcesNote = {
  intro:
    "Figures shown above are published industry and research benchmarks — not MylesNet customer results. They describe the challenges and standards of running internet services broadly.",
  items: [
    { label: "Internet Society — State of Connectivity", url: "https://www.internetsociety.org/" },
    { label: "Internet Backpack — shared community connectivity", url: "https://internetbackpack.org/" },
    { label: "Preseem — 2025 ISP Network Report (churn benchmarks)", url: "https://www.preseem.com/" },
    { label: "Bain & Company — subscriber economics", url: "https://www.bain.com/" },
  ],
};

export const heroPreviewCaption =
  "Illustrative preview — the console shown is a sample interface, not live operator data.";

export const problemPains: { title: string; description: string }[] = [
  {
    title: "Manual billing & reconciliation",
    description:
      "Balances rebuilt from spreadsheets and mobile-money messages, argued again at every renewal.",
  },
  {
    title: "Paid, but still offline",
    description:
      "Customers pay, yet the service stays off — because nothing connects the money to the network.",
  },
  {
    title: "Plans, credentials & policies drift",
    description:
      "What was sold, who holds which credentials, and what the network enforces fall out of step.",
  },
  {
    title: "Customer history in fragments",
    description:
      "Records scattered across notebooks, call logs, chat messages, and paper receipts.",
  },
  {
    title: "Blind spots in revenue & churn",
    description:
      "No single view of daily revenue, expiring services, overdue balances, or network health.",
  },
  {
    title: "Field teams working blind",
    description:
      "No work-order, equipment, or installation context available when a technician is on site.",
  },
];

export const lifecycleSteps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Lead & signup",
    description: "Capture a prospective subscriber and their service address.",
  },
  {
    step: "02",
    title: "Qualification",
    description: "Confirm the connection is possible before promises are made.",
  },
  {
    step: "03",
    title: "Plan selection",
    description: "Pick the package that fits — prepaid, postpaid, or voucher.",
  },
  {
    step: "04",
    title: "Payment verification",
    description: "Confirm the payment before any service changes hands.",
  },
  {
    step: "05",
    title: "Network authorization",
    description: "Entitlements are applied to the subscriber's network access.",
  },
  {
    step: "06",
    title: "Activation",
    description: "The customer comes online with the correct service policy.",
  },
  {
    step: "07",
    title: "Usage & session monitoring",
    description: "Watch usage and network health while the service runs.",
  },
  {
    step: "08",
    title: "Support & field operations",
    description: "Resolve issues with the full customer and session history attached.",
  },
  {
    step: "09",
    title: "Renewal, suspension, reconnection",
    description: "Renewals flow, overdue handling is predictable, reconnection is traceable.",
  },
  {
    step: "10",
    title: "Reporting & growth",
    description: "Revenue, churn, and plan performance inform the next decision.",
  },
];

export const lifecycleHonesty = {
  lead: "When payment is verified, the service follows it.",
  detail:
    "MylesNet never claims automatic reconnection on an unconfirmed request. Entitlements move only after the money is confirmed, and automatic network reconnection is rolled out as it is verified with pilots.",
};

export const integrationHighlights: { name: string; status: "Available" | "Beta" | "Planned" | "Custom" }[] = [
  { name: "MikroTik RouterOS", status: "Available" },
  { name: "RADIUS AAA (FreeRADIUS)", status: "Planned" },
  { name: "M-Pesa", status: "Planned" },
  { name: "Airtel Money", status: "Planned" },
  { name: "SMS & WhatsApp", status: "Planned" },
  { name: "Enterprise SSO", status: "Available" },
];