export type IntegrationStatus = "Available" | "Beta" | "Planned" | "Custom";

export type Integration = {
  name: string;
  status: IntegrationStatus;
  note: string;
};

export type IntegrationGroup = {
  id: string;
  title: string;
  description: string;
  items: Integration[];
};

export const integrationStatusLegend: { status: IntegrationStatus; meaning: string }[] = [
  { status: "Available", meaning: "Running in production today." },
  { status: "Beta", meaning: "Live in controlled operator pilots — minor changes expected." },
  { status: "Planned", meaning: "Specified and sequenced on the roadmap." },
  { status: "Custom", meaning: "Not off-the-shelf; scoped per operator as it is verified." },
];

export const integrationGroups: IntegrationGroup[] = [
  {
    id: "aaa-access",
    title: "AAA & access",
    description: "How a subscriber's entitlements become network access.",
    items: [
      {
        name: "MikroTik hotspot — live sessions",
        status: "Available",
        note: "Current sessions stream into the operations view, so operators always see who is online and for how long.",
      },
      {
        name: "Voucher & plan redemption",
        status: "Beta",
        note: "Voucher codes and plan entitlements move from the sales ledger to the network in controlled pilots.",
      },
      {
        name: "RADIUS AAA — FreeRADIUS, PPPoE & hotspot",
        status: "Planned",
        note: "The RADIUS upgrade path for PPPoE and RADIUS-based hotspot authentication.",
      },
      {
        name: "CoA / Disconnect-Request automation",
        status: "Planned",
        note: "Automatic reconnection on the roadmap. Today, verified changes reach the network through the router API.",
      },
      {
        name: "Enterprise SSO — SAML & OIDC",
        status: "Available",
        note: "Sign in through your own identity provider with role-based access inside the platform.",
      },
    ],
  },
  {
    id: "network-devices",
    title: "Network devices",
    description: "The gear you already run, brought into one operations view.",
    items: [
      {
        name: "MikroTik RouterOS — health & telemetry",
        status: "Available",
        note: "Uptime, health checks, and traffic insight straight from the router API.",
      },
      {
        name: "MikroTik configuration backups",
        status: "Available",
        note: "Scheduled configuration backups with drift detection keep network state knowable.",
      },
      {
        name: "MikroTik zero-CLI provisioning",
        status: "Planned",
        note: "Day-0 setup and site provisioning from the console are on the roadmap.",
      },
      {
        name: "Ubiquiti, Cisco, Huawei & Cambium",
        status: "Custom",
        note: "Enabled per operator once device API coverage is verified for their estate.",
      },
      {
        name: "Ruckus, Aruba, OLT/ONU (GPON)",
        status: "Custom",
        note: "GPON and enterprise Wi-Fi vendors are scoped per operator.",
      },
    ],
  },
  {
    id: "payments-revenue",
    title: "Payments & revenue",
    description: "Getting money from payment to ledger — and service — without manual steps.",
    items: [
      {
        name: "Verified payment posting",
        status: "Available",
        note: "Confirmed payment messages post automatically; anything unmatched is flagged for human review.",
      },
      {
        name: "Reconciliation & ledger",
        status: "Available",
        note: "Balances reconcile against the append-only ledger with a traceable audit trail.",
      },
      {
        name: "M-Pesa — STK push",
        status: "Planned",
        note: "In-portal M-Pesa payment is specified and sequenced (approvals in place); MVP deferred by owner directive.",
      },
      {
        name: "Airtel Money",
        status: "Planned",
        note: "On the payments roadmap alongside M-Pesa.",
      },
      {
        name: "Cards, bank transfer, QR & USSD links",
        status: "Planned",
        note: "Additional payment rails are on the roadmap.",
      },
    ],
  },
  {
    id: "communications",
    title: "Communications",
    description: "Keeping operators, customers, and field teams in the loop.",
    items: [
      {
        name: "In-platform notifications",
        status: "Available",
        note: "Operators receive in-app alerts for important events as they happen.",
      },
      {
        name: "SMS messaging",
        status: "Planned",
        note: "Customer-facing SMS flows (confirmations, expiry, balances) are on the roadmap.",
      },
      {
        name: "WhatsApp Business messaging",
        status: "Planned",
        note: "Support and notification flows via WhatsApp Business are on the roadmap.",
      },
      {
        name: "Email & push notifications",
        status: "Planned",
        note: "Ongoing communication channels beyond in-app alerts.",
      },
    ],
  },
  {
    id: "observability",
    title: "Monitoring & observability",
    description: "Seeing the network clearly before subscribers feel a difference.",
    items: [
      {
        name: "Network health views",
        status: "Available",
        note: "Router uptime, session counts, and traffic insight in one screen.",
      },
      {
        name: "Network maps & fault boards",
        status: "Planned",
        note: "Topology views and shared fault boards are on the roadmap.",
      },
      {
        name: "Syslog & NetFlow / sFlow",
        status: "Planned",
        note: "Log streaming and flow analytics are on the roadmap.",
      },
      {
        name: "SNMP polling",
        status: "Planned",
        note: "SNMP-based device coverage is on the roadmap.",
      },
      {
        name: "TR-069 / ACS (CPE provisioning)",
        status: "Custom",
        note: "Customer-premises device management is scoped per operator.",
      },
    ],
  },
  {
    id: "data-automation",
    title: "Data & automation",
    description: "Making your records available to the systems you already use.",
    items: [
      {
        name: "REST API & webhooks",
        status: "Available",
        note: "Programmatic access and event webhooks on the Pro plan.",
      },
      {
        name: "CSV & report exports",
        status: "Available",
        note: "Exports for revenue, balances, and subscriber data on the Pro plan.",
      },
      {
        name: "Accounting integrations",
        status: "Custom",
        note: "Bookkeeping tool sync is scoped per operator's accounting setup.",
      },
      {
        name: "GIS & fiber maps",
        status: "Planned",
        note: "Geographic network mapping for fiber and fixed-wireless operators.",
      },
    ],
  },
];