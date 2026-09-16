import { CheckCircle2, Mail, Phone } from "lucide-react";
import { getCompanyContact } from "@/landing/content/contact";
import { pageMetadata } from "@/landing/content/seo";

export const metadata = pageMetadata(
  "Contact us",
  "Reach the MylesNet team for sales enquiries, product information, and technical support.",
  { canonical: "/contact" }
);

export default function ContactPage() {
  const contact = getCompanyContact();
  const hasContact = Boolean(
    contact.salesEmail || contact.infoEmail || contact.salesPhone || contact.technicalPhone
  );

  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Contact</p>
          <h1>Contact us</h1>
          <p className="landing-banner-lead">
            Questions about MylesNet, a demo of your own numbers, or support on
            an existing network — we are happy to help.
          </p>
          <div className="landing-banner-meta">
            <span className="landing-banner-meta-item">
              <CheckCircle2 size={15} aria-hidden="true" />
              Sales enquiries
            </span>
            <span className="landing-banner-meta-item">
              <CheckCircle2 size={15} aria-hidden="true" />
              Product information
            </span>
            <span className="landing-banner-meta-item">
              <CheckCircle2 size={15} aria-hidden="true" />
              Technical support
            </span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Send us a message</h2>
            <p>
              Email is the fastest way for us to understand your network and get
              back to you with the right next step.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {contact.salesEmail ? (
              <div className="landing-card">
                <h3 className="landing-card-title">
                  <Mail className="landing-icon-inline" size={16} aria-hidden="true" />
                  Sales enquiries
                </h3>
                <p className="landing-card-body">
                  Demos, pricing, and getting a new network started on MylesNet.
                </p>
                <a className="landing-card-link" href={`mailto:${contact.salesEmail}`}>
                  {contact.salesEmail}
                </a>
              </div>
            ) : null}
            {contact.infoEmail ? (
              <div className="landing-card">
                <h3 className="landing-card-title">
                  <Mail className="landing-icon-inline" size={16} aria-hidden="true" />
                  Product information
                </h3>
                <p className="landing-card-body">
                  Company and product questions outside a specific sale.
                </p>
                <a className="landing-card-link" href={`mailto:${contact.infoEmail}`}>
                  {contact.infoEmail}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Talk to a person</h2>
            <p>
              Prefer a call? Reach the right person directly during business
              hours.
            </p>
          </div>
          <div className="landing-grid landing-grid-spaced">
            {contact.salesPhone ? (
              <div className="landing-card">
                <h3 className="landing-card-title">
                  <Phone className="landing-icon-inline" size={16} aria-hidden="true" />
                  Sales and marketing
                </h3>
                <p className="landing-card-body">
                  Pauline — sales conversations, demos, and onboarding questions.
                </p>
                <a className="landing-card-link" href={`tel:${contact.salesPhone}`}>
                  {contact.salesPhone}
                </a>
              </div>
            ) : null}
            {contact.technicalPhone ? (
              <div className="landing-card">
                <h3 className="landing-card-title">
                  <Phone className="landing-icon-inline" size={16} aria-hidden="true" />
                  Technical support
                </h3>
                <p className="landing-card-body">
                  Jonathan — implementation, technical, and existing-network
                  questions.
                </p>
                <a className="landing-card-link" href={`tel:${contact.technicalPhone}`}>
                  {contact.technicalPhone}
                </a>
              </div>
            ) : null}
          </div>
          {hasContact ? (
            <p className="landing-prose landing-prose-note">
              <CheckCircle2
                size={16}
                className="landing-icon-inline landing-icon-success"
              />
              We aim to respond to every enquiry promptly.
            </p>
          ) : (
            <p className="landing-prose landing-prose-note">
              Contact details are being prepared. Please check back shortly.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
