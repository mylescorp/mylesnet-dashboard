import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { features } from "../../content/pages";
import { Icon } from "../../components/icon";

export function generateStaticParams() {
  return features.map((feature) => ({ slug: feature.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const feature = features.find((f) => f.slug === slug);
    if (!feature) return {};
    return {
      title: feature.title,
      description: feature.summary,
    };
  });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = features.find((f) => f.slug === slug);
  if (!feature) notFound();

  const others = features.filter((f) => f.slug !== slug);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Features</p>
          <h1>{feature.title}</h1>
          <p className="landing-banner-lead">
            {feature.tagline}. {feature.summary}
          </p>
          <div className="landing-banner-meta">
            {feature.highlights.slice(0, 3).map((highlight) => (
              <span className="landing-banner-meta-item" key={highlight.title}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {highlight.title}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <blockquote>{feature.whyMatters}</blockquote>
            <h2>What you get</h2>
            <ul className="landing-checklist">
              {feature.highlights.map((highlight) => (
                <li className="landing-checklist-item" key={highlight.title}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>
                    <strong>{highlight.title}.</strong> {highlight.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Works with the rest of the platform</h2>
            <p>
              {feature.title} connects to the other areas of MylesNet so the whole
              operation shares one record of truth. Bring a feature on its own, or run
              the full platform — both work.
            </p>
          </div>
          <div className="landing-grid">
            {others.map((other) => (
              <Link className="landing-card" key={other.slug} href={`/features/${other.slug}`}>
                <span className="landing-card-icon">
                  <Icon name={other.icon} size={19} />
                </span>
                <h3 className="landing-card-title">{other.title}</h3>
                <p className="landing-card-body">{other.summary}</p>
                <span className="landing-card-link">
                  Explore {other.title.toLowerCase()}
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
          <h2>Want to see {feature.title.toLowerCase()} in action?</h2>
          <p>We can show you how it fits your network and walk you through a pilot.</p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}