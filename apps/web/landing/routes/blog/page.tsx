import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  LayoutDashboard,
  ScrollText,
} from "lucide-react";
import { posts, formatPostDate } from "@/landing/content/blog";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Blog",
  "Billing, MikroTik and payments, explained — practical pieces for ISP operators.",
  { canonical: "/blog" }
);

export default function BlogPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Blog"
            title="Billing, MikroTik and payments, explained"
            body={
              <>
                Practical pieces for ISP operators. Each post is a path through the habits that
                keep a small network healthy — no marketing, no filler.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-resource-grid">
            {posts.map((post) => (
              <LandingCard
                key={post.slug}
                href={`/blog/${post.slug}`}
                variant="link"
                title={post.title}
                body={post.excerpt}
                meta={
                  <>
                    <span>{formatPostDate(post.date)}</span>
                    <span>{post.tag}</span>
                  </>
                }
                footer={
                  <>
                    Read the post
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              Posts are written when we see an operator ask the same question twice. If you have a
              topic that is missing, tell us — the next post usually comes from a real conversation.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Blog"
        title="The guides go deeper"
        subtitle="Blog posts are the entry point — the resources hub has the full guides and playbooks."
        items={[
          {
            href: "/resources",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "All resources",
            body: "Guides, playbooks, and checklists for the operator's day.",
            action: "Browse guides",
          },
          {
            href: "/changelog",
            icon: <ScrollText size={19} aria-hidden="true" />,
            title: "Changelog",
            body: "What shipped in MylesNet, update by update.",
            action: "Read the log",
          },
        ]}
      />
    </>
  );
}