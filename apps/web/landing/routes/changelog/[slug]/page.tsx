import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { releases, formatReleaseDate } from "@/landing/content/changelog";
import { pageMetadata } from "@/landing/content/seo";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import LandingCard from "@/landing/components/LandingCard";

export function generateStaticParams() {
  return releases.map((release) => ({ slug: release.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const release = releases.find((r) => r.slug === slug);
    if (!release) return {};
    return pageMetadata(release.title, release.summary, {
      canonical: `/changelog/${release.slug}`,
    });
  });
}

export default async function ReleasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const release = releases.find((r) => r.slug === slug);
  if (!release) notFound();

  const otherReleases = releases.filter((r) => r.slug !== slug).slice(0, 3);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={release.status}
            title={release.title}
            body={release.summary}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <p className="landing-prose-note">
              {formatReleaseDate(release.date)} · Status: {release.status}
            </p>
            <h2>What changed</h2>
            <ul>
              {release.items.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="landing-prose landing-prose-spaced">
            <h2>Keep reading</h2>
            <ul>
              {otherReleases.map((other) => (
                <li key={other.slug}>
                  <Link href={`/changelog/${other.slug}`}>{other.title}</Link>
                </li>
              ))}
              <li>
                <Link href="/changelog">All release notes</Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Changelog"
        title="See it in the product"
        subtitle="Release notes say what changed — the platform is where you run it day to day."
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
