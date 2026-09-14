import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { solutions } from "../content/pages";
import { pageMetadata } from "../content/seo";
import { Icon } from "../components/LandingIcon";

export const metadata = pageMetadata(
  "Solutions",
  "MylesNet for market WiFi hotspots, estate and apartment networks, hospitality guest Wi-Fi, and community networks.",
  { canonical: "/solutions" }
);

export default function SolutionsIndexPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Solutions</p>
          <h1>Built for how you operate</h1>
          <p className="landing-banner-lead">
            Whether you run a market hotspot, an estate network, a hotel, or a community
            network, MylesNet adapts to your business rather than the other way around.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-solutions-grid">
            {solutions.map((solution) => (
              <Link
                className="landing-solution-card"
                key={solution.slug}
                href={`/solutions/${solution.slug}`}
              >
                <div className="landing-solution-head">
                  <span className="landing-solution-icon">
                    <Icon name={solution.icon} size={22} />
                  </span>
                  <div>
                    <h3>{solution.title}</h3>
                    <p>{solution.tagline}</p>
                  </div>
                </div>
                <p>{solution.summary}</p>
                <ul className="landing-solution-outcomes">
                  {solution.outcomes.map((outcome) => (
                    <li key={outcome}>
                      <CheckCircle2 size={17} aria-hidden="true" />
                      {outcome}
                    </li>
                  ))}
                </ul>
                <span className="landing-bento-cta">
                  Explore solution
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Solutions</p>
          <h2>Do not see your setup here?</h2>
          <p>Tell us how you operate — we scope the platform per network, not per template.</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/contact">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}