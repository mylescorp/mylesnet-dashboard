import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { solutions } from "../../content/pages";
import { Icon } from "../../components/LandingIcon";

export function generateStaticParams() {
  return solutions.map((solution) => ({ slug: solution.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const solution = solutions.find((s) => s.slug === slug);
    if (!solution) return {};
    return {
      title: solution.title,
      description: solution.summary,
    };
  });
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = solutions.find((s) => s.slug === slug);
  if (!solution) notFound();

  const others = solutions.filter((s) => s.slug !== slug);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Solutions</p>
          <h1>{solution.title}</h1>
          <p className="landing-banner-lead">
            {solution.tagline}. {solution.summary}
          </p>
          <div className="landing-banner-meta">
            {solution.outcomes.slice(0, 3).map((outcome) => (
              <span className="landing-banner-meta-item" key={outcome}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {outcome}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <blockquote>
              The situation: {solution.scenario}
            </blockquote>
            <h2>What you can expect</h2>
            <ul className="landing-checklist">
              {solution.outcomes.map((outcome) => (
                <li className="landing-checklist-item" key={outcome}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Related ways to operate</h2>
            <p>
              Many operators run more than one kind of network. These are the other
              ways teams use MylesNet to stay organised.
            </p>
          </div>
          <div className="landing-grid">
            {others.map((other) => (
              <Link className="landing-card" key={other.slug} href={`/solutions/${other.slug}`}>
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
          <p className="landing-section-kicker">Solutions</p>
          <h2>Running a {solution.title.toLowerCase()}?</h2>
          <p>See how MylesNet fits the way you already work — and what it takes to get started.</p>
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