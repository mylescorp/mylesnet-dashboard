import type { Metadata, Viewport } from "next";
import "./landing.css";
import Header from "@/landing/components/Header";
import Footer from "@/landing/components/Footer";
import JsonLd from "@/landing/components/JsonLd";
import { MYLESCORP_SOCIAL_LINKS } from "@/landing/content/contact";
import { SITE_URL } from "@/landing/content/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MylesNet — ISP Operations Platform for East Africa",
    template: "%s | MylesNet",
  },
  description:
    "MylesNet is the operations platform for East African internet service providers, WISPs, estates, hospitality operators, and community networks — customers, packages, payments, and network operations in one place.",
  applicationName: "MylesNet",
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "/",
    siteName: "MylesNet",
    title: "MylesNet — ISP Operations Platform for East Africa",
    description:
      "Customers, packages, payments, and network operations for East African ISPs, estates, hospitality, and community networks.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MylesNet",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  parentOrganization: {
    "@type": "Organization",
    name: "MylesCorp Technologies Ltd",
    url: "https://mylescorptech.com/",
  },
  sameAs: Object.values(MYLESCORP_SOCIAL_LINKS),
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <Header />
      <main className="landing-main">{children}</main>
      <Footer />
    </>
  );
}
