/**
 * Single source of truth for public-site navigation.
 *
 * Both the header dropdowns and the footer sitemap are derived from these
 * lists, so a new public route is added in one place. Feature, solution, and
 * guide slugs are read from the existing content modules rather than being
 * duplicated as literals.
 */
import { features, solutions } from "./pages";
import { resourceItems, type ResourceItem } from "./resources";

export type NavChild = {
  href: string;
  label: string;
  /** Optional one-line summary shown in the desktop dropdown. */
  description?: string;
};

/**
 * One titled column of a desktop dropdown. Centipid's Resources panel stacks
 * its links under three small headings ("Free tools", "Learn", "Guides") and
 * closes with a chip strip; a section that supplies `groups`/`aside` renders
 * that shape, otherwise the header falls back to an even split.
 */
export type NavGroup = {
  title: string;
  children: NavChild[];
};

export type NavSection = {
  href: string;
  label: string;
  children?: NavChild[];
  /** Titled columns for the desktop dropdown. */
  groups?: NavGroup[];
  /** Chip strip along the foot of the desktop dropdown panel. */
  aside?: NavChild[];
};

const featureChildren: NavChild[] = features.map((feature) => ({
  href: `/features/${feature.slug}`,
  label: feature.title,
  description: feature.tagline,
}));

const solutionChildren: NavChild[] = solutions.map((solution) => ({
  href: `/solutions/${solution.slug}`,
  label: solution.title,
  description: solution.tagline,
}));

const toNavChild = (item: ResourceItem): NavChild => ({
  href: item.href as string,
  label: item.title,
  description: item.summary ?? item.description,
});

const availableResources = resourceItems.filter(
  (item) => item.status === "available" && item.href
);

const inMeta = (item: ResourceItem, meta: string) => item.meta === meta;

/**
 * The two nav-only columns of the Resources panel, in Centipid's shape.
 * Free tools holds the utilities that need no account; Learn holds the
 * standing publishing surfaces. Both are plain lists so a route change is
 * a one-line edit here.
 */
const toolChildren: NavChild[] = [
  {
    href: "/speedtest",
    label: "Speed test",
    description: "Download, upload, ping and jitter in one run",
  },
  {
    href: "/what-is-my-ip",
    label: "What is my IP",
    description: "Your public address and who it belongs to",
  },
  {
    href: "/bandwidth-calculator",
    label: "Bandwidth calculator",
    description: "Transfer time, capacity and required speed",
  },
  {
    href: "/subnet-calculator",
    label: "Subnet calculator",
    description: "IPv4 networks, ranges and host counts",
  },
  {
    href: "/demo",
    label: "Live demo",
    description: "A guided tour of the operator console",
  },
];

const learnChildren: NavChild[] = [
  {
    href: "/docs",
    label: "Documentation",
    description: "Setup guides for every part of the platform",
  },
  {
    href: "/academy",
    label: "Academy",
    description: "Practical ISP lessons, free to read",
  },
  {
    href: "/blog",
    label: "Blog",
    description: "Billing, MikroTik and payments, explained",
  },
  {
    href: "/changelog",
    label: "Changelog",
    description: "What shipped in MylesNet, update by update",
  },
];

/**
 * The Resources panel, laid out like Centipid's: titled columns with the
 * tool and publishing links first, then the resource catalogue by kind, so
 * a new guide lands in the right column without anyone editing the
 * navigation. Column order follows Centipid — Free tools, Learn, Guides —
 * and the rest of the catalogue closes the panel as one column.
 */
const resourceGroups: NavGroup[] = [
  { title: "Free tools", children: toolChildren },
  { title: "Learn", children: learnChildren },
  {
    title: "Guides",
    children: availableResources.filter((item) => inMeta(item, "Guide")).map(toNavChild),
  },
  {
    title: "Playbooks & reference",
    children: availableResources
      .filter((item) => !inMeta(item, "Guide"))
      .map(toNavChild),
  },
];

/**
 * Flat link list: the footer column and the mobile sheet read this, and it
 * keeps every destination in the panel reachable as one list, the way
 * Centipid's drawer does.
 */
const resourceChildren: NavChild[] = resourceGroups.flatMap((group) => group.children);

/**
 * The strip Centipid closes its Resources panel with (Integrations, Contact,
 * Affiliates, Shop, Book a call), mapped onto the MylesNet routes that play
 * the same part. It rides along in `children` too, so the mobile sheet lists
 * the same flat list Centipid's drawer shows.
 */
const resourceAside: NavChild[] = [
  { href: "/integrations", label: "Integrations" },
  { href: "/contact", label: "Contact" },
  { href: "/become-an-affiliate", label: "Affiliates" },
  { href: "/shop", label: "Shop" },
  { href: "/book-a-call", label: "Book a call" },
];

/**
 * Everything attached to the Company section: one source for the header
 * dropdown, the footer sitemap column, and the `/company` index cards, so the
 * three can never drift apart. Descriptions are condensed from each page's own
 * metadata description.
 */
export const companyChildren: NavChild[] = [
  {
    href: "/company/about",
    label: "About",
    description: "The story, leadership, and values behind MylesNet.",
  },
  {
    href: "/company/mylescorp",
    label: "MylesCorp",
    description: "The parent company and what it builds beyond the platform.",
  },
  {
    href: "/customers",
    label: "Customers",
    description: "Where the platform stands today, and how early operators work with us.",
  },
  {
    href: "/get-started",
    label: "Get started",
    description: "Tell us about your network and find the right starting point.",
  },
  {
    href: "/contact",
    label: "Contact",
    description: "Sales, product information, and technical support from the team.",
  },
];

/**
 * The billing tools an operator is likely comparing us with, surfaced in the
 * footer sitemap and cross-linked from every /vs page so the comparison
 * cluster stays discoverable without a header slot.
 */
export const comparisonChildren: NavChild[] = [
  { href: "/vs/freeradius", label: "FreeRADIUS vs MylesNet" },
  { href: "/vs/daloradius", label: "daloRADIUS vs MylesNet" },
  { href: "/vs/mikhmon", label: "Mikhmon vs MylesNet" },
  { href: "/vs/phpnuxbill", label: "PHPNuxBill vs MylesNet" },
];

/**
 * The country guides, led by the markets the affiliate programme serves so
 * the footer list and the programme's market list cannot drift apart.
 */
export const countryChildren: NavChild[] = [
  { href: "/country", label: "All countries" },
  { href: "/country/kenya", label: "Kenya" },
  { href: "/country/uganda", label: "Uganda" },
  { href: "/country/tanzania", label: "Tanzania" },
  { href: "/country/rwanda", label: "Rwanda" },
  { href: "/country/ethiopia", label: "Ethiopia" },
];

/**
 * Header navigation. The middle track is what is left of a fixed container
 * after the brand and the CTA cluster, so top-level entries compete for one
 * gap: entries that carry their own footer column (Contact) live in a dropdown
 * instead of taking a slot of their own.
 */
export const NAV_SECTIONS: NavSection[] = [
  { href: "/product", label: "Product" },
  { href: "/features", label: "Features", children: featureChildren },
  { href: "/solutions", label: "Solutions", children: solutionChildren },
  { href: "/pricing", label: "Pricing" },
  { href: "/integrations", label: "Integrations" },
  { href: "/resources", label: "Resources", children: [...resourceChildren, ...resourceAside], groups: resourceGroups, aside: resourceAside },
  { href: "/security", label: "Security" },
  { href: "/company", label: "Company", children: companyChildren },
];

export type FooterColumn = {
  heading: string;
  links: NavChild[];
};

/**
 * The footer is a curated sitemap, not a full mirror of the header dropdowns.
 * Every index page stays linked (All features, All solutions, All resources)
 * so nothing becomes unreachable; per-item children are capped so the four
 * columns stay balanced and scannable.
 */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { href: "/product", label: "Product overview" },
      { href: "/features", label: "All features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/integrations", label: "Integrations" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    heading: "Solutions",
    links: [{ href: "/solutions", label: "All solutions" }, ...solutionChildren],
  },
  {
    heading: "Resources",
    links: [
      { href: "/resources", label: "All resources" },
      { href: "/blog", label: "Blog" },
      { href: "/changelog", label: "Changelog" },
      ...availableResources
        .filter((item) => inMeta(item, "Guide"))
        .slice(0, 3)
        .map(toNavChild),
    ],
  },
  {
    heading: "Company",
    links: companyChildren,
  },
  {
    heading: "Tools",
    links: [
      { href: "/speedtest", label: "Speed test" },
      { href: "/what-is-my-ip", label: "What is my IP" },
      { href: "/bandwidth-calculator", label: "Bandwidth calculator" },
      { href: "/subnet-calculator", label: "Subnet calculator" },
      { href: "/demo", label: "Live demo" },
    ],
  },
  {
    heading: "Compare",
    links: comparisonChildren,
  },
  {
    heading: "Countries",
    links: countryChildren,
  },
];

/** Legal links sit in the footer bottom bar, not in a sitemap column. */
export const FOOTER_LEGAL_LINKS: NavChild[] = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/affiliate-policy", label: "Affiliate policy" },
];

/** Flat list of every internal route linked from the public chrome. */
export const ALL_PUBLIC_ROUTES: string[] = Array.from(
  new Set([
    "/",
    ...NAV_SECTIONS.map((section) => section.href),
    ...NAV_SECTIONS.flatMap((section) =>
      (section.children ?? []).map((child) => child.href)
    ),
    ...FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href)),
    ...FOOTER_LEGAL_LINKS.map((link) => link.href),
  ])
);
