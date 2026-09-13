import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getCompanyContact } from "../content/contact";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Tell us about your network and we will help you choose the right starting point with MylesNet.",
};

const START_STEPS: { step: string; title: string; description: string }[] = [
  {
    step: "1",
    title: "Tell us about your network",
    description:
      "How many customers you serve, which plan types you offer, and how you operate today.",
  },
  {
    step: "2",
    title: "See it on your own numbers",
    description:
      "We walk through customer management, packages, and payments with your setup — so you can judge the fit before anything is committed.",
  },
  {
    step: "3",
    title: "Go live together",
    description:
      "Add your customers, plans, and network devices when the timing is right for you, with our team alongside the whole way.",
  },
];

export default function GetStartedPage() {
  const contact = getCompanyContact();
  const hasContact = Boolean(contact.salesEmail || contact.contactEmail || contact.infoEmail || contact.salesPhone || contact.technicalPhone);

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Get started</p>
          <h1>Let us help you get running</h1>
          <p className="landing-banner-lead">
            Every network starts differently. Tell us what you operate and we will
            walk you through the best way to bring MylesNet on board and get your
            first customers live.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>A simple starting point</h2>
            <ul>
              {START_STEPS.map((step) => (
                <li key={step.step}>
                  <strong>Step {step.step} — {step.title}.</strong> {step.description}
                </li>
              ))}
            </ul>
            <p>
              There is no setup experience required on your side. We handle the
              technical details so you can focus on your customers.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Reach our team</h2>
            <p>
              The fastest way in is to tell us a little about your network. Pick the
              channel that suits you below.
            </p>
          </div>
          <div className="landing-grid" style={{ marginTop: 28 }}>
            {contact.salesEmail ? (
              <div className="landing-card">
                <h3 className="landing-card-title">Sales enquiries</h3>
                <p className="landing-card-body">
                  Talk to our sales and marketing team about pricing, demos, and
                  getting started.
                </p>
                <a className="landing-card-link" href={`mailto:${contact.salesEmail}`}>
                  {contact.salesEmail}
                </a>
              </div>
            ) : null}
            {contact.contactEmail ? (
              <div className="landing-card">
                <h3 className="landing-card-title">General enquiries</h3>
                <p className="landing-card-body">
                  For general questions about MylesNet and what it can do.
                </p>
                <a className="landing-card-link" href={`mailto:${contact.contactEmail}`}>
                  {contact.contactEmail}
                </a>
              </div>
            ) : null}
            {contact.infoEmail ? (
              <div className="landing-card">
                <h3 className="landing-card-title">Information</h3>
                <p className="landing-card-body">
                  For company and product information outside sales.
                </p>
                <a className="landing-card-link" href={`mailto:${contact.infoEmail}`}>
                  {contact.infoEmail}
                </a>
              </div>
            ) : null}
            {contact.salesPhone ? (
              <div className="landing-card">
                <h3 className="landing-card-title">Call sales</h3>
                <p className="landing-card-body">
                  Prefer to talk? Call our sales team during business hours.
                </p>
                <a className="landing-card-link" href={`tel:${contact.salesPhone}`}>
                  {contact.salesPhone}
                </a>
              </div>
            ) : null}
            {contact.technicalPhone ? (
              <div className="landing-card">
                <h3 className="landing-card-title">Technical support</h3>
                <p className="landing-card-body">
                  Existing networks with an implementation or technical question.
                </p>
                <a className="landing-card-link" href={`tel:${contact.technicalPhone}`}>
                  {contact.technicalPhone}
                </a>
              </div>
            ) : null}
          </div>
          {!hasContact ? (
            <p className="landing-prose" style={{ marginTop: 24, color: "var(--muted)" }}>
              Contact details are being prepared. Please check back shortly.
            </p>
          ) : (
            <p className="landing-prose" style={{ marginTop: 24, color: "var(--muted)" }}>
              <CheckCircle2 size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle", color: "var(--success)" }} />
              We aim to respond to every enquiry promptly.
            </p>
          )}
        </div>
      </section>
    </>
  );
}