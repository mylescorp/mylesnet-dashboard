import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, CheckCircle2, CreditCard } from "lucide-react";
import { features } from "@/landing/content/pages";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export function generateStaticParams() {
  return features.map((feature) => ({ slug: feature.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const feature = features.find((f) => f.slug === slug);
    if (!feature) return {};
    return pageMetadata(feature.title, feature.summary, {
      canonical: `/features/${feature.slug}`,
    });
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
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Features"
            title={feature.title}
            body={<>{feature.tagline}. {feature.summary}</>}
            tags={feature.highlights.slice(0, 3).map((highlight) => (
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                {highlight.title}
              </>
            ))}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <blockquote>{feature.whyMatters}</blockquote>
            <h2>What you get</h2>
          </div>
          <ul className="landing-checklist">
            {feature.highlights.map((highlight) => (
              <li key={highlight.title}>
                <LandingCard
                  variant="compact"
                  icon={<CheckCircle2 size={17} aria-hidden="true" />}
                  title={highlight.title}
                  body={highlight.description}
                />
              </li>
            ))}
          </ul>
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
              <LandingCard
                key={other.slug}
                href={`/features/${other.slug}`}
                variant="link"
                icon={<Icon name={other.icon} size={19} />}
                title={other.title}
                body={other.summary}
                footer={
                  <>
                    Explore {other.title.toLowerCase()}
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
        title={`Want to see ${feature.title.toLowerCase()} in action?`}
        subtitle="We can show you how it fits your network and walk you through a pilot."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: `Walk through ${feature.title.toLowerCase()} on your own setup before you commit.`,
            action: "Start a conversation",
          },
          {
            href: "/pricing",
            icon: <CreditCard size={19} aria-hidden="true" />,
            title: "See pricing",
            body: "Compare plans and what each one includes.",
            action: "Compare plans",
          },
        ]}
      />
    </>
  );
}
