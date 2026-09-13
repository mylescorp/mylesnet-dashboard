"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import logo from "../assets/logo.png";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/features/customer-management", label: "Features" },
  { href: "/solutions/market-hotspots", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources/how-it-works", label: "How it works" },
  { href: "/company/about", label: "About" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="landing-header">
      <nav className="landing-nav landing-container" aria-label="Main navigation">
        <Link className="landing-brand" href="/" onClick={() => setMenuOpen(false)}>
          <Image className="landing-logo" src={logo} alt="MylesNet" width={170} height={113} priority />
        </Link>

        <div className="landing-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} className="landing-nav-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="landing-nav-cta">
          <Link className="landing-cta-button" href="/get-started">
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="landing-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {menuOpen ? (
        <div className="landing-mobile-menu" id="landing-mobile-menu">
          <div className="landing-mobile-menu-inner landing-container">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} className="landing-nav-link" href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link className="landing-cta-button" href="/get-started" onClick={() => setMenuOpen(false)}>
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}