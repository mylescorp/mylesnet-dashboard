import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { guides } from "@/landing/content/guides";
import { pageMetadata } from "@/landing/content/seo";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import LandingCard from "@/landing/components/LandingCard";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const guide = guides.find((g) => g.slug === slug);
    if (!guide) return {};
    return pageMetadata(guide.title, guide.intro, {
      canonical: `/resources/${guide.slug}`,
    });
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();

  const otherGuides = guides.filter((g) => g.slug !== slug).slice(0, 3);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={guide.kicker}
            title={guide.title}
            body={guide.intro}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            {guide.sections.map((section) => (
              <article key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>Keep reading</h2>
            <ul>
              {otherGuides.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/resources/${guide.slug}`}>{guide.title}</Link>
                </li>
              ))}
              <li>
                <Link href="/resources">All resources</Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Resources"
        title="Ready to put this into practice?"
        subtitle="This guide covers the approach — the platform is where you run it day to day."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "All resources",
            body: "Browse every guide and playbook we have published.",
            action: "Browse guides",
          },
        ]}
      />
    </>
  );
}
