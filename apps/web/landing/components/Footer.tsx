import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Mail, MapPin } from "lucide-react";
import logo from "../assets/logo.png";
import { MYLESCORP_SOCIAL_LINKS, getCompanyContact } from "../content/contact";
import { MYLESCORP, MYLESNET_STORY } from "../content/company";
import { FOOTER_COLUMNS, FOOTER_LEGAL_LINKS } from "../content/navigation";
import { Button } from "@/shared/ui/button";
import LandingCard from "./LandingCard";
import { SocialIcon } from "./SocialIcons";

const SOCIAL_ITEMS: { key: keyof typeof MYLESCORP_SOCIAL_LINKS; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "Twitter" },
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

export default function Footer() {
  const contact = getCompanyContact();
  const emailHref = contact.salesEmail ? `mailto:${contact.salesEmail}` : "/contact";

  /* Two-tone tagline: everything up to the first comma reads in the body ink
     colour, the clause after it in the brand accent (both flip with theme). */
  const tagline = MYLESNET_STORY.tagline;
  const commaAt = tagline.indexOf(",");

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        {/* One card holds the whole footer — masthead, sitemap, legal bar. */}
        <LandingCard className="landing-footer-card">
          {/*
            Masthead on two explicit grid rules: [logo + CTA pair] over the
            two-tone tagline on the left, [social row] over the contact chips on
            the right — every element shares a real baseline, the CTAs sit on the
            logo's own line, and the right-hand group stays clear of the floating
            WhatsApp button at the viewport edge.
          */}
          <div className="landing-footer-masthead">
            <div className="landing-footer-head">
              <Link className="landing-brand" href="/" aria-label="MylesNet home">
                <Image className="landing-logo" src={logo} alt="" width={48} height={48} />
                <span className="landing-brand-name">MylesNet</span>
              </Link>

              <div className="landing-footer-actions">
                <Button asChild>
                  <Link href="/get-started">
                    Get started
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Talk to sales</Link>
                </Button>
              </div>
            </div>

            <div className="landing-footer-text">
              <p className="landing-footer-tagline">
                {commaAt === -1 ? (
                  tagline
                ) : (
                  <>
                    <span className="landing-footer-tagline-lead">{tagline.slice(0, commaAt)}</span>
                    <span className="landing-footer-tagline-accent">{tagline.slice(commaAt)}</span>
                  </>
                )}
              </p>
            </div>

            <nav className="landing-footer-social" aria-label="MylesNet on social media">
              {SOCIAL_ITEMS.map(({ key, label }) => (
                <a
                  key={key}
                  className="landing-footer-social-link"
                  href={MYLESCORP_SOCIAL_LINKS[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <SocialIcon name={key} />
                </a>
              ))}
            </nav>

            <ul className="landing-footer-meta">
              <li>
                <MapPin aria-hidden="true" />
                <span>{MYLESCORP.location}</span>
              </li>
              <li>
                <Mail aria-hidden="true" />
                <a href={emailHref}>
                  {contact.salesEmail ?? "Contact the team"}
                </a>
              </li>
            </ul>
          </div>

          <div className="landing-footer-top">
            {FOOTER_COLUMNS.map((column) => (
              <div className="landing-footer-column" key={column.heading}>
                <h3>{column.heading}</h3>
                <nav className="landing-footer-nav" aria-label={`${column.heading} links`}>
                  {column.links.map((link) => (
                    <Link key={link.href} className="landing-footer-link" href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copy">
              © 2026 Powered by{" "}
              <a href={MYLESCORP.website} target="_blank" rel="noopener noreferrer">
                {MYLESCORP.legalName}
              </a>{" "}
              · All rights reserved.
            </p>
            <nav className="landing-footer-legal" aria-label="Legal">
              {FOOTER_LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </LandingCard>
      </div>
    </footer>
  );
}
