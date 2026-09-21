import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";

export const metadata = pageMetadata(
  "About MylesCorp Technologies Ltd",
  "MylesCorp Technologies Ltd is the company developing MylesNet for East African connectivity operators.",
  { canonical: "/company/mylescorp" }
);

export default function MylesCorpPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Company</p>
          <h1>About MylesCorp Technologies Ltd</h1>
          <p className="landing-banner-lead">
            MylesCorp Technologies Ltd develops MylesNet as a focused product for the
            operational needs of East African connectivity businesses.
          </p>
        </div>
      </section>
      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Practical software for operational work</h2>
            <p>
              We believe the systems behind a connectivity business should make daily
              decisions clearer: who is being served, what service is active, what has
              been paid, and what needs attention next.
            </p>
            <h2>How we develop MylesNet</h2>
            <p>
              We use a staged, evidence-led approach. Public product statements are
              kept to what can be supported, and the scope for each operator is agreed
              before a rollout is proposed.
            </p>
            <div className="landing-hero-actions landing-hero-actions-start">
              <Link className="landing-cta-button" href="/company/about">About MylesNet</Link>
              <Link className="landing-secondary-button" href="/get-started">Talk to our team <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
