import type { Metadata, Viewport } from "next";
import "./landing.css";
import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://mylesnetisp.mylescorptech.com"),
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
    url: "https://mylesnetisp.mylescorptech.com",
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

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="landing-main">{children}</main>
      <Footer />
    </>
  );
}