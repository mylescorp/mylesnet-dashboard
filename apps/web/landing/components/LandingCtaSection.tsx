import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import SectionHead from "@/landing/components/SectionHead";
import LandingCard from "@/landing/components/LandingCard";

export type LandingCtaCard = {
  href: string;
  title: string;
  body: string;
  /** Action label rendered in the card footer. Defaults to `title`. */
  action?: string;
  icon: ReactNode;
};

type LandingCtaSectionProps = {
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  items: LandingCtaCard[];
  /** Render the section on the muted alternating background. */
  alt?: boolean;
  /** Short closing note rendered under the cards. */
  altText?: ReactNode;
  className?: string;
};

/**
 * Closing block for a landing page: a section head followed by one card per
 * next step. Replaces the former full-width CTA band so that every page ends
 * on the shared card system rather than a standalone block.
 */
export default function LandingCtaSection({
  kicker,
  title,
  subtitle,
  items,
  alt = true,
  altText,
  className,
}: LandingCtaSectionProps) {
  return (
    <section
      className={cn(
        "landing-section",
        "landing-cta-section",
        alt && "landing-section-alt",
        className
      )}
    >
      <div className="landing-section-inner">
        <SectionHead kicker={kicker} title={title} subtitle={subtitle} />
        <div className="landing-cta-cards">
          {items.map((item) => (
            <LandingCard
              key={item.href}
              href={item.href}
              variant="link"
              icon={item.icon}
              title={item.title}
              body={item.body}
              footer={
                <>
                  {item.action ?? item.title}
                  <ArrowRight size={15} aria-hidden="true" />
                </>
              }
            />
          ))}
        </div>
        {altText ? <p className="landing-cta-alt">{altText}</p> : null}
      </div>
    </section>
  );
}
