import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LandingCardVariant = "default" | "link" | "step" | "compact" | "hero";

type LandingCardOwnKeys =
  | "variant"
  | "icon"
  | "step"
  | "eyebrow"
  | "title"
  | "titleAs"
  | "titleId"
  | "body"
  | "meta"
  | "footer"
  | "outcomes"
  | "tags"
  | "children"
  | "className"
  | "popular";

type LandingCardBaseProps = {
  variant?: LandingCardVariant;
  icon?: ReactNode;
  step?: string | number;
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Heading rank for `title`. Hero/banner cards pass "h1"; default is "h3". */
  titleAs?: "h1" | "h2" | "h3";
  /** id on the rendered title, so sections can wire aria-labelledby. */
  titleId?: string;
  body?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  /** Checked outcome lines rendered under the card body. */
  outcomes?: ReactNode[];
  /** Short chip labels rendered under the card body. */
  tags?: ReactNode[];
  children?: ReactNode;
  className?: string;
  popular?: boolean;
};

type LandingCardAsDiv = LandingCardBaseProps &
  Omit<ComponentPropsWithoutRef<"div">, LandingCardOwnKeys | "href"> & {
    href?: undefined;
  };

type LandingCardAsLink = LandingCardBaseProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, LandingCardOwnKeys> & {
    href: string;
  };

export type LandingCardProps = LandingCardAsDiv | LandingCardAsLink;

function cardClassName({
  variant,
  popular,
  interactive,
  className,
}: {
  variant: LandingCardVariant;
  popular?: boolean;
  interactive: boolean;
  className?: string;
}) {
  return cn(
    "landing-card",
    variant === "step" && "landing-card-step",
    variant === "compact" && "landing-card-compact",
    variant === "hero" && "landing-card-hero",
    variant === "link" && "landing-card-linkable",
    interactive && "landing-card-interactive",
    popular && "landing-card-popular",
    className
  );
}

export default function LandingCard(props: LandingCardProps) {
  const {
    variant = props.href ? "link" : "default",
    icon,
    step,
    eyebrow,
    title,
    titleAs,
    titleId,
    body,
    meta,
    footer,
    outcomes,
    tags,
    children,
    className,
    popular,
    ...rest
  } = props;

  const Heading = titleAs ?? "h3";
  const titleNode = title ? (
    <Heading id={titleId} className="landing-card-title">
      {title}
    </Heading>
  ) : null;
  const eyebrowNode = eyebrow ? (
    <p className="landing-card-eyebrow">{eyebrow}</p>
  ) : null;
  // Hero cards read eyebrow → title (kicker above the heading, as banners do);
  // every other variant keeps the title → eyebrow order it shipped with.
  const headingPair =
    variant === "hero" ? (
      <>
        {eyebrowNode}
        {titleNode}
      </>
    ) : (
      <>
        {titleNode}
        {eyebrowNode}
      </>
    );

  const heading = title || eyebrow ? (
    icon ? (
      <div className="landing-card-head-row">
        <span className="landing-card-icon">{icon}</span>
        <div>{headingPair}</div>
      </div>
    ) : (
      headingPair
    )
  ) : null;

  const content = (
    <>
      {meta ? <div className="landing-card-meta">{meta}</div> : null}
      {step != null ? <span className="landing-card-step-num">{step}</span> : null}
      {heading ?? (icon ? <span className="landing-card-icon">{icon}</span> : null)}
      {body != null ? <div className="landing-card-body">{body}</div> : null}
      {outcomes?.length ? (
        <ul className="landing-card-outcomes">
          {outcomes.map((outcome, index) => (
            <li key={index}>
              <CheckCircle2 size={17} aria-hidden="true" />
              {outcome}
            </li>
          ))}
        </ul>
      ) : null}
      {tags?.length ? (
        <ul className="landing-card-tags">
          {tags.map((tag, index) => (
            <li key={index}>{tag}</li>
          ))}
        </ul>
      ) : null}
      {children}
      {footer ? <div className="landing-card-footer">{footer}</div> : null}
    </>
  );

  if ("href" in props && props.href) {
    const { href, ...linkRest } = rest as Omit<
      ComponentPropsWithoutRef<typeof Link>,
      LandingCardOwnKeys
    >;
    return (
      <Link
        href={href}
        className={cardClassName({
          variant,
          popular,
          interactive: true,
          className,
        })}
        {...linkRest}
      >
        {content}
      </Link>
    );
  }

  const divRest = rest as Omit<LandingCardAsDiv, LandingCardOwnKeys | "href">;
  return (
    <div
      className={cardClassName({
        variant,
        popular,
        interactive: false,
        className,
      })}
      {...divRest}
    >
      {content}
    </div>
  );
}
