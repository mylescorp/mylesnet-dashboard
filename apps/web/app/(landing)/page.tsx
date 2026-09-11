import Link from "next/link";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import ProductPreview from "./components/ProductPreview";
import SectionHead from "./components/SectionHead";
import { Icon } from "./components/LandingIcon";
import { features, solutions } from "./content/pages";
import {
  audiences,
  heroAttributes,
  industryStats,
  processSteps,
  comparisonRows,
  securityPillars,
  faqItems,
  sourcesNote,
} from "./content/home";

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
      <section className="landing-hero">
        <div className="landing-gridlines" aria-hidden="true" />
        <div className="landing-hero-orb landing-hero-orb-a" aria-hidden="true" />
        <div className="landing-hero-orb landing-hero-orb-b" aria-hidden="true" />
        <div className="landing-hero-orb landing-hero-orb-c" aria-hidden="true" />

        <div className="landing-hero-inner landing-container">
          <span className="landing-hero-eyebrow">
            <span className="landing-eyebrow-dot" />
            Built for East African ISPs
          </span>
          <h1 className="landing-hero-title">
            Run connectivity people rely on —{" "}
            <span className="landing-title-accent">without the spreadsheet chaos</span>
          </h1>
          <p className="landing-hero-subtitle">
            MylesNet brings customers, packages, payments, and network operations into
            one place — so you can focus on connecting people well instead of juggling
            notebooks, receipts, and manual data entry.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-cta-button" href="/get-started">
              Get started
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" href="/resources/how-it-works">
              See how it works
            </Link>
          </div>
          <p className="landing-hero-note">
            No technical setup experience required — we walk you through the whole launch.
          </p>
          <ul className="landing-hero-attributes" aria-label="Key capabilities">
            {heroAttributes.map((attribute) => (
              <li className="landing-attribute-chip" key={attribute}>
                <CheckCircle2 size={15} aria-hidden="true" />
                {attribute}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
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
            <Link className="landing-text-link" href="/features/customer-management">
              Explore all features
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
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
            <Link className="landing-text-link" href="/solutions/market-hotspots">
              Explore all solutions
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
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
          <div className="landing-faq">
            {faqItems.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <span className="landing-faq-summary-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
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