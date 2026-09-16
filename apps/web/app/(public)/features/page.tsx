import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { features } from "../content/pages";
import { pageMetadata } from "../content/seo";
import { Icon } from "../components/LandingIcon";

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
          <p className="landing-section-kicker">Features</p>
          <h1>Five areas. One shared record of truth.</h1>
          <p className="landing-banner-lead">
            Everything your network needs to run smoothly — from sales to support.
            Each area works on its own and together as one platform.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-features-index-grid">
            {features.map((feature) => (
              <Link className="landing-card landing-features-index-card" href={`/features/${feature.slug}`} key={feature.slug}>
                <span className="landing-card-icon">
                  <Icon name={feature.icon} size={20} />
                </span>
                <h3 className="landing-card-title">{feature.title}</h3>
                <p className="landing-card-body">{feature.summary}</p>
                <ul className="landing-card-tags">
                  {feature.highlights.slice(0, 3).map((highlight) => (
                    <li key={highlight.title}>{highlight.title}</li>
                  ))}
                </ul>
                <span className="landing-card-link">
                  Explore feature
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Features</p>
          <h2>Ready to see them on your network?</h2>
          <p>We can walk through any combination with your setup before anything is committed.</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/product">
              See the product
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}