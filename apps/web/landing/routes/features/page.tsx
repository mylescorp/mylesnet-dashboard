import { ArrowRight, ArrowUpRight, LayoutDashboard } from "lucide-react";
import { features } from "@/landing/content/pages";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Features",
  "The five areas of the MylesNet platform: customer management, packages and vouchers, payments and finance, network operations, and support and communications.",
  { canonical: "/features" }
);

export default function FeaturesIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Features"
            title="Five areas. One shared record of truth."
            body={
              <>
                Everything your network needs to run smoothly — from sales to support.
                Each area works on its own and together as one platform.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-features-index-grid">
            {features.map((feature) => (
              <LandingCard
                key={feature.slug}
                href={`/features/${feature.slug}`}
                variant="link"
                className="landing-features-index-card"
                icon={<Icon name={feature.icon} size={20} />}
                title={feature.title}
                body={feature.summary}
                tags={feature.highlights.slice(0, 3).map((highlight) => highlight.title)}
                footer={
                  <>
                    Explore feature
                    <ArrowRight size={15} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Features"
        title="Ready to see them on your network?"
        subtitle="We can walk through any combination with your setup before anything is committed."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Tell us which areas you need and we will scope them together.",
            action: "Start a conversation",
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
