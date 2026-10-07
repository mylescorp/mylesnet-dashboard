import { ArrowUpRight, CheckCircle2, Mail, Phone, PlayCircle } from "lucide-react";
import Link from "next/link";
import { getCompanyContact } from "@/landing/content/contact";
import { COMPANY_LEADERSHIP, MYLESCORP, MYLESNET_STORY } from "@/landing/content/company";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";
import LandingCtaSection from "@/landing/components/LandingCtaSection";

export const metadata = pageMetadata(
  "Get started",
  "Tell us about your network and we will help you choose the right starting point with MylesNet.",
  { canonical: "/get-started" }
);

const START_STEPS: {
  step: string;
  title: string;
  description: string;
  outcomes: string[];
}[] = [
  {
    step: "1",
    title: "Tell us about your network",
    description:
      "How many customers you serve, which plan types you offer, and how you operate today.",
    outcomes: [
      "Subscriber count and plan mix",
      "Current billing and payment method",
      "Network equipment in use",
    ],
  },
  {
    step: "2",
    title: "See it on your own numbers",
    description:
      "We walk through customer management, packages, and payments with your setup — so you can judge the fit before anything is committed.",
    outcomes: [
      "A live walkthrough, not a slide deck",
      "Your plan and pricing structure",
      "An honest answer on fit",
    ],
  },
  {
    step: "3",
    title: "Go live together",
    description:
      "Add your customers, plans, and network devices when the timing is right for you, with our team alongside the whole way.",
    outcomes: [
      "Guided subscriber and plan setup",
      "Device and network onboarding",
      "Ongoing support from a named owner",
    ],
  },
];

export default function GetStartedPage() {
  const contact = getCompanyContact();
  const configuredChannels = [
    {
      id: "sales-email" as const,
      icon: <Mail size={18} aria-hidden="true" />,
      title: "Sales enquiries",
      body: "Demos, pricing, and getting a new network started on MylesNet.",
      value: contact.salesEmail,
      href: contact.salesEmail ? `mailto:${contact.salesEmail}` : null,
    },
    {
      id: "contact-email" as const,
      icon: <Mail size={18} aria-hidden="true" />,
      title: "General enquiries",
      body: "Anything about MylesNet that is not a sales conversation.",
      value: contact.contactEmail,
      href: contact.contactEmail ? `mailto:${contact.contactEmail}` : null,
    },
    {
      id: "sales-phone" as const,
      icon: <Phone size={18} aria-hidden="true" />,
      title: "Call sales and marketing",
      body: `${COMPANY_LEADERSHIP[1].name} — sales conversations and onboarding questions.`,
      value: contact.salesPhone,
      href: contact.salesPhone ? `tel:${contact.salesPhone}` : null,
    },
    {
      id: "technical-phone" as const,
      icon: <Phone size={18} aria-hidden="true" />,
      title: "Technical and implementation",
      body: `${COMPANY_LEADERSHIP[0].name} — network setup, access, and escalations.`,
      value: contact.technicalPhone,
      href: contact.technicalPhone ? `tel:${contact.technicalPhone}` : null,
    },
  ].filter((channel) => channel.value && channel.href);
  const hasContact = configuredChannels.length > 0;

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Get started"
            title="Let us help you get running"
            body={
              <>
                Every network starts differently. Tell us what you operate and we
                will walk you through the best way to bring MylesNet on board and get
                your first customers live.
              </>
            }
            tags={[
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                No setup work on your side
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Named owner throughout
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Based in {MYLESCORP.location}
              </>,
            ]}
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>A simple starting point</h2>
            <p>
              {MYLESNET_STORY.mission}
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {START_STEPS.map((step) => (
              <LandingCard
                key={step.step}
                variant="step"
                step={step.step}
                title={step.title}
                body={step.description}
                outcomes={step.outcomes}
              />
            ))}
          </div>
          <p className="landing-prose landing-prose-note">
            There is no setup experience required on your side. We handle the
            technical details so you can focus on your customers.
          </p>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Reach our team</h2>
            <p>
              The fastest way in is to tell us a little about your network. Pick
              the channel that suits you below — each one is owned by a named
              person.
            </p>
            {hasContact ? (
              <p className="landing-prose-note">
                <CheckCircle2
                  className="landing-icon-inline landing-icon-success"
                  size={16}
                />
                We aim to respond to every enquiry promptly.
              </p>
            ) : (
              <p className="landing-prose-note">
                Contact details are configured per deployment environment. If
                these cards are empty, the company contact variables are not set
                for this environment.
              </p>
            )}
          </div>
          <div className="landing-grid landing-grid-spaced">
            {configuredChannels.map((channel) => (
              <LandingCard
                key={channel.id}
                icon={channel.icon}
                title={channel.title}
                body={channel.body}
                footer={
                  <a className="landing-card-link" href={channel.href ?? "#"}>
                    {channel.value}
                  </a>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <LandingCtaSection
        kicker="While you decide"
        title="Worth reading first"
        subtitle="If you would rather understand the platform before talking to anyone, these two are the fastest way in."
        items={[
          {
            href: "/resources/how-it-works",
            icon: <PlayCircle size={19} aria-hidden="true" />,
            title: "How MylesNet works",
            body: "A walk through an operator's day across subscribers, billing, network, and reporting.",
            action: "Read the walkthrough",
          },
          {
            href: "/company/about",
            icon: <ArrowUpRight size={19} aria-hidden="true" />,
            title: "Who we are",
            body: `The company behind ${MYLESNET_STORY.name}, our mission, and the principles we build by.`,
            action: "About MylesNet",
          },
        ]}
        alt={true}
        altText={
          <>
            Still deciding between plans? <Link href="/pricing">Compare pricing</Link>{" "}
            side by side first.
          </>
        }
      />
    </>
  );
}
