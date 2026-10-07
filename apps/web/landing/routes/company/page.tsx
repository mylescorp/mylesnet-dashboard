import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Building2, LayoutDashboard, Mail, Rocket, Users } from "lucide-react";
import { MYLESCORP } from "@/landing/content/company";
import { companyChildren } from "@/landing/content/navigation";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Company",
  "MylesNet is built by MylesCorp Technologies Ltd in Nairobi, Kenya. Find the story behind the platform, the operators using it, and how to reach the team.",
  { canonical: "/company" }
);

/** One mark per attached route, so the index cards read at a glance. */
function companyIcon(href: string): ReactNode {
  switch (href) {
    case "/customers":
      return <Users size={20} aria-hidden="true" />;
    case "/get-started":
      return <Rocket size={20} aria-hidden="true" />;
    case "/contact":
      return <Mail size={20} aria-hidden="true" />;
    default:
      return <Building2 size={20} aria-hidden="true" />;
  }
}

export default function CompanyIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Company"
            title="The company behind MylesNet."
            body={
              <>
                {MYLESCORP.legalName} builds MylesNet from {MYLESCORP.location}. Meet the team,
                see where the platform stands today, and reach us when you are ready.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-company-index-grid">
            {companyChildren.map((child) => (
              <LandingCard
                key={child.href}
                href={child.href}
                variant="link"
                className="landing-company-index-card"
                icon={companyIcon(child.href)}
                title={child.label}
                body={child.description}
                footer={
                  <>
                    Learn more
                    <ArrowRight size={15} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Company"
        title="Talk to the team behind it"
        subtitle="Tell us about your network and we will help you choose the right starting point."
        items={[
          {
            href: "/contact",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Start a conversation",
            body: "Sales, product information, and technical support — reach the team directly.",
            action: "Contact the team",
          },
          {
            href: "/product",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "See the product",
            body: "Review every module and the status it is at today.",
            action: "Browse modules",
          },
        ]}
      />
    </>
  );
}
