import { ArrowUpRight, Network } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import SubnetCalculatorTool from "@/landing/components/SubnetCalculatorTool";

export const metadata = pageMetadata(
  "Subnet calculator",
  "IPv4 CIDR subnet calculator — network, usable range, netmask, and host counts for ISP operators. Nothing you type leaves your browser.",
  { canonical: "/subnet-calculator" }
);

export default function SubnetCalculatorPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Free tools"
            title="Subnet calculator"
            body={
              <>
                Turn a CIDR like 192.168.88.0/24 into the network, usable range,
                mask, and host count — and size a pool for the hosts you actually have.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SubnetCalculatorTool />
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Why operators reach for this</h2>
            <p>
              <strong>Hotspot and PPPoE pools:</strong> every subscriber on a MikroTik hotspot
              or PPPoE server draws an address from a pool. Sizing the pool wrong means
              renewals fail on a busy Friday — the calculator shows the exact usable count
              before you configure the device.
            </p>
            <p>
              <strong>VLAN planning:</strong> estates and apartment buildings commonly split
              traffic per block or per service. Working out how many /29s or /30s fit a
              building&apos;s allocation is arithmetic, and it is exactly the arithmetic here.
            </p>
            <p>
              <strong>Catch the typo before it ships:</strong> a mis-typed mask turns a small
              pool into a /8 spanning the whole country. Reading the network and usable range
              out loud is how a config error gets caught at the desk, not at the tower.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Free tools"
        title="From an address plan to a running network"
        subtitle="The pool is one line of a router config — the platform is where addresses, sessions, and subscribers meet."
        items={[
          {
            href: "/resources/mikrotik-radius-operations",
            icon: <Network size={19} aria-hidden="true" />,
            title: "MikroTik & RADIUS",
            body: "Health checks, configuration backups, and the AAA upgrade path.",
            action: "Read the guide",
          },
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}