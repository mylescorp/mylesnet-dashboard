import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How MylesNet handles customer, operator, and usage information.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Legal</p>
          <h1>Privacy</h1>
          <p>
            This page explains, in plain language, how MylesNet handles
            information as part of running the platform.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>Information MylesNet processes</h2>
            <p>
              MylesNet is a platform operated by internet service providers. The
              information it processes is information the operator provides and
              manages on their own network:
            </p>
            <ul>
              <li>
                Customer account details such as names, contacts, and address
                information.
              </li>
              <li>
                Subscription and billing records such as plans, invoices,
                payments, and balances.
              </li>
              <li>
                Network information such as devices, usage, and session data
                needed to deliver and monitor service.
              </li>
            </ul>

            <h2>Who is responsible for this information</h2>
            <p>
              The operator running the network is responsible for the accuracy
              and lawful use of their own customer records. MylesCorp provides
              the platform and manages it securely on that basis. If you are an
              end customer of an operator, direct questions about your records
              to that operator.
            </p>

            <h2>How the platform keeps information secure</h2>
            <ul>
              <li>Access to the platform requires an operator account.</li>
              <li>
                Connections are encrypted in transit and credentials are stored
                securely.
              </li>
              <li>
                Sensitive settings are protected and only available to
                authorised operators.
              </li>
            </ul>

            <h2>Contact</h2>
            <p>
              Questions about this privacy statement can be sent to the operator
              of the network you use, or to MylesCorp through the contact
              details provided on the MylesNet site.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}