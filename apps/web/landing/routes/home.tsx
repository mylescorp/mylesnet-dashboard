import Link from "next/link";
import { ArrowRight, ArrowUpRight, LayoutDashboard, ShieldCheck } from "lucide-react";
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

const HERO_PHOTOS = [
  {
    src: "https://images.unsplash.com/photo-1742167523399-0d63f6da7d9c?auto=format&fit=crop&w=1920&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1768716957251-09c1afa17ad3?auto=format&fit=crop&w=1920&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1750711731797-25c3f2551ff8?auto=format&fit=crop&w=1920&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1564457461758-8ff96e439e83?auto=format&fit=crop&w=1920&q=85",
  },
  {
    src: "https://images.unsplash.com/photo-1681383064412-171e5bee5f6e?auto=format&fit=crop&w=1920&q=85",
  },
];

function HeroImageBackdrop() {
  return (
    <div className="landing-home-hero-slideshow" aria-hidden="true">
      {HERO_PHOTOS.map((photo, index) => (
        <div
          className="landing-home-hero-slide"
          key={photo.src}
          style={{
            backgroundImage: `url("${photo.src}")`,
            animationDelay: `-${index * 8}s`,
          }}
        />
      ))}
    </div>
  );
}

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
              Smarter billing for <span>growing ISPs</span>
            </>
          }
          body={
            <>
              Keep subscribers connected and operations in step. Manage customers,
              packages, payments, and network activity in one place.
            </>
          }
        >
          <div className="landing-home-hero-background"><HeroImageBackdrop /></div>
          <div className="landing-home-actions">
            <Button asChild variant="default" size="lg">
              <Link href="/signup">
                Get started <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/resources/how-it-works">See how it works</Link>
            </Button>
          </div>
          <p className="landing-home-note">
            For WISPs, estates, hotspots, hospitality, and community networks.
          </p>
          <a className="landing-home-photo-credit landing-home-hero-credit" href="https://unsplash.com/" target="_blank" rel="noopener noreferrer">
            Photography via Unsplash
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
            {features.map((feature) => (
              <LandingCard
                key={feature.slug}
                href={`/features/${feature.slug}`}
                variant="link"
                icon={<Icon name={feature.icon} size={22} />}
                title={feature.title}
                body={feature.summary}
                tags={feature.highlights.slice(0, 3).map((highlight) => highlight.title)}
                footer={
                  <>
                    Explore feature <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
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
            subtitle="Clear access controls and traceable financial records support the work your team does every day."
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

      <LandingCtaSection
        className="landing-home-section"
        kicker="Ready when you are"
        title="Bring your network operations together"
        subtitle="Tell us how your network runs and we’ll help you find the right next step."
        items={[
          {
            href: "/signup",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Create an account and run any plan free for your first 14 days.",
            action: "Create an account",
          },
          {
            href: "/get-started",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Talk to our team",
            body: "Walk us through your network and we will map the starting point.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}
