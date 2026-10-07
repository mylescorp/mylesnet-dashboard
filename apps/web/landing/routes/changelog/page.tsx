import { ArrowRight, LayoutDashboard } from "lucide-react";
import { releases, formatReleaseDate } from "@/landing/content/changelog";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Changelog",
  "What shipped in MylesNet, update by update — with an honest status on every release note.",
  { canonical: "/changelog" }
);

export default function ChangelogPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Changelog"
            title="What shipped, update by update"
            body={
              <>
                Every release note here carries a status that means what it says: Shipped is live
                today, In verification is built and under review, Specified is agreed but not
                built.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {releases.map((release) => (
              <LandingCard
                key={release.slug}
                href={`/changelog/${release.slug}`}
                variant="link"
                title={release.title}
                body={release.summary}
                meta={
                  <>
                    <span className="landing-soon-chip">{release.status}</span>
                    <span>{formatReleaseDate(release.date)}</span>
                  </>
                }
                footer={
                  <>
                    Read the release note
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              Dates are the day the decision was recorded, not an aspiration. If something is not
              live, this page says so.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Changelog"
        title="Follow along, then try it"
        subtitle="Release notes tell you what changed — the platform is where you see it."
        items={[
          {
            href: "/get-started",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources",
            icon: <ArrowRight size={19} aria-hidden="true" />,
            title: "All resources",
            body: "Guides and playbooks behind the features on this page.",
            action: "Browse guides",
          },
        ]}
      />
    </>
  );
}
