export type ModuleStatus = "Available" | "Beta" | "Planned";

export type ProductModule = {
  slug: string;
  icon: string;
  title: string;
  summary: string;
  status: ModuleStatus;
  note?: string;
  href?: string;
  cta?: string;
};

export const moduleStatusLegend: { status: ModuleStatus; meaning: string }[] = [
  { status: "Available", meaning: "In production today." },
  { status: "Beta", meaning: "Live in controlled operator pilots — minor changes expected." },
  { status: "Planned", meaning: "Specified and sequenced on the roadmap." },
];

export const productModules: ProductModule[] = [
  {
    slug: "network-operations",
    icon: "Server",
    title: "Network operations",
    summary: "Router health, telemetry, configuration backups, and session visibility.",
    status: "Available",
    note: "Shipping today — the operator's daily network view.",
    href: "/features/network-operations",
  },
  {
    slug: "api-webhooks",
    icon: "Zap",
    title: "API & webhooks",
    summary: "REST API and event webhooks to connect the records you already run.",
    status: "Available",
    note: "Included with the Pro plan.",
    href: "/integrations",
  },
  {
    slug: "customer-management",
    icon: "Users",
    title: "Customer management",
    summary: "Central subscriber records, services, and credentials on one timeline.",
    status: "Beta",
    href: "/features/customer-management",
  },
  {
    slug: "packages-vouchers",
    icon: "Gift",
    title: "Packages & vouchers",
    summary: "Plans, packages, vouchers, QR sales, and free trials.",
    status: "Beta",
    href: "/features/packages-vouchers",
  },
  {
    slug: "payments-finance",
    icon: "CreditCard",
    title: "Payments & finance",
    summary: "Verified payments, invoices, billing, and the financial ledger.",
    status: "Beta",
    href: "/features/payments-finance",
  },
  {
    slug: "support-communications",
    icon: "LifeBuoy",
    title: "Support & communications",
    summary: "Tickets, notifications, and messaging across the customer journey.",
    status: "Beta",
    href: "/features/support-communications",
  },
  {
    slug: "analytics-reporting",
    icon: "TrendingUp",
    title: "Analytics & reporting",
    summary: "Revenue, MRR, ARPU, churn, and overdue views.",
    status: "Beta",
    href: "/features/payments-finance",
  },
  {
    slug: "captive-portal-hotspot",
    icon: "Store",
    title: "Captive portal & hotspot",
    summary: "Splash pages, self-service registration, and hotspot commerce.",
    status: "Planned",
    note: "Spec approved. Build starts on the owner milestone; the operator-configured portal lives in the dashboard.",
    href: "/resources/captive-portal-hotspot-guide",
    cta: "Read the guide",
  },
  {
    slug: "customer-portal",
    icon: "LayoutDashboard",
    title: "Customer portal",
    summary: "A self-service portal for customers — usage, invoices, payments, and support.",
    status: "Planned",
    href: "/customers",
    cta: "See on the roadmap",
  },
  {
    slug: "mobile-apps",
    icon: "Activity",
    title: "Mobile apps",
    summary: "Customer and technician mobile apps for the field and on the go.",
    status: "Planned",
    href: "/customers",
    cta: "See on the roadmap",
  },
  {
    slug: "field-service-inventory",
    icon: "Wifi",
    title: "Field service & inventory",
    summary: "Work orders, technician flows, and spare inventory.",
    status: "Planned",
    href: "/customers",
    cta: "See on the roadmap",
  },
];