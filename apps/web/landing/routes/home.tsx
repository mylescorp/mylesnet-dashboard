import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, ShieldCheck, X } from "lucide-react";
import SectionHead from "@/landing/components/SectionHead";
import StatusChip from "@/landing/components/StatusChip";
import JsonLd from "@/landing/components/JsonLd";
import { Icon } from "@/landing/components/LandingIcon";
import { Button } from "@/shared/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { pageMetadata } from "@/landing/content/seo";
import { features, solutions } from "@/landing/content/pages";
import {
  audiences,
  industryStats,
  processSteps,
  comparisonRows,
  securityPillars,
  faqItems,
  sourcesNote,
  problemPains,
  lifecycleSteps,
  lifecycleHonesty,
  integrationHighlights,
} from "@/landing/content/home";

export const metadata = pageMetadata(
  "MylesNet — ISP Operations Platform for East Africa",
  "MylesNet is the operations platform for East African internet service providers, WISPs, estates, hospitality operators, and community networks — customers, packages, payments, and network operations in one place.",
  { canonical: "/", absoluteTitle: true }
);

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const BENTO_SPANS: Record<string, string> = {
  "customer-management": "landing-bento-span-4",
  "packages-vouchers": "landing-bento-span-2",
  "payments-finance": "landing-bento-span-2",
  "network-operations": "landing-bento-span-2",
  "support-communications": "landing-bento-span-2",
};

export default function LandingHome() {
  return (
    <>
      {/* ============ Hero ============ */}
      <section className="landing-hero landing-hero-cover">
        <h1 className="landing-hero-heading">Smarter billing for growing ISPs</h1>
        <Image
          src="/images/landing/hero-banner.png"
          alt="MylesNet platform overview — automated billing and customer management, M-Pesa payment reconciliation, and real-time network monitoring in one dashboard, with a customer self-service mobile view."
          fill
          priority
          sizes="100vw"
          className="landing-hero-cover-image"
        />
        <div className="landing-hero-actions landing-hero-cover-actions">
          <Button asChild variant="default" size="lg">
            <Link href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/resources/how-it-works">
              See how it works
            </Link>
          </Button>
        </div>
      </section>

      {/* ============ Audiences ============ */}
      <section className="landing-audiences" aria-label="Who MylesNet serves">
        <div className="landing-container">
          <p className="landing-audiences-label">Purpose-built for the people who run connectivity</p>
          <div className="landing-audiences-pills">
            {audiences.map((audience) => (
              <span className="landing-audience-pill" key={audience}>
                {audience}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Sourced industry stats ============ */}
      <section className="landing-stats">
        <div className="landing-stats-inner">
          <SectionHead
            kicker="Why this matters"
            title="Connectivity is hard. Your tools should not be."
            subtitle="Modest networks carry the world of the offline majority. These are the published benchmarks that shape the work — and the standards MylesNet is built around."
          />
          <div className="landing-stats-grid">
            {industryStats.map((stat) => (
              <article className="landing-stat-card" key={stat.label}>
                <span className="landing-stat-value">{stat.value}</span>
                <span className="landing-stat-label">{stat.label}</span>
                <span className="landing-stat-detail">{stat.detail}</span>
                <a className="landing-stat-source" href={stat.source.url} target="_blank" rel="noopener noreferrer">
                  Source: {stat.source.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
          <div className="landing-stats-note">
            <span>{sourcesNote.intro}</span>
            {sourcesNote.items.map((item) => (
              <a key={item.label} href={item.url} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Problem / pains ============ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="The daily reality"
            title="Running connectivity today can feel harder than it should"
            subtitle="These are the operational frictions the platform is built to remove — the gaps where small networks lose money, trust, and time every week."
          />
          <ul className="landing-problem-grid">
            {problemPains.map((pain) => (
              <li className="landing-problem-item" key={pain.title}>
                <h3>{pain.title}</h3>
                <p>{pain.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ Features bento ============ */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="Features"
              title="Everything your network needs to run smoothly"
              subtitle="Five areas of the platform work together, so every part of your operation — from sales to support — has the right tool."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/features/customer-management">
                Explore all features
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="landing-bento">
            {features.map((feature) => (
              <Link
                className={`landing-bento-card ${BENTO_SPANS[feature.slug] ?? "landing-bento-span-2"}`}
                key={feature.slug}
                href={`/features/${feature.slug}`}
              >
                <span className="landing-bento-icon">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.summary}</p>
                <div className="landing-bento-tags">
                  {feature.highlights.slice(0, 3).map((highlight) => (
                    <span className="landing-bento-tag" key={highlight.title}>
                      {highlight.title}
                    </span>
                  ))}
                </div>
                <span className="landing-bento-cta">
                  See how it works
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Lifecycle ============ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="The operating loop"
            title="From signup to renewal, one connected loop"
            subtitle="A subscriber's journey is a single, traceable loop — every step connected to the last, never scattered across systems."
          />
          <div className="landing-honesty">
            <span className="landing-honesty-icon" aria-hidden="true">
              <ShieldCheck size={19} />
            </span>
            <p>
              <strong>{lifecycleHonesty.lead}</strong> {lifecycleHonesty.detail}
            </p>
          </div>
          <ol className="landing-lifecycle">
            {lifecycleSteps.map((step) => (
              <li className="landing-lifecycle-step" key={step.step}>
                <span className="landing-lifecycle-num">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ Process ============ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Getting started"
            title="From first call to go-live, together"
            subtitle="Every network starts differently. We move at the pace you need and handle the technical details on your side."
          />
          <div className="landing-process">
            {processSteps.map((step) => (
              <article className="landing-process-step" key={step.step}>
                <span className="landing-process-num">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Solutions ============ */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="Solutions"
              title="Built for how you operate"
              subtitle="Whether you run a market hotspot, an estate network, a hotel, or a community network, MylesNet adapts to your business."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/solutions/market-hotspots">
                Explore all solutions
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
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

      {/* ============ Comparison ============ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Why operators switch"
            title="The difference is in the day-to-day"
            subtitle="Run your network the way you already want to — the platform simply replaces the friction."
          />
          <div className="landing-compare">
            <div className="landing-compare-head">
              <h3 className="landing-compare-col-title">
                <X size={18} aria-hidden="true" />
                How most networks run today
              </h3>
              <h3 className="landing-compare-col-title landing-compare-col-title-with">
                <CheckCircle2 size={18} aria-hidden="true" />
                With MylesNet
              </h3>
            </div>
            {comparisonRows.map((row, index) => (
              <div className="landing-compare-row" key={index}>
                <div className="landing-compare-cell">
                  <X size={17} aria-hidden="true" />
                  {row.without}
                </div>
                <div className="landing-compare-cell landing-compare-cell-with">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {row.with}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Security & trust ============ */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <SectionHead
            kicker="Built on trust"
            title="Serious about your data and your money"
            subtitle="Running a network means owning real customer records and real money. MylesNet treats both with the care they deserve."
          />
          <div className="landing-trust-grid">
            {securityPillars.map((pillar) => (
              <article className="landing-trust-card" key={pillar.title}>
                <span className="landing-trust-icon">
                  <Icon name={pillar.icon} size={21} />
                </span>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="FAQ"
            title="Questions operators ask us"
            subtitle="Straight answers about hardware, data, payments, and going live — before you commit to anything."
          />
          <Accordion type="single" collapsible className="landing-faq">
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="landing-faq-answer">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <JsonLd data={faqJsonLd} />
        </div>
      </section>

      {/* ============ Integrations teaser ============ */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="Integrations"
              title="Plays well with the tools you already run"
              subtitle="Every integration is labelled honestly — available now, in pilot, on the roadmap, or scoped for your setup."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/integrations">
                Explore all integrations
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <ul className="landing-int-tiles">
            {integrationHighlights.map((item) => (
              <li className="landing-int-tile" key={item.name}>
                <span>{item.name}</span>
                <StatusChip status={item.status} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="landing-cta-band">
        <div className="landing-cta-inner">
          <p className="landing-section-kicker">Ready when you are</p>
          <h2>Run your network on MylesNet</h2>
          <p>
            Tell us about your network and we will help you choose the right starting
            point — and walk you through the launch every step of the way.
          </p>
          <div className="landing-hero-actions">
            <Button asChild variant="default" size="lg">
              <Link href="/get-started">
                Get started
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">
                See pricing
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
