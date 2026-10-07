import { headers } from "next/headers";
import { ArrowUpRight, LayoutDashboard, Globe, Shield, Wifi, Cpu, Network } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import IpDisplay, { type IpField } from "@/landing/components/IpDisplay";

export const metadata = pageMetadata(
  "What is my IP",
  "Your public IP address as this site sees it, plus the coarse location our hosting edge reports.",
  { canonical: "/what-is-my-ip" }
);

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  UG: "Uganda",
  TZ: "Tanzania",
  RW: "Rwanda",
  BI: "Burundi",
  ET: "Ethiopia",
  GH: "Ghana",
  NG: "Nigeria",
  ZA: "South Africa",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IN: "India",
};

const ISP_HINTS: Record<string, string> = {
  safaricom: "Safaricom",
  airtel: "Airtel",
  "telkom kenya": "Telkom Kenya",
  "faiba": "Faiba",
  "liquid telecom": "Liquid Telecom",
  "jamii": "Jamii Telecommunications",
  "poa": "Poa! Internet",
  "mtn": "MTN",
  "vodacom": "Vodacom",
  "zuku": "Zuku",
  "wifib": "Wifib",
  "simb": "Simbanet",
  "accesskenya": "Access Kenya",
  "wananchi": "Wananchi Group",
};

const detectIsp = (ip: string | null, forwarded: string | null, reverseDns: string | null): string | null => {
  const haystack = `${ip ?? ""} ${forwarded ?? ""} ${reverseDns ?? ""}`.toLowerCase();
  for (const [key, name] of Object.entries(ISP_HINTS)) {
    if (haystack.includes(key)) return name;
  }
  return null;
};

const formatAsn = (asn: string | null): string | null => {
  if (!asn) return null;
  const match = asn.match(/^AS(\d+)\s+(.+)$/i);
  if (match) return `AS${match[1]} — ${match[2]}`;
  return asn;
};

/** Percent-encoded edge values arrive URL-escaped; anything else passes through. */
const decode = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default async function WhatIsMyIpPage() {
  const headerStore = await headers();

  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || null;

  const city = decode(headerStore.get("x-vercel-ip-city"));
  const region =
    decode(headerStore.get("x-vercel-ip-region")) ??
    decode(headerStore.get("x-vercel-ip-country-region"));
  const countryCode = headerStore.get("x-vercel-ip-country");
  const country = countryCode
    ? (COUNTRY_NAMES[countryCode.toUpperCase()] ?? countryCode.toUpperCase())
    : null;
  const timezone = headerStore.get("x-vercel-ip-timezone");

  // These headers may not be present depending on Vercel config / deployment
  const asn = headerStore.get("x-vercel-ip-asn") ?? headerStore.get("x-vercel-ip-as-number") ?? null;
  const asnOrg = headerStore.get("x-vercel-ip-as-org") ?? null;

  const fields: IpField[] = [
    { label: "IP address", value: ip },
    { label: "City", value: city },
    { label: "Region", value: region },
    { label: "Country", value: country },
    { label: "Timezone", value: timezone },
    { label: "ASN / ISP", value: formatAsn(asn) ?? formatAsn(asnOrg) ?? detectIsp(ip, forwarded, null) },
    { label: "Forwarded for", value: forwarded },
  ];

  // Determine connection context for the guidance section
  const isPrivateRange = ip?.match(
    /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/
  );
  const hasMultipleForwards = forwarded && forwarded.split(",").length > 1;
  const looksLikeCgnat = ip && !isPrivateRange && hasMultipleForwards;

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Free tools"
            title="What is my IP?"
            body={
              <>
                Your public address as this site sees it, with the coarse location our hosting
                edge reports. Read straight off the request — not looked up, not stored.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <IpDisplay fields={fields} />

          <div className="landing-prose landing-prose-spaced">
            <p>
              Some fields show a dash when the network you are on does not report them —
              privacy-focused browsers, proxies, and self-hosted deployments all withhold
              location. The address itself is what every server you visit already receives.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Connection context</h2>
            <div className="landing-grid" style={{ marginTop: "var(--space-4)" }}>
              <LandingCard
                icon={<Shield size={20} aria-hidden="true" />}
                title={isPrivateRange ? "Private / LAN address" : "Public address"}
                body={
                  isPrivateRange
                    ? "This IP is from a private range (RFC 1918). You are likely behind a NAT — the address above is what the internet sees, not your local LAN address."
                    : "This is a publicly routable IPv4 address. It can be reached directly from the internet unless firewalled."
                }
              />
              <LandingCard
                icon={looksLikeCgnat ? <Wifi size={20} aria-hidden="true" /> : <Globe size={20} aria-hidden="true" />}
                title={looksLikeCgnat ? "Likely carrier-grade NAT" : "Direct or ISP NAT"}
                body={
                  looksLikeCgnat
                    ? "Multiple addresses in X-Forwarded-For suggest you are behind carrier-grade NAT (common on mobile networks). Many subscribers share one public IP."
                    : "No carrier-grade NAT detected in the forwarding chain. Your ISP likely assigns a unique public IP per connection."
                }
              />
              <LandingCard
                icon={<Network size={20} aria-hidden="true" />}
                title="IPv6"
                body={
                  "This tool shows IPv4 only. If your network supports IPv6, the address above may not be the one used for modern destinations — check your router status for the IPv6 prefix."
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Why an operator asks for this</h2>
            <p>
              A public address is how you are reached. Home and small-office connections usually
              get a different one each time the router reconnects, so an address you saw this
              morning may be someone else&apos;s by tonight. Mobile networks go further: many
              subscribers share one public address through carrier-grade NAT, which is why the
              answer sometimes looks nothing like your neighbour&apos;s.
            </p>
            <p>
              On your own network, the address matters for exactly three things: firewall rules
              that only trust you, a VPN that only accepts you, and a support ticket where the
              engineer needs to know which address your equipment appeared from. Everything
              else — coverage, billing, sessions — is handled by your ISP, not by it.
            </p>
            <p>
              If the address here surprises you, check the router&apos;s WAN status page before
              anything else. It answers the same question from the other side, and comparing the
              two tells you whether the difference is at home or upstream.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Common scenarios for ISP operators</h2>
            <div className="landing-grid" style={{ marginTop: "var(--space-4)" }}>
              <LandingCard
                icon={<Shield size={20} aria-hidden="true" />}
                title="Firewall allow-lists"
                body="Only the public IP above (or your static block) should be permitted on management ports — SSH, WinBox, API, RADIUS secret."
              />
              <LandingCard
                icon={<Cpu size={20} aria-hidden="true" />}
                title="VPN / tunnel endpoints"
                body="WireGuard, OpenVPN, or IPsec peers need the remote public IP. If it changes, use DDNS or a script that updates the peer on reconnect."
              />
              <LandingCard
                icon={<Wifi size={20} aria-hidden="true" />}
                title="Subscriber troubleshooting"
                body="When a customer says 'internet down', compare their router's WAN IP with this page. Mismatch = CGNAT / double-NAT / wrong router in bridge mode."
              />
              <LandingCard
                icon={<Globe size={20} aria-hidden="true" />}
                title="Geo-IP & compliance"
                body="Payment processors and some content providers block by country. The coarse location above is what they see — not necessarily the subscriber's physical address."
              />
            </div>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Free tools"
        title="From an address to a network"
        subtitle="The address is one line — the platform is where every subscriber, session, and payment sits behind one."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources/mikrotik-radius-operations",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "MikroTik & RADIUS",
            body: "Health checks, configuration backups, and the AAA upgrade path.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}