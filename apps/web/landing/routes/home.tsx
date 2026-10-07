import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Calculator, Globe, LayoutDashboard, Network, ShieldCheck, Wifi } from "lucide-react";
import SectionHead from "@/landing/components/SectionHead";
import JsonLd from "@/landing/components/JsonLd";
import ProductPreview from "@/landing/components/ProductPreview";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
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
import { productModules } from "@/landing/content/product";
import {
  audiences,
  processSteps,
  securityPillars,
  faqItems,
  lifecycleHonesty,
} from "@/landing/content/home";

export const metadata = pageMetadata(
  "MylesNet — ISP Operations Platform for East Africa",
  "MylesNet brings subscriber management, packages, payments, and network operations together for internet providers and community networks across East Africa.",
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

export default function LandingHome() {
  return (
    <>
      <section className="landing-home-hero" aria-labelledby="home-heading">
        <LandingCard
          variant="hero"
          titleAs="h1"
          titleId="home-heading"
          className="landing-home-hero-card"
          eyebrow="ISP BILLING & NETWORK OPERATIONS"
          title={
            <>
              One workspace for <span>ISP operations</span>
            </>
          }
          body={
            <>
              Bring subscriber records, billing, and network operations into one
              workspace built for connectivity providers across East Africa.
            </>
          }
        >
          <div className="landing-home-hero-background" aria-hidden="true">
            <Image
              src="/images/landing/network-cables-unsplash.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 760px) 100vw, 1200px"
              className="landing-home-hero-image"
            />
          </div>
          <div className="landing-home-actions">
            <Button asChild variant="default" size="lg">
              <Link href="/get-started">
                Talk to our team <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/customers">Check pilot status</Link>
            </Button>
          </div>
          <p className="landing-home-note">
            For WISPs, estates, hospitality, and community networks.
          </p>
          <a className="landing-home-photo-credit landing-home-hero-credit" href="https://unsplash.com/photos/a-bunch-of-wires-that-are-connected-to-a-server-T-IN5o3kxyA" target="_blank" rel="noopener noreferrer">
            Photo by NADDOD on Unsplash
          </a>
        </LandingCard>
      </section>

      <section className="landing-home-preview-section" aria-label="MylesNet dashboard preview">
        <div className="landing-home-preview">
          <ProductPreview />
        </div>
      </section>

      <section className="landing-audiences" aria-label="Who MylesNet serves">
        <div className="landing-container landing-home-audiences">
          <p className="landing-audiences-label">Built for teams running connectivity</p>
          <div className="landing-audiences-pills">
            {audiences.map((audience) => (
              <span className="landing-audience-pill" key={audience}>{audience}</span>
            ))}
          </div>
          <p className="landing-home-pilot-note">
            <strong>Pre-launch:</strong> onboarding a small number of operators through controlled pilots.{" "}
            <Link href="/customers">See current availability and roadmap</Link>.
          </p>
        </div>
      </section>

      <section id="features" className="landing-section landing-home-section">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="THE PLATFORM"
              title="The work of running an ISP, connected"
              subtitle="Bring subscriber records, billing, payments, and network operations into a shared workspace."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/features">
                Explore all features <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="landing-home-feature-grid">
            {features.map((feature) => {
              const status = productModules.find((module) => module.slug === feature.slug)?.status;
              const statusLabel = status === "Available"
                ? "Available"
                : status === "Beta"
                  ? "Controlled operator pilots"
                  : status === "Planned"
                    ? "On the roadmap"
                    : "Availability confirmed with our team";
              return (
                <LandingCard
                  key={feature.slug}
                  href={`/features/${feature.slug}`}
                  variant="link"
                  icon={<Icon name={feature.icon} size={22} />}
                  title={feature.title}
                  body={feature.summary}
                  meta={<span>Current status: {statusLabel}</span>}
                  tags={feature.highlights.slice(0, 3).map((highlight) => highlight.title)}
                  footer={
                    <>
                      Explore feature <ArrowRight size={16} aria-hidden="true" />
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-home-visual-section" aria-labelledby="network-operations-heading">
        <div className="landing-home-visual-inner">
          <div
            className="landing-home-visual-photo"
            role="img"
            aria-label="Black Kenyan network technician installing and maintaining a server rack"
          />
          <div className="landing-home-visual-copy">
            <p className="landing-section-kicker">NETWORK OPERATIONS</p>
            <h2 id="network-operations-heading">See the network behind every subscriber</h2>
            <p>
              Keep device health, site details, usage, and customer service context
              close together when your team needs to investigate an issue.
            </p>
            <Link href="/features/network-operations" className="landing-home-visual-link">
              Explore network operations <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              className="landing-home-photo-credit"
              href="https://commons.wikimedia.org/wiki/File:InformationTechnologyWork_08.jpg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Photo by DavidMakai 254 on Wikimedia Commons
            </a>
            <a
              className="landing-home-photo-credit"
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY-SA 4.0
            </a>
          </div>
        </div>
      </section>

      <section id="solutions" className="landing-section landing-section-alt landing-home-section">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="SOLUTIONS"
              title="Fits the way your network operates"
              subtitle="A practical starting point for different kinds of connectivity businesses."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/solutions">Explore solutions <ArrowRight size={16} aria-hidden="true" /></Link>
            </Button>
          </div>
          <div className="landing-solutions-grid">
            {solutions.map((solution) => (
              <LandingCard
                key={solution.slug}
                href={`/solutions/${solution.slug}`}
                variant="link"
                icon={<Icon name={solution.icon} size={22} />}
                title={solution.title}
                eyebrow={solution.tagline}
                body={solution.summary}
                outcomes={solution.outcomes}
                footer={
                  <>
                    Explore solution <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-home-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="GETTING STARTED"
            title="A guided path from first conversation to go-live"
            subtitle="We learn how you work, configure the platform around your network, and launch with your team."
          />
          <div className="landing-honesty">
            <span className="landing-honesty-icon" aria-hidden="true"><ShieldCheck size={19} /></span>
            <p><strong>{lifecycleHonesty.lead}</strong> {lifecycleHonesty.detail}</p>
          </div>
          <div className="landing-process">
            {processSteps.map((step) => (
              <LandingCard
                key={step.step}
                variant="step"
                step={step.step}
                title={step.title}
                body={step.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="landing-section landing-section-alt landing-home-section">
        <div className="landing-section-inner">
          <SectionHead
            kicker="TRUST & CONTROL"
            title="Your customer records and money deserve care"
            subtitle="Security and financial workflows are validated with pilot operators. Ask our team what is available for your setup before onboarding."
          />
          <div className="landing-trust-grid">
            {securityPillars.map((pillar) => (
              <LandingCard
                key={pillar.title}
                icon={<Icon name={pillar.icon} size={21} />}
                title={pillar.title}
                body={pillar.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="landing-section landing-home-section">
        <div className="landing-section-inner landing-home-faq-inner">
          <SectionHead
            kicker="FAQ"
            title="Questions operators ask us"
            subtitle="Straight answers about hardware, data, payments, and getting started."
          />
          <Accordion type="single" collapsible className="landing-faq">
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent><p className="landing-faq-answer">{item.answer}</p></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <JsonLd data={faqJsonLd} />
        </div>
      </section>

      <section id="tools" className="landing-section landing-section-alt landing-home-section">
        <div className="landing-section-inner">
          <div className="landing-kicker-row">
            <SectionHead
              align="left"
              kicker="FREE TOOLS"
              title="Utilities that need no account"
              subtitle="Quick calculators and tests — useful whether or not you run on the platform."
            />
            <Button asChild variant="link" size="sm">
              <Link href="/country">
                Browse by country <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="landing-home-feature-grid">
            <LandingCard
              href="/speedtest"
              variant="link"
              icon={<Wifi size={22} aria-hidden="true" />}
              title="Speed test"
              body="Download, upload, ping and jitter in one run — no account, nothing stored."
              footer={
                <>
                  Run the test <ArrowRight size={16} aria-hidden="true" />
                </>
              }
            />
            <LandingCard
              href="/bandwidth-calculator"
              variant="link"
              icon={<Calculator size={22} aria-hidden="true" />}
              title="Bandwidth calculator"
              body="Transfer time, capacity, and the speed a plan actually needs, in your browser."
              footer={
                <>
                  Calculate <ArrowRight size={16} aria-hidden="true" />
                </>
              }
            />
            <LandingCard
              href="/subnet-calculator"
              variant="link"
              icon={<Network size={22} aria-hidden="true" />}
              title="Subnet calculator"
              body="CIDR to network, usable range, mask, and host counts — plus pool sizing."
              footer={
                <>
                  Calculate <ArrowRight size={16} aria-hidden="true" />
                </>
              }
            />
            <LandingCard
              href="/what-is-my-ip"
              variant="link"
              icon={<Globe size={22} aria-hidden="true" />}
              title="What is my IP"
              body="Your public address as this site sees it, with the coarse location it reports."
              footer={
                <>
                  Look it up <ArrowRight size={16} aria-hidden="true" />
                </>
              }
            />
          </div>
        </div>
      </section>

      <LandingCtaSection
        className="landing-home-section"
        kicker="Early operator access"
        title="Explore whether MylesNet fits your network"
        subtitle="We are onboarding through controlled pilots. Talk with our team about current availability, capabilities, and rollout timing."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Talk to our team",
            body: "Tell us how your network operates and ask about joining a pilot.",
            action: "Discuss early access",
          },
          {
            href: "/customers",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Check current status",
            body: "See what is available in pilots and what remains on the roadmap.",
            action: "View pilot status",
          },
        ]}
      />
    </>
  );
}
