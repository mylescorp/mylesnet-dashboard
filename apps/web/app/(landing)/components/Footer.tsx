import Link from "next/link";
import Image from "next/image";
import logo from "../assets/logo.png";

export const MYLESCORP_SOCIAL_LINKS = {
  linkedin: "https://www.linkedin.com/company/mylescorptech",
  facebook: "https://www.facebook.com/mylescorptech",
  twitter: "https://www.twitter.com/mylescorptech",
  youtube: "https://www.youtube.com/@mylescorptech",
  instagram: "https://www.instagram.com/mylescorptech",
  tiktok: "https://www.tiktok.com/@mylescorptech",
} as const;

const SOCIAL_ITEMS: { key: keyof typeof MYLESCORP_SOCIAL_LINKS; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "Twitter" },
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

const PLATFORM_LINKS: { href: string; label: string }[] = [
  { href: "/features/customer-management", label: "Features" },
  { href: "/solutions/market-hotspots", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources/how-it-works", label: "How it works" },
];

const COMPANY_LINKS: { href: string; label: string }[] = [
  { href: "/company/about", label: "About" },
  { href: "/get-started", label: "Get started" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
];

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <Image className="landing-logo" src={logo} alt="MylesNet" width={170} height={113} />
            <p>
              The operations platform for East African internet service providers,
              estates, hotspots, and community networks — customers, packages,
              payments, and network operations in one place.
            </p>
          </div>
          <div className="landing-footer-column">
            <h3>Platform</h3>
            <nav className="landing-footer-nav" aria-label="Platform links">
              {PLATFORM_LINKS.map((link) => (
                <Link key={link.href} className="landing-footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="landing-footer-column">
            <h3>Company</h3>
            <nav className="landing-footer-nav" aria-label="Company links">
              {COMPANY_LINKS.map((link) => (
                <Link key={link.href} className="landing-footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <div className="landing-footer-social" aria-label="MylesCorp Technologies Ltd social links">
            {SOCIAL_ITEMS.map(({ key, label }) => (
              <a
                key={key}
                className="landing-footer-social-link"
                href={MYLESCORP_SOCIAL_LINKS[key]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
              </a>
            ))}
          </div>
          <p className="landing-footer-copy">
            © 2026 Powered by{" "}
            <a href="https://mylescorptech.com/" target="_blank" rel="noopener noreferrer">
              MylesCorp Technologies Ltd
            </a>{" "}
            · All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}