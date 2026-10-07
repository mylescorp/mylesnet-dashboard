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

type AddressKind = "loopback" | "link-local" | "private" | "public" | "unknown";

/** Classify IPv4 and IPv6 addresses the way an operator would. */
const classifyAddress = (value: string | null): AddressKind => {
  if (!value) return "unknown";
  const addr = value.toLowerCase().split("%")[0]; // strip any zone id

  // IPv4-mapped IPv6 (::ffff:1.2.3.4) classifies as its IPv4 address.
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return classifyAddress(mapped[1]);

  if (!addr.includes(":")) {
    if (addr.startsWith("127.")) return "loopback";
    if (addr.startsWith("169.254.")) return "link-local";
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(addr))
      return "private";
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(addr)) return "public";
    return "unknown";
  }

  if (addr === "::1") return "loopback";
  if (addr === "::") return "unknown";
  if (addr.startsWith("fe80:")) return "link-local";
  if (addr.startsWith("fc") || addr.startsWith("fd")) return "private"; // ULA fc00::/7
  return "public";
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

  // Determine connection context for the guidance section.
  const addressKind = classifyAddress(ip);
  const isPrivateRange =
    addressKind === "private" ||
    addressKind === "link-local" ||
    addressKind === "loopback";
  const isV6 = ip?.includes(":") ?? false;
  const hasMultipleForwards = forwarded && forwarded.split(",").length > 1;
  const looksLikeCgnat =
    ip !== null && addressKind === "public" && hasMultipleForwards;

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
                title={
                  addressKind === "loopback"
                    ? "Loopback address"
                    : addressKind === "link-local"
                      ? "Link-local address"
                      : addressKind === "private"
                        ? "Private / LAN address"
                        : addressKind === "public"
                          ? "Public address"
                          : "Address unavailable"
                }
                body={
                  addressKind === "loopback"
                    ? "The request never left this machine — the server saw a loopback address (localhost), which is what happens when you run the site locally or behind a local proxy."
                    : addressKind === "link-local"
                      ? "An automatically assigned address (169.254.0.0/16 or fe80::/10) that only works on the local network segment. It is never routed."
                      : addressKind === "private"
                        ? "This IP is from a private range (RFC 1918 or an IPv6 ULA). You are likely behind a NAT — the address above is your local side, not what the internet sees."
                        : addressKind === "public"
                          ? "This is a publicly routable address. It can be reached directly from the internet unless firewalled."
                          : "No address could be read from this request."
                }
              />
              <LandingCard
                icon={looksLikeCgnat ? <Wifi size={20} aria-hidden="true" /> : <Globe size={20} aria-hidden="true" />}
                title={
                  looksLikeCgnat
                    ? "Likely carrier-grade NAT"
                    : isPrivateRange
                      ? "Behind NAT"
                      : "Direct or ISP NAT"
                }
                body={
                  looksLikeCgnat
                    ? "Multiple addresses in X-Forwarded-For suggest you are behind carrier-grade NAT (common on mobile networks). Many subscribers share one public IP."
                    : isPrivateRange
                      ? "Carrier-grade NAT does not apply to a local address — the translation happens on your own router or upstream, one hop at a time."
                      : "No carrier-grade NAT detected in the forwarding chain. Your ISP likely assigns a unique public IP per connection."
                }
              />
              <LandingCard
                icon={<Network size={20} aria-hidden="true" />}
                title="IPv6"
                body={
                  isV6
                    ? "The address above is IPv6. Modern destinations may reach you here even when IPv4 still works — firewall and allow-list rules should cover both."
                    : "The address above is IPv4. If your network also has IPv6, destinations may reach you over a different address — check your router status for the IPv6 prefix."
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