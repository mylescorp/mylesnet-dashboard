export type ReleaseStatus = "Shipped" | "In verification" | "Specified";

export type Release = {
  slug: string;
  title: string;
  /** ISO date, newest first in the array. */
  date: string;
  status: ReleaseStatus;
  /** One-line card summary, also used as the meta description. */
  summary: string;
  /** What changed, in the operator's terms. */
  items: string[];
};

/**
 * Release notes for the public site. Entries are derived from the dated build
 * decision log, and the status is honest: "Shipped" means it is live in the
 * product today, "In verification" means it is built and under review before
 * it goes live, "Specified" means the scope is agreed but the build has not
 * started.
 */
export const releases: Release[] = [
  {
    slug: "usage-based-pricing",
    title: "Usage-based pricing published",
    date: "2026-10-06",
    status: "Shipped",
    summary:
      "Hotspot billing is 3% of confirmed hotspot revenue, PPPoE is $0.25 per active subscriber, and enterprise is custom.",
    items: [
      "Hotspot: 3% of the hotspot revenue MylesNet confirms in a month.",
      "PPPoE: $0.25 per subscriber active during the month — suspended and expired accounts cost nothing.",
      "Enterprise: custom volume pricing for 10,000+ subscribers and multi-region operations.",
      "No per-router, per-seat, or per-site charges, and a 14-day trial that needs no card.",
      "Rates display in KES, UGX or USD from a cached snapshot, so nothing has to look up an exchange rate when the pricing page loads.",
    ],
  },
  {
    slug: "audit-hash-chain",
    title: "Tamper-evident audit log",
    date: "2026-09-15",
    status: "In verification",
    summary:
      "Every new audit entry is sealed into a hash chain, so a record that was edited after the fact can be detected.",
    items: [
      "Each audit write is sealed with a SHA-256 over one canonical payload and linked to the previous entry's hash.",
      "Verification runs from the chain's genesis sentinel across the whole sealed history, not a rolling window.",
      "A background sweep re-verifies hourly and records how far it read.",
      "Existing audit rows stay readable but are deliberately outside the chain — nothing is backfilled, because rewriting history inside an append-only log would weaken the evidence rather than improve it.",
    ],
  },
  {
    slug: "platform-control-plane",
    title: "Provisioning queue, device fleet, and a read-only platform role",
    date: "2026-09-14",
    status: "In verification",
    summary:
      "Requests to provision network devices now move through an approval queue, and every decision is audit-logged.",
    items: [
      "Provisioning requests move pending → approved or rejected → deployed, with the reason and the approver recorded.",
      "Device fleet rows carry firmware version, uptime percentage, and provisioning status.",
      "Voucher redemptions record the device and address they came from, with a clean, flagged, or blocked status.",
      "A read-only platform role for anyone who must see everything and change nothing.",
      "Automatic re-sync of large site collections was removed on purpose — on large inventories it ran as an unattended bulk job touching every network device, and that is never how a fleet should change.",
    ],
  },
  {
    slug: "tenant-data-isolation",
    title: "Per-tenant data isolation at the schema level",
    date: "2026-09-11",
    status: "In verification",
    summary:
      "Sixty tenant-owned tables now carry a tenant scope, with tenancy tables for members and entitlements.",
    items: [
      "Every tenant-owned table carries a tenant scope, with matching tables for organisation members and entitlements.",
      "Tenant access resolves from the signed-in organisation, never from a browser cookie.",
      "A suspended tenant denies its members at the gate rather than by a flag checked deeper in the stack.",
      "Staged backfill plan and pure isolation guards are covered by tests, and the whole thing is schema-pushed behind feature flags.",
    ],
  },
  {
    slug: "public-site-relaunch",
    title: "Public site relaunch: product, integrations, security, customers, and resources",
    date: "2026-09-11",
    status: "Shipped",
    summary:
      "Five new public pages, an honest status chip on every card, and navigation that matches the sitemap.",
    items: [
      "Five new pages: product, the integration catalogue, security, customers, and a resources hub.",
      "Header navigation, footer sitemap, sitemap.xml, and the auth proxy allowlist updated together for every new route.",
      "Honest status labels — Available, Beta, Planned, Custom — on cards across the site.",
      "The home page gained the problem list, the subscriber lifecycle loop, and the payment-honesty strip.",
    ],
  },
  {
    slug: "captive-portal-scope",
    title: "Captive portal and hotspot scope approved",
    date: "2026-09-10",
    status: "Specified",
    summary:
      "One system and one route surface for guest Wi-Fi — no separate portal app — with the sign-in paths and payment flow agreed.",
    items: [
      "Voucher, phone OTP, MAC, and address-binding sign-in in the first release; the rest come after.",
      "Multi-path reconnection is mandatory: an active subscriber is never locked to a single path.",
      "Payments in the portal — M-Pesa STK Push first — with state tracked all the way to a router-verified connection.",
      "Package, plan, and voucher shops in the portal, with a plain checkout for guest payments.",
      "Build work has not started. The scope is approved and queued behind the current work.",
    ],
  },
];

/** "2026-10-06" -> "6 October 2026" (no date library). */
export function formatReleaseDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}
