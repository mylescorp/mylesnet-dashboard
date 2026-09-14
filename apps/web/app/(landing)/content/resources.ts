export type ResourceItemStatus = "available" | "soon";

export type ResourceItem = {
  title: string;
  description: string;
  status: ResourceItemStatus;
  href?: string;
  meta?: string;
};

export const resourceItems: ResourceItem[] = [
  {
    title: "How MylesNet works",
    description: "A walk through the operator's day: subscribers, services, billing, network, and reporting.",
    status: "available",
    href: "/resources/how-it-works",
    meta: "Guide",
  },
  {
    title: "ISP billing & payment operations",
    description: "Running prepaid and postpaid billing, vouchers, and reconciliation without drift.",
    status: "available",
    href: "/resources/billing-and-payments",
    meta: "Guide",
  },
  {
    title: "Kenya payment automation guide",
    description: "How M-Pesa posting, reconciliation, and verified payments fit an operator's money flow.",
    status: "available",
    href: "/resources/kenya-payment-automation",
    meta: "Guide",
  },
  {
    title: "MikroTik & RADIUS operations",
    description: "Health checks, configuration backups, RADIUS AAA, and the upgrade path.",
    status: "available",
    href: "/resources/mikrotik-radius-operations",
    meta: "Guide",
  },
  {
    title: "Captive portal & hotspot guide",
    description: "Splash pages, self-service registration, vouchers, and hotspot commerce for guest networks.",
    status: "available",
    href: "/resources/captive-portal-hotspot-guide",
    meta: "Guide",
  },
  {
    title: "WISP launch playbook",
    description: "From coverage plan to first paying customers for small wireless ISPs.",
    status: "available",
    href: "/resources/wisp-launch-playbook",
    meta: "Playbook",
  },
  {
    title: "Fiber & estate network playbook",
    description: "Subscriber management, shared billing, and support for estate and apartment networks.",
    status: "available",
    href: "/resources/estate-network-playbook",
    meta: "Playbook",
  },
  {
    title: "Subscriber migration checklist",
    description: "Moving customer records and balances off spreadsheets into one operations view.",
    status: "available",
    href: "/resources/subscriber-migration-checklist",
    meta: "Checklist",
  },
  {
    title: "ISP KPI primer",
    description: "The few numbers that matter for a small network: revenue, churn, ARPU, and overdue.",
    status: "available",
    href: "/resources/isp-kpi-primer",
    meta: "Primer",
  },
];