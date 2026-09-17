"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import logo from "../assets/logo.png";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/integrations", label: "Integrations" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="landing-header">
      <nav className="landing-nav landing-container" aria-label="Main navigation">
        <Link className="landing-brand" href="/" aria-label="MylesNet home">
          <Image className="landing-logo" src={logo} alt="" width={48} height={48} priority />
          <span className="landing-brand-name">MylesNet</span>
        </Link>

        <div className="landing-nav-links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              className="landing-nav-link"
              href={link.href}
              data-active={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "true" : undefined}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="landing-nav-cta">
          <ThemeToggle className="landing-theme-toggle" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="landing-nav-toggle"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-8" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  className="text-lg font-medium hover:text-primary transition-colors"
                  href={link.href}
                  data-active={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "true" : undefined}
                  onClick={() => setMenuOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <div className="landing-mobile-theme-row">
                <ThemeToggle className="landing-theme-toggle" />
                <Button asChild variant="ghost" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Link href="/signin">Sign in</Link>
                </Button>
                <Button asChild variant="default" className="flex-1" onClick={() => setMenuOpen(false)}>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
