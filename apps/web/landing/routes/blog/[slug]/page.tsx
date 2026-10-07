import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ScrollText } from "lucide-react";
import { posts, formatPostDate } from "@/landing/content/blog";
import { pageMetadata } from "@/landing/content/seo";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import LandingCard from "@/landing/components/LandingCard";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const post = posts.find((p) => p.slug === slug);
    if (!post) return {};
    return pageMetadata(post.title, post.excerpt, {
      canonical: `/blog/${post.slug}`,
    });
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const otherPosts = posts.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow={post.tag}
            title={post.title}
            body={post.excerpt}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <p className="landing-prose-note">
              {formatPostDate(post.date)} · {post.tag}
            </p>
            {post.sections.map((section) => (
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
              {otherPosts.map((other) => (
                <li key={other.slug}>
                  <Link href={`/blog/${other.slug}`}>{other.title}</Link>
                </li>
              ))}
              <li>
                <Link href="/blog">All posts</Link>
              </li>
            </ul>
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