import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { howItWorksSteps } from "@/landing/content/how-it-works";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "How MylesNet works",
  "A plain-language walkthrough of how MylesNet brings customers, packages, payments, and network operations together.",
  { canonical: "/resources/how-it-works" }
);

export default function HowItWorksPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Resources"
            title="How MylesNet works"
            body={
              <>
                A plain-language look at how the platform supports the day-to-day work of
                running an internet service — and what each area means in practice.
              </>
            }
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-how-steps">
            {howItWorksSteps.map((step) => (
              <LandingCard
                key={step.step}
                variant="step"
                step={step.step}
                title={step.title}
                body={
                  <>
                    {step.about}{" "}
                    <strong>In practice:</strong> {step.inPractice}
                  </>
                }
              />
            ))}
          </div>

          <div className="landing-prose landing-prose-spaced">
            <p>
              These areas work together as <strong>one platform</strong> — not five
              separate systems bolted on. That shared record of truth is what keeps an
              operation running smoothly as it grows.
            </p>
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="How it works"
        title="See it on your own network"
        subtitle="These areas work together as one platform — that shared record of truth is what keeps an operation running smoothly as it grows."
        items={[
          {
            href: "/get-started",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Get started",
            body: "Walk through the platform with our team on your own setup.",
            action: "Start a conversation",
          },
          {
            href: "/features/customer-management",
            icon: <LayoutDashboard size={19} aria-hidden="true" />,
            title: "Browse features",
            body: "Read what each area covers and where it stands today.",
            action: "See all features",
          },
        ]}
      />
    </>
  );
}
