/**
 * Comparison pages for the public site.
 *
 * Each page answers one honest question: "How does running my billing on
 * {tool} compare with running it on MylesNet?" The tone deliberately mirrors
 * the free-ISP-billing-software guide — no takedowns, no invented numbers —
 * because operators who are actually choosing between these tools deserve a
 * comparison they can verify. Where MylesNet does not do something yet, we
 * say so, and point to the roadmap.
 */

export type ComparisonPoint = {
  title: string;
  body: string;
};

export type Comparison = {
  /** URL slug, e.g. "freeradius". */
  slug: string;
  /** The tool being compared, e.g. "FreeRADIUS". */
  name: string;
  /** What the tool actually is, in one line, e.g. "RADIUS authentication server". */
  kind: string;
  /** One-line card summary for the /vs index. */
  tagline: string;
  /** Meta description / hero body. */
  summary: string;
  /** What the tool is and where it genuinely sits. */
  whatItIs: string;
  /** Where the tool is genuinely the right choice. */
  whereItWins: string[];
  /** Where it strains — operational cost, not badmouthing. */
  whereItStrains: string[];
  /** The honest comparison: MylesNet vs this tool, point by point. */
  howWeCompare: ComparisonPoint[];
  /** The closing honest verdict. */
  verdict: string;
  /** Related reading on the site. */
  related: { href: string; label: string }[];
};

export const comparisons: Comparison[] = [
  {
    slug: "freeradius",
    name: "FreeRADIUS",
    kind: "RADIUS authentication server",
    tagline: "The AAA engine most ISPs run — and the glue around it that becomes the real work.",
    summary:
      "FreeRADIUS is the open-source RADIUS server most small operators eventually run AAA on. This page compares it honestly with MylesNet — not as competitors, but as the engine versus the operations layer around it.",
    whatItIs:
      "FreeRADIUS is a RADIUS (Remote Authentication Dial-In User Service) server: the piece that decides who gets on the network, with what speed and policy, and bills sessions. It is the de-facto AAA engine for small ISPs worldwide and is genuinely excellent at that one job. What it is not — by design — is a billing system, a payment system, or an operations platform. Subscribers, plans, invoices, payments, and reconciliation all live outside it, which means someone builds and maintains that layer separately.",
    whereItWins: [
      "It is free and mature — battle-tested across thousands of networks over decades.",
      "It runs anywhere: a small VPS, a container, or a dedicated box on your own rack.",
      "Full control over AAA policy — every attribute, every reply, everything is editable.",
      "No vendor lock-in: your RADIUS design stays yours even if you change billing systems.",
    ],
    whereItStrains: [
      "There is no built-in billing, invoicing, or payment handling — that layer is yours to build and maintain.",
      "Mobile-money payment rails (M-Pesa, Airtel Money and friends) are entirely outside its scope.",
      "Running it well means owning upgrades, backups, and the inevitable debugging — an engineering job, ongoing.",
      "Reconciliation between the RADIUS database and your subscriber records is hand work unless you build the bridge.",
    ],
    howWeCompare: [
      {
        title: "Different layers, not rivals",
        body: "MylesNet does not replace FreeRADIUS — full RADIUS / PPPoE AAA is on the roadmap, and a MylesNet-style platform is designed to sit above it. FreeRADIUS answers 'who is connected'; MylesNet answers 'who is connected, what did they pay, and do the two agree'.",
      },
      {
        title: "The billing and payments layer",
        body: "FreeRADIUS leaves subscriber records, plans, invoices, payments, and reconciliation for the operator to assemble. MylesNet is that layer: one account record per customer, packages, payments, and renewals in one workspace.",
      },
      {
        title: "The money rails",
        body: "East African operators need mobile-money payments to post, match, and extend service. That work lives in the billing layer, not the RADIUS server — and it is specified on MylesNet's roadmap with M-Pesa and Airtel Money first.",
      },
      {
        title: "The operations view",
        body: "MylesNet adds the rest of the operator's day — customer management, router health, sessions, and reporting — so the RADIUS-invisible half of the business is covered too.",
      },
    ],
    verdict:
      "If you already run FreeRADIUS and your team owns it happily, keep it — and let the billing and payment layer stop being hand-built. If you are deciding between assembling your own stack and running the whole operation on one platform, MylesNet is the comparison worth making.",
    related: [
      { href: "/resources/mikrotik-radius-operations", label: "MikroTik & RADIUS operations guide" },
      { href: "/resources/internet-billing-system", label: "Internet billing systems guide" },
      { href: "/demo", label: "See the platform" },
    ],
  },
  {
    slug: "daloradius",
    name: "daloRADIUS",
    kind: "Web management front-end for FreeRADIUS",
    tagline: "A free web UI for FreeRADIUS users — useful, but it manages users, not money.",
    summary:
      "daloRADIUS is the most common web front-end for FreeRADIUS: a free, PHP-based UI for managing RADIUS users and billing plans on the server itself. This page compares it honestly with MylesNet.",
    whatItIs:
      "daloRADIUS is a web application that gives FreeRADIUS a visual management layer — user accounts, billing plans, payments records, and reports, stored in its own database and reconciled with the RADIUS server. It is free, widely deployed, and a genuine answer for operators who want a UI without buying software. The honest caveat is scope: it manages users and records the money, but it does not take payments, track subscription momentum, or run the rest of the network operation.",
    whereItWins: [
      "Free and open-source, with a large install base and years of forum wisdom behind it.",
      "A real web UI for FreeRADIUS users, plans, and reports — no CLI required.",
      "Runs on basic shared hosting or a small server, which keeps cost near zero.",
      "Deeply familiar to the generation of engineers who learned ISP billing on it.",
    ],
    whereItStrains: [
      "The interface and codebase have aged; modern expectations around usability and security take real effort to meet.",
      "Payments are recorded, not collected — mobile money, cards, and bank rails still need a separate flow.",
      "Self-hosting means you own PHP, MySQL, upgrades, and backups forever.",
      "It manages RADIUS users, not the wider operation: customers, estates, router health, and reporting live elsewhere.",
    ],
    howWeCompare: [
      {
        title: "The user record",
        body: "daloRADIUS keeps a user record for RADIUS purposes. MylesNet keeps one account record per customer covering contacts, services, payments, and network identity — the RADIUS username rides on it rather than defining it.",
      },
      {
        title: "The money rails",
        body: "daloRADIUS records payments after they happen elsewhere. MylesNet's billing layer is designed for payments to land, post, match an invoice, and extend service — with M-Pesa and Airtel Money specified on the roadmap.",
      },
      {
        title: "The operation beyond RADIUS",
        body: "Beyond users, an ISP runs estates, devices, sessions, and collections. MylesNet is built around that wider day; daloRADIUS is deliberately scoped to the RADIUS user base.",
      },
      {
        title: "Upkeep",
        body: "daloRADIUS asks your team to own the server for its life. MylesNet is a hosted platform designed so an operator with a handful of engineers — or one — can run billing and payments without a PHP maintenance project.",
      },
    ],
    verdict:
      "daloRADIUS is a fair free choice when you already live on FreeRADIUS and the money moves by hand. The moment payments need to flow and reconcile by themselves, or the operation grows beyond RADIUS users, the comparison flips toward a platform that covers the whole day.",
    related: [
      { href: "/vs/freeradius", label: "FreeRADIUS vs MylesNet" },
      { href: "/resources/free-isp-billing-software", label: "Free ISP billing software guide" },
      { href: "/resources/how-it-works", label: "How MylesNet works" },
    ],
  },
  {
    slug: "mikhmon",
    name: "Mikhmon",
    kind: "Desktop tool for managing MikroTik hotspot users",
    tagline: "A simple, offline hotspot user manager for one router at a time.",
    summary:
      "Mikhmon is a widely used Windows utility for managing MikroTik hotspot users and vouchers — simple, offline, and free. This page compares it honestly with MylesNet for operators who have outgrown one router.",
    whatItIs:
      "Mikhmon (short for MikroTik Hotspot Monitor) is a desktop application that connects to MikroTik routers over their API and manages hotspot users, expiry dates, and voucher batches directly on the device. It is loved because it is simple: install it, point it at a router, and give people logins and vouchers. It is limited in the same way — it manages users on a single router's hotspot, with no subscriber records, no payments flow, no reporting, and nothing beyond that one box.",
    whereItWins: [
      "Genuinely simple — an afternoon is enough to learn it.",
      "Works offline against the router's own database; no server or hosting needed.",
      "Free and actively used across the region, so help is plentiful in local groups.",
      "Perfectly adequate for a single hotspot with a handful of voucher users.",
    ],
    whereItStrains: [
      "One router at a time — grow past a single box and there is no unified records layer.",
      "Windows desktop dependency: someone must run the PC, and the tool must reach the router.",
      "No subscriber accounts, no payments, no reconciliation, no revenue reports.",
      "Voucher and user data live on the router, where a reset or replacement means rebuilding by hand.",
    ],
    howWeCompare: [
      {
        title: "Scope",
        body: "Mikhmon manages hotspot users on one router. MylesNet manages customers, packages, payments, and network operations across the whole network — the hotspot is one surface of it.",
      },
      {
        title: "Records",
        body: "Mikhmon's truth lives on the device. MylesNet keeps one account record per customer so a renewal, a reconnection, and a dispute always start from the same facts.",
      },
      {
        title: "Money",
        body: "Mikhmon cannot take or reconcile a payment. MylesNet's billing layer is built for payments to post and match — with mobile-money posting specified on the roadmap.",
      },
      {
        title: "The growth path",
        body: "A single hotspot can run on Mikhmon for a long time. The moment there are several hotspots, or subscribers who expect a bill and a receipt, the platform comparison starts to decide itself.",
      },
    ],
    verdict:
      "For one hotspot running vouchers by hand, Mikhmon still does its job and does it free. For an operator with several sites, paying subscribers, and a need to see revenue — which is most networks that have grown — the records layer it lacks is exactly what MylesNet is built to be.",
    related: [
      { href: "/resources/captive-portal-hotspot-guide", label: "Captive portal & hotspot guide" },
      { href: "/resources/mikrotik-router-monitoring", label: "MikroTik router monitoring guide" },
      { href: "/solutions/market-hotspots", label: "Market & hotspot operators solution" },
    ],
  },
  {
    slug: "phpnuxbill",
    name: "PHPNuxBill",
    kind: "Open-source ISP billing system with MikroTik integration",
    tagline: "The closest free cousin — web billing plus MikroTik, self-hosted and community-run.",
    summary:
      "PHPNuxBill is an open-source ISP billing system with MikroTik integration — free, web-based, and popular across the region. This page compares it honestly with MylesNet: the same problem, solved with very different trade-offs.",
    whatItIs:
      "PHPNuxBill is an open-source web application that manages ISP customers, packages, invoicing, and MikroTik integration, often bundled as a complete self-hosted stack. It is the most direct free alternative to what MylesNet does, and it is genuinely capable: customers, plans, vouchers, and router provisioning in one install. Its trade-offs are the classic ones for self-hosted open source — you own the server, the upgrades, the security, and the integrations, and the payment rails that matter to East African operators are community-contributed rather than first-class.",
    whereItWins: [
      "Free, open-source, and self-hosted — full control over your data and your server.",
      "Customers, packages, vouchers, and MikroTik provisioning in one web UI.",
      "An active community across the region with plenty of local experience (often in groups you already follow).",
      "No recurring fee — the licence is free even at large scale.",
    ],
    whereItStrains: [
      "Self-hosting forever: PHP, the database, upgrades, backups, and security are your problem.",
      "Payment rails like M-Pesa, Airtel Money, and bank integration depend on community plugins you must vet, patch, and maintain as the rails change.",
      "Support is a forum, not a commitment — when billing breaks on a Friday, there is no one to call.",
      "Router and RADIUS integration depth varies with the project's roadmap, not with your operation's.",
    ],
    howWeCompare: [
      {
        title: "The same starting point",
        body: "MylesNet exists because operators we met had built or tried exactly this stack — an open-source billing UI wired to MikroTik. The problems were never the licence; they were the upkeep, the payment rails, and the support.",
      },
      {
        title: "Payments as a first-class surface",
        body: "For East African operators the money moves by M-Pesa and Airtel Money. MylesNet's roadmap sequences those posting rails directly; a PHPNuxBill deployment depends on community-maintained plugins that you own the maintenance of.",
      },
      {
        title: "Upkeep versus running",
        body: "PHPNuxBill asks your team to run a server as part of the job. MylesNet is a hosted platform designed so a small team runs the ISP, not the billing software.",
      },
      {
        title: "The rest of the operation",
        body: "Beyond billing, MylesNet covers customer management, network operations, and reporting in one workspace — the layer a self-hosted billing system leaves for other tools to fill.",
      },
    ],
    verdict:
      "PHPNuxBill is the right free choice when your team wants to own the stack and has the hours to run it. The comparison that matters is not licence cost — it is whether the operation grows smoothly when the payments, the routers, and the support demand more than a community project can give.",
    related: [
      { href: "/resources/free-isp-billing-software", label: "Free ISP billing software guide" },
      { href: "/resources/internet-billing-system", label: "Internet billing systems guide" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return comparisons.find((comparison) => comparison.slug === slug);
}