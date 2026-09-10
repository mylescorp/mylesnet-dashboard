import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About MylesNet",
  description:
    "MylesNet is built by MylesCorp Technologies Ltd to serve East African internet service providers, communities, and connectivity businesses.",
};

export default function AboutPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Company</p>
          <h1>About MylesNet</h1>
          <p>
            MylesNet exists to make professional network operations practical
            for African connectivity businesses of every size.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Why we built it</h2>
            <p>
              Running an internet service means juggling customers, plans, money,
              and network equipment — often across spreadsheets and paper
              systems. As networks grow, that becomes harder and harder to keep
              accurate. MylesNet brings these into one place so operators can
              focus on connecting people well.
            </p>

            <h2>Built for the way you operate</h2>
            <p>
              Whether you operate a market hotspot, an estate, a guest network,
              or a community service, the daily work is the same: sell access,
              track payments, and keep people online. MylesNet is designed
              around that work rather than asking you to adapt to a rigid
              enterprise mould.
            </p>

            <h2>Built by MylesCorp</h2>
            <p>
              MylesNet is a product of MylesCorp Technologies Ltd. We build
              practical systems for East African businesses, with an emphasis on
              reliability, clear money tracking, and interfaces people can
              actually use.
            </p>

            <div className="landing-hero-actions">
              <Link className="landing-cta-button" href="/get-started">
                See it on your network
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}