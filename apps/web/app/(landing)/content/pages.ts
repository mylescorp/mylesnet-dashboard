export type LandingCard = {
  slug: string;
  title: string;
  description: string;
};

export type FeaturePage = {
  slug: string;
  title: string;
  icon: string;
  tagline: string;
  summary: string;
  whyMatters: string;
  highlights: FeatureHighlight[];
};

export type FeatureHighlight = {
  title: string;
  description: string;
};

export type SolutionPage = {
  slug: string;
  title: string;
  icon: string;
  tagline: string;
  summary: string;
  scenario: string;
  outcomes: string[];
};

export const features: FeaturePage[] = [
  {
    slug: "customer-management",
    title: "Customer management",
    icon: "Users",
    tagline: "One account view for every customer",
    summary:
      "Keep a complete record of every customer, household, business, or institution you serve — their services, contacts, notes, and communication history on a single timeline.",
    whyMatters:
      "Subscriber records that live in one reliable place protect your revenue at every renewal, because every interaction starts from the same, accurate history.",
    highlights: [
      {
        title: "Unified accounts",
        description:
          "Contacts, KYC details, addresses, notes, and contracts for every customer, household, or business.",
      },
      {
        title: "Multiple services per customer",
        description:
          "One account can carry several services and multiple locations — a home and a shop on the same record.",
      },
      {
        title: "A complete customer history",
        description:
          "Notes, calls, and interactions collected on one timeline so anyone on your team sees the full picture.",
      },
      {
        title: "Clean, controlled data",
        description:
          "Duplicate detection, controlled account merging, and configurable statuses that match how you operate.",
      },
      {
        title: "Multiple access identities",
        description:
          "Username, device, certificate, phone, or email identities per customer — one person, several ways in.",
      },
    ],
  },
  {
    slug: "packages-vouchers",
    title: "Packages and vouchers",
    icon: "Gift",
    tagline: "Design the offers that fit your market",
    summary:
      "Create data, time, and hotspot packages with clear limits, then sell them directly or through vouchers, free trials, and giveaways your customers can actually use.",
    whyMatters:
      "Offers that match how your market buys — a day pass, a weekend bundle, a student plan — are what turn a connection into revenue.",
    highlights: [
      {
        title: "Speed, data, and time plans",
        description:
          "Packages with duration and quota limits, built to fit prepaid, postpaid, and hotspot behaviour.",
      },
      {
        title: "Versioned, accurate records",
        description:
          "Versioned plans keep historical records accurate when you revise an offer — old renewals stay traceable.",
      },
      {
        title: "Vouchers with QR codes",
        description:
          "Batches of redeemable codes with QR support for markets, shops, and guest Wi-Fi sales.",
      },
      {
        title: "Trials and giveaways",
        description:
          "Free trials and giveaway bundles whenever you decide to run them — controlled, not chaotic.",
      },
      {
        title: "Control of unused codes",
        description:
          "Expired-voucher sweeps and reuse controls keep leftover stock from drifting into disputes.",
      },
      {
        title: "Plan types for every buyer",
        description:
          "Residential, business, hotspot, family, student, and promotional categories for the way you sell.",
      },
    ],
  },
  {
    slug: "payments-finance",
    title: "Payments and finance",
    icon: "CreditCard",
    tagline: "See revenue and receivables clearly",
    summary:
      "Track invoices, payments, and the money your network brings in with an immutable ledger and reports that show revenue, overdue balances, and plan performance.",
    whyMatters:
      "When money records are trustworthy and overdue balances are visible, renewals get easier and revenue stops leaking through forgotten invoices.",
    highlights: [
      {
        title: "Prepaid and postpaid billing",
        description:
          "Recurring invoices and prorating that follow your rules, not a rigid template.",
      },
      {
        title: "A verified payment flow",
        description:
          "Every payment is traced from initiation to posting to entitlement — nothing posted twice, nothing lost.",
      },
      {
        title: "An append-only financial ledger",
        description:
          "Every posting carries an FX snapshot, so balances and reports can always be audited.",
      },
      {
        title: "Revenue, MRR, and ARPU",
        description:
          "Daily revenue, monthly recurring revenue, payment success, and overdue balances at a glance.",
      },
      {
        title: "Clear suspension behaviour",
        description:
          "Late payment handling with defined overdue-to-suspension steps, so service stops and restarts predictably.",
      },
      {
        title: "Agent and reseller economics",
        description:
          "Agent and reseller pricing, commissions, and settlement reports when you sell through others.",
      },
    ],
  },
  {
    slug: "network-operations",
    title: "Network operations",
    icon: "Activity",
    tagline: "Monitor and manage your network estate",
    summary:
      "Keep routers, access points, switches, and sites healthy with monitoring, health checks, site inventory, and usage insights for every device on your network.",
    whyMatters:
      "Network health you can see turns expensive surprise outages into early, fixable warnings — which is what keeps customers connected and complaints quiet.",
    highlights: [
      {
        title: "Complete device inventory",
        description:
          "Routers, switches, access points, and sites tracked as one estate.",
      },
      {
        title: "Router health at a glance",
        description:
          "CPU, memory, uptime, interfaces, and telemetry for every router you monitor.",
      },
      {
        title: "Monitoring and incidents",
        description:
          "Monitoring with incidents and maintenance windows so planned work never looks like an outage.",
      },
      {
        title: "Usage per customer and device",
        description:
          "Data usage tracking that shows who is consuming the shared connection.",
      },
      {
        title: "Config backups and drift",
        description:
          "Configuration backups with drift detection so changes never vanish without a trace.",
      },
      {
        title: "Heavy-user visibility",
        description:
          "Bandwidth and session visibility that surfaces heavy users before they hurt neighbours.",
      },
    ],
  },
  {
    slug: "support-communications",
    title: "Support and communications",
    icon: "LifeBuoy",
    tagline: "Ticket, notify, and follow up",
    summary:
      "Handle customer issues from first message to resolution, and keep customers informed about renewals, payments, maintenance, and outages through the channels they already use.",
    whyMatters:
      "Fast, consistent support — with the whole customer history attached — turns complaints into loyalty and keeps renewals on track.",
    highlights: [
      {
        title: "Multi-channel help desk",
        description:
          "Tickets raised from the portal, email, SMS, and WhatsApp intake, in one queue.",
      },
      {
        title: "Priority and assignment",
        description:
          "Priorities, assignment, internal notes, and SLA tracking so nothing slips quietly.",
      },
      {
        title: "Fast follow-up tools",
        description:
          "Escalations and canned responses for consistent, quick replies.",
      },
      {
        title: "Proactive notifications",
        description:
          "SMS, email, and in-portal messages for renewals, payments, suspensions, and maintenance.",
      },
      {
        title: "Delivery-aware messaging",
        description:
          "Delivery status, retries, and consent handling so messages actually arrive.",
      },
      {
        title: "Templates and triggers",
        description:
          "Automated messaging for the moments customers care about most — renewal due, payment received, outage resolved.",
      },
    ],
  },
];

export const solutions: SolutionPage[] = [
  {
    slug: "market-hotspots",
    title: "Market WiFi hotspots",
    icon: "Store",
    tagline: "Public Wi-Fi for busy markets",
    summary:
      "Run monetized public Wi-Fi for market traders and shoppers with voucher or package access, clear revenue visibility, and reliable session management for many concurrent users.",
    scenario:
      "A busy market has surge demand every morning, no per-customer records, and revenue that is hard to account for.",
    outcomes: [
      "Voucher and package access for many concurrent users",
      "Real-time visibility of revenue from hotspot sales",
      "Fair usage limits that protect the shared connection",
      "Session visibility and troubleshooting for live users",
    ],
  },
  {
    slug: "estate-networks",
    title: "Estate and apartment networks",
    icon: "Building2",
    tagline: "Reliable internet for homes and tenants",
    summary:
      "Serve estates and apartment blocks with per-household accounts, transparent billing, and clear handling of renewals, suspensions, and reconnection.",
    scenario:
      "An estate has hundreds of homes, shared plans, and disputes every month about who paid and who stayed connected.",
    outcomes: [
      "Per-household accounts with clear billing and renewal dates",
      "Plan packages that match how tenants actually use the internet",
      "Transparent overdue and suspension handling",
      "Reports on active households and revenue per building",
    ],
  },
  {
    slug: "hospitality",
    title: "Hospitality guest Wi-Fi",
    icon: "Hotel",
    tagline: "Guest internet without the headache",
    summary:
      "Provide simple, reliable guest Wi-Fi for hotels and public venues with usage control and staff support that keeps guest experience first.",
    scenario:
      "Guests expect Wi-Fi that just works, staff have no way to control sessions, and the front desk becomes tech support.",
    outcomes: [
      "Simple guest access with usage and session control",
      "Time and data packages suited to guests",
      "A help desk for guest issues that staff can manage",
      "Monitoring so connectivity problems are caught early",
    ],
  },
  {
    slug: "community-networks",
    title: "Community networks",
    icon: "Globe",
    tagline: "Connect a community, sustainably",
    summary:
      "Operate a community network with transparent subscriber records, fair plans, and billing that keeps the network sustainable for the people who rely on it.",
    scenario:
      "A community network serves homes, schools, and kiosks at once — with fairness and sustainability essential.",
    outcomes: [
      "Subscriber-led records that respect community dynamics",
      "Fair, affordable plan types for different users",
      "Clear payment tracking and receivable visibility",
      "Usage monitoring to keep the shared network healthy",
    ],
  },
];

export const featureCards: LandingCard[] = features.map(({ slug, title, summary }) => ({
  slug,
  title,
  description: summary,
}));

export const solutionCards: LandingCard[] = solutions.map(({ slug, title, summary }) => ({
  slug,
  title,
  description: summary,
}));