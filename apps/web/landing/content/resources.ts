export type ResourceItemStatus = "available" | "soon";

export type ResourceItem = {
  title: string;
  description: string;
  /** Centipid-style one-liner for the header dropdown; `description` is the card body. */
  summary?: string;
  status: ResourceItemStatus;
  href?: string;
  meta?: string;
};

export const resourceItems: ResourceItem[] = [
  {
    title: "How MylesNet works",
    description: "A walk through the operator's day: subscribers, services, billing, network, and reporting.",
    summary: "Subscribers, billing, network and reporting in one day",
    status: "available",
    href: "/resources/how-it-works",
    meta: "Guide",
  },
  {
    title: "ISP billing & payment operations",
    description: "Running prepaid and postpaid billing, vouchers, and reconciliation without drift.",
    summary: "Prepaid and postpaid billing without drift",
    status: "available",
    href: "/resources/billing-and-payments",
    meta: "Guide",
  },
  {
    title: "Kenya payment automation guide",
    description: "How M-Pesa posting, reconciliation, and verified payments fit an operator's money flow.",
    summary: "M-Pesa posting and reconciliation, end to end",
    status: "available",
    href: "/resources/kenya-payment-automation",
    meta: "Guide",
  },
  {
    title: "MikroTik & RADIUS operations",
    description: "Health checks, configuration backups, RADIUS AAA, and the upgrade path.",
    summary: "Health checks, backups and the AAA upgrade path",
    status: "available",
    href: "/resources/mikrotik-radius-operations",
    meta: "Guide",
  },
  {
    title: "Captive portal & hotspot guide",
    description: "Splash pages, self-service registration, vouchers, and hotspot commerce for guest networks.",
    summary: "Splash pages, vouchers and hotspot commerce",
    status: "available",
    href: "/resources/captive-portal-hotspot-guide",
    meta: "Guide",
  },
  {
    title: "WISP launch playbook",
    description: "From coverage plan to first paying customers for small wireless ISPs.",
    summary: "From coverage plan to first paying customers",
    status: "available",
    href: "/resources/wisp-launch-playbook",
    meta: "Playbook",
  },
  {
    title: "Fiber & estate network playbook",
    description: "Subscriber management, shared billing, and support for estate and apartment networks.",
    summary: "Shared billing for apartments and estates",
    status: "available",
    href: "/resources/estate-network-playbook",
    meta: "Playbook",
  },
  {
    title: "Subscriber migration checklist",
    description: "Moving customer records and balances off spreadsheets into one operations view.",
    summary: "Move records and balances off spreadsheets",
    status: "available",
    href: "/resources/subscriber-migration-checklist",
    meta: "Checklist",
  },
  {
    title: "ISP KPI primer",
    description: "The few numbers that matter for a small network: revenue, churn, ARPU, and overdue.",
    summary: "Revenue, churn, ARPU and overdue in one view",
    status: "available",
    href: "/resources/isp-kpi-primer",
    meta: "Primer",
  },
  {
    title: "Free ISP billing software",
    description: "What free billing actually costs a small ISP, and the point where free becomes the expensive option.",
    summary: "What free billing costs, and where it stops",
    status: "available",
    href: "/resources/free-isp-billing-software",
    meta: "Guide",
  },
  {
    title: "Internet billing systems",
    description: "What the system holds from subscriber record to router session, and why each piece has to agree.",
    summary: "What the system holds, subscriber to router",
    status: "available",
    href: "/resources/internet-billing-system",
    meta: "Guide",
  },
  {
    title: "MikroTik router monitoring",
    description: "What to watch on RouterBOARD hardware, which signals warn first, and how monitoring joins billing.",
    summary: "Every router watched, and what warns first",
    status: "available",
    href: "/resources/mikrotik-router-monitoring",
    meta: "Guide",
  },
];