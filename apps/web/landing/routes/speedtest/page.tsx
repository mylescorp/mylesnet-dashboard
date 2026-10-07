import { ArrowUpRight, Wifi } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";
import SpeedTestTool from "@/landing/components/SpeedTestTool";

export const metadata = pageMetadata(
  "Speed test",
  "Download, upload, ping and jitter in one run — measured against MylesNet's own server.",
  { canonical: "/speedtest" }
);

export default function SpeedTestPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Free tools"
            title="Speed test"
            body={
              <>
                Download, upload, ping and jitter in one run. No account, no signup, nothing
                stored — the numbers stay in your browser.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <SpeedTestTool />
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Reading the four numbers</h2>
            <p>
              <strong>Download</strong> is how fast data arrives — streaming, downloads, and every
              page your subscribers load. <strong>Upload</strong> is the other direction: video
              calls, cash-in transactions, and the traffic a busy household sends back upstream.
              Upload is usually the smaller of the two and often the first to feel crowded.
            </p>
            <p>
              <strong>Ping</strong> is the round-trip time for a tiny message, in milliseconds.
              It is what makes a connection feel responsive or sluggish even when throughput is
              fine — under about 30&nbsp;ms feels immediate, over 150&nbsp;ms starts to drag.
            </p>
            <p>
              <strong>Jitter</strong> is how much that round-trip time varies between samples.
              Low throughput with high jitter still breaks calls and streams, so it is worth
              watching when a network is busy rather than when it is slow.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="Free tools"
        title="Numbers are the start, not the work"
        subtitle="A test tells you what the link is doing now — the platform is where you see what it does every day."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/resources/mikrotik-router-monitoring",
            icon: <Wifi size={19} aria-hidden="true" />,
            title: "MikroTik monitoring",
            body: "What to watch on every router, and which signals warn first.",
            action: "Read the guide",
          },
        ]}
      />
    </>
  );
}