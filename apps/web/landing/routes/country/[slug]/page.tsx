import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Banknote, Landmark, LayoutDashboard, Wallet } from "lucide-react";
import { countries, getCountry } from "@/landing/content/countries";
import { pageMetadata } from "@/landing/content/seo";
import JsonLd from "@/landing/components/JsonLd";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";

export function generateStaticParams() {
  return countries.map((country) => ({ slug: country.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const country = getCountry(slug);
    if (!country) return {};
    return pageMetadata(
      `ISP billing in ${country.name}`,
      `${country.intro} Payment rails, regulation, and running MylesNet in ${country.name}.`,
      { canonical: `/country/${country.slug}` }
    );
  });
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = getCountry(slug);
  if (!country) notFound();

  const otherCountries = countries.filter((c) => c.slug !== slug).slice(0, 3);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: country.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const facts = [
    {
      icon: <Banknote size={20} aria-hidden="true" />,
      title: "Currency",
      body: country.currency,
    },
    {
      icon: <Landmark size={20} aria-hidden="true" />,
      title: "Regulator",
      body: country.regulator,
    },
    {
      icon: <Wallet size={20} aria-hidden="true" />,
      title: "How subscribers pay",
      body: country.paymentRails.join(" · "),
    },
  ];

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={`By country · ${country.code}`}
            title={`ISP billing in ${country.name}`}
            body={country.intro}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-grid">
            {facts.map((fact) => (
              <LandingCard
                key={fact.title}
                icon={fact.icon}
                title={fact.title}
                body={fact.body}
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            {country.sections.map((section) => (
              <article key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>Questions operators ask</h2>
            <Accordion type="single" collapsible className="landing-faq">
              {country.faq.map((item) => (
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
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Keep reading</h2>
            <ul>
              {otherCountries.map((other) => (
                <li key={other.slug}>
                  <Link href={`/country/${other.slug}`}>
                    ISP billing in {other.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/country">All country guides</Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="By country"
        title="From country context to a running network"
        subtitle="The market is the context — the platform is where the operation runs day to day."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources/how-it-works",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "How MylesNet works",
            body: "Subscribers, billing, network, and reporting as one shared record.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}