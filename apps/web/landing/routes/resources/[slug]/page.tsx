import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { guides } from "@/landing/content/guides";
import { pageMetadata } from "@/landing/content/seo";

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
          <p className="landing-section-kicker">{guide.kicker}</p>
          <h1>{guide.title}</h1>
          <p className="landing-banner-lead">{guide.intro}</p>
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
            <div className="landing-hero-actions landing-hero-actions-start">
              <Link className="landing-cta-button" href="/get-started">
                Get started
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="landing-secondary-button" href="/resources">
                All resources
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
