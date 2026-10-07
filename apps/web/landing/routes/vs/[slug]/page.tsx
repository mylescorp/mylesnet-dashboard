import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, LayoutDashboard, Minus } from "lucide-react";
import { comparisons, getComparison } from "@/landing/content/comparisons";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export function generateStaticParams() {
  return comparisons.map((comparison) => ({ slug: comparison.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const comparison = getComparison(slug);
    if (!comparison) return {};
    return pageMetadata(
      `${comparison.name} vs MylesNet`,
      comparison.summary,
      { canonical: `/vs/${comparison.slug}` }
    );
  });
}

export default async function VsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const otherComparisons = comparisons.filter((c) => c.slug !== slug);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={`Compare · ${comparison.kind}`}
            title={`${comparison.name} vs MylesNet`}
            body={comparison.summary}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>What {comparison.name} is</h2>
            <p>{comparison.whatItIs}</p>
          </div>

          <div className="landing-grid" style={{ marginTop: "var(--space-4)" }}>
            <LandingCard
              icon={<Check size={20} aria-hidden="true" />}
              title="Where it genuinely wins"
              body={
                <ul className="landing-int-list">
                  {comparison.whereItWins.map((point) => (
                    <li key={point.slice(0, 40)}>{point}</li>
                  ))}
                </ul>
              }
            />
            <LandingCard
              icon={<Minus size={20} aria-hidden="true" />}
              title="Where it strains"
              body={
                <ul className="landing-int-list">
                  {comparison.whereItStrains.map((point) => (
                    <li key={point.slice(0, 40)}>{point}</li>
                  ))}
                </ul>
              }
            />
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>The honest comparison</h2>
            <div className="landing-grid">
              {comparison.howWeCompare.map((point) => (
                <LandingCard
                  key={point.title}
                  title={point.title}
                  body={point.body}
                />
              ))}
            </div>
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>The verdict</h2>
            <p>{comparison.verdict}</p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Keep reading</h2>
            <ul>
              {otherComparisons.map((other) => (
                <li key={other.slug}>
                  <Link href={`/vs/${other.slug}`}>
                    {other.name} vs MylesNet
                  </Link>
                </li>
              ))}
              {comparison.related.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/vs">All comparisons</Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Compare"
        title="See the difference in the platform, not the prose"
        subtitle="The fairest test is a walk through the operator's day on MylesNet."
        items={[
          {
            href: "/demo",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Live demo",
            body: "A guided tour of the operator console, surface by surface.",
            action: "See the demo",
          },
          {
            href: "/pricing",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Pricing",
            body: "Usage-based rates with no per-router or per-seat charges.",
            action: "Compare pricing",
          },
        ]}
      />
    </>
  );
}