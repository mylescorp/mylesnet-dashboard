"use client";

import { usePathname } from "next/navigation";
import LandingImagePanel from "@/landing/components/LandingImagePanel";

type RouteVisual = {
  src: string;
  alt: string;
  label: string;
};

const ROUTE_VISUALS: Array<[string, RouteVisual]> = [
  ["/features/customer-management", { src: "/images/landing/wireless-router-desk-unsplash.jpg", alt: "Wireless router connected on a desk", label: "Customer management" }],
  ["/features/packages-vouchers", { src: "/images/landing/network-cables-unsplash.jpg", alt: "Connected network switch ports", label: "Packages and vouchers" }],
  ["/features/payments-finance", { src: "/images/landing/server-rows-unsplash.jpg", alt: "Rows of server racks in a data centre", label: "Payments and finance" }],
  ["/features/network-operations", { src: "/images/landing/telecom-tower-antennas-unsplash.jpg", alt: "Telecommunications tower with multiple antennas", label: "Network operations" }],
  ["/features/support-communications", { src: "/images/landing/wireless-router-closeup-unsplash.jpg", alt: "Close-up of wireless networking hardware", label: "Support and communications" }],
  ["/resources/billing-and-payments", { src: "/images/landing/network-cables-unsplash.jpg", alt: "Connected network switch ports", label: "Billing and payments" }],
  ["/resources/kenya-payment-automation", { src: "/images/landing/server-rows-unsplash.jpg", alt: "Rows of server racks in a data centre", label: "Payment operations" }],
  ["/resources/network-operations", { src: "/images/landing/server-rack-unsplash.jpg", alt: "Network infrastructure in an equipment room", label: "Network operations" }],
  ["/resources/captive-portal-hotspot-guide", { src: "/images/landing/wireless-router-closeup-unsplash.jpg", alt: "Close-up of wireless networking hardware", label: "Hotspot guide" }],
  ["/resources/wisp-launch-playbook", { src: "/images/landing/telecom-tower-blue-unsplash.jpg", alt: "Telecommunications tower against a blue sky", label: "WISP launch playbook" }],
  ["/resources/estate-network-playbook", { src: "/images/landing/telecom-tower-dusk-unsplash.jpg", alt: "Telecommunications tower at dusk", label: "Estate network playbook" }],
  ["/resources/subscriber-migration-checklist", { src: "/images/landing/wireless-router-desk-unsplash.jpg", alt: "Wireless router connected on a desk", label: "Subscriber migration" }],
  ["/resources/isp-kpi-primer", { src: "/images/landing/server-rows-unsplash.jpg", alt: "Rows of server racks in a data centre", label: "ISP KPI primer" }],
  ["/solutions/market-hotspots", { src: "/images/landing/wireless-router-closeup-unsplash.jpg", alt: "Close-up of wireless networking hardware", label: "Market hotspots" }],
  ["/solutions/estate-networks", { src: "/images/landing/telecom-tower-blue-unsplash.jpg", alt: "Telecommunications tower against a blue sky", label: "Estate networks" }],
  ["/solutions/hospitality", { src: "/images/landing/wireless-router-desk-unsplash.jpg", alt: "Wireless router connected on a desk", label: "Hospitality Wi-Fi" }],
  ["/solutions/community-networks", { src: "/images/landing/telecom-tower-dusk-unsplash.jpg", alt: "Telecommunications tower at dusk", label: "Community networks" }],
  ["/company/mylescorp", { src: "/images/landing/server-rows-unsplash.jpg", alt: "Rows of server racks in a data centre", label: "MylesCorp Technologies Ltd" }],
  ["/company/about", { src: "/images/landing/telecom-tower-blue-unsplash.jpg", alt: "Telecommunications tower against a blue sky", label: "About MylesNet" }],
  ["/contact", { src: "/images/landing/wireless-router-desk-unsplash.jpg", alt: "Wireless router connected on a desk", label: "Talk to MylesNet" }],
  ["/customers", { src: "/images/landing/telecom-tower-dusk-unsplash.jpg", alt: "Telecommunications tower at dusk", label: "Early operators" }],
  ["/features", { src: "/images/landing/wireless-router-closeup-unsplash.jpg", alt: "Close-up of wireless networking hardware", label: "MylesNet capabilities" }],
  ["/get-started", { src: "/images/landing/telecom-tower-antennas-unsplash.jpg", alt: "Telecommunications tower with multiple antennas", label: "Plan your rollout" }],
  ["/legal/privacy", { src: "/images/landing/server-rack-unsplash.jpg", alt: "Network equipment in a secure equipment room", label: "Privacy" }],
  ["/legal/terms", { src: "/images/landing/network-cables-unsplash.jpg", alt: "Connected network switch ports", label: "Terms" }],
  ["/pricing", { src: "/images/landing/server-rows-unsplash.jpg", alt: "Rows of server racks in a data centre", label: "Pricing" }],
  ["/resources", { src: "/images/landing/wireless-router-desk-unsplash.jpg", alt: "Wireless router on a desk", label: "Operator resources" }],
  ["/security", { src: "/images/landing/server-rack-unsplash.jpg", alt: "Network infrastructure in an equipment room", label: "Security and trust" }],
  ["/solutions", { src: "/images/landing/telecom-tower-dusk-unsplash.jpg", alt: "Telecommunications tower at dusk", label: "MylesNet solutions" }],
];

const EMBEDDED_BANNERS = new Set(["/product", "/integrations", "/solutions"]);

export default function LandingRouteVisual() {
  const pathname = usePathname();

  if (pathname === "/" || EMBEDDED_BANNERS.has(pathname)) return null;

  const match = ROUTE_VISUALS.find(([prefix]) => pathname === prefix) ?? ROUTE_VISUALS.find(([prefix]) => pathname.startsWith(`${prefix}/`));
  if (!match) return null;

  const [, visual] = match;
  return <LandingImagePanel className="landing-route-visual" {...visual} />;
}
