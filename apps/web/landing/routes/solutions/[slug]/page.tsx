import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, CheckCircle2, CreditCard } from "lucide-react";
import { solutions } from "@/landing/content/pages";
import { pageMetadata } from "@/landing/content/seo";
import { Icon } from "@/landing/components/LandingIcon";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export function generateStaticParams() {
  return solutions.map((solution) => ({ slug: solution.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const solution = solutions.find((s) => s.slug === slug);
    if (!solution) return {};
    return pageMetadata(solution.title, solution.summary, {
      canonical: `/solutions/${solution.slug}`,
    });
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
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Solutions"
            title={solution.title}
            body={<>{solution.tagline}. {solution.summary}</>}
            tags={solution.outcomes.slice(0, 3).map((outcome) => (
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                {outcome}
              </>
            ))}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <blockquote>
              The situation: {solution.scenario}
            </blockquote>
            <h2>What you can expect</h2>
          </div>
          <ul className="landing-checklist">
            {solution.outcomes.map((outcome) => (
              <li key={outcome}>
                <LandingCard
                  variant="compact"
                  icon={<CheckCircle2 size={17} aria-hidden="true" />}
                  title={outcome}
                />
              </li>
            ))}
          </ul>
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
              <LandingCard
                key={other.slug}
                href={`/solutions/${other.slug}`}
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
        kicker="Solutions"
        title={`Running a ${solution.title.toLowerCase()}?`}
        subtitle="See how MylesNet fits the way you already work — and what it takes to get started."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: `Walk through ${solution.title.toLowerCase()} with our team before anything is committed.`,
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
