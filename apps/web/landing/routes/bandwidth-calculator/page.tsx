import { ArrowUpRight, Wifi } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import BandwidthCalculatorTool from "@/landing/components/BandwidthCalculatorTool";

export const metadata = pageMetadata(
  "Bandwidth calculator",
  "Transfer time, capacity, and required speed — a free bandwidth calculator for ISP operators. Nothing you type leaves your browser.",
  { canonical: "/bandwidth-calculator" }
);

export default function BandwidthCalculatorPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Free tools"
            title="Bandwidth calculator"
            body={
              <>
                Work out how long a transfer takes, what you can move in a window,
                or the speed a plan actually needs. Pure arithmetic, done in your browser.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <BandwidthCalculatorTool />
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Why operators reach for this</h2>
            <p>
              <strong>Plan design:</strong> a residential plan sold as &ldquo;unlimited&rdquo;
              still needs a fair-use ceiling that a busy household cannot hit by accident —
              the calculator turns a plan&apos;s Mbps into the GB a day it actually allows.
            </p>
            <p>
              <strong>Backhaul sizing:</strong> when a tower or estate shares one uplink, the
              question is how much traffic the window can carry at the committed speed. That
              number is the difference between a plan that works and churn in week three.
            </p>
            <p>
              <strong>Setting expectations:</strong> the same 20&nbsp;Mbps that streams fine
              still takes hours to move a large backup. Telling a subscriber &ldquo;that will
              take about three hours&rdquo; saves a support ticket before it happens.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Free tools"
        title="From a number to a managed network"
        subtitle="A calculator answers the question — the platform is where the plans, quotas, and usage actually run."
        items={[
          {
            href: "/speedtest",
            icon: <Wifi size={19} aria-hidden="true" />,
            title: "Speed test",
            body: "Measure download, upload, ping and jitter against our server.",
            action: "Run the test",
          },
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
        ]}
      />
    </>
  );
}