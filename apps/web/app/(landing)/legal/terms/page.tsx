import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms that apply when operators use the MylesNet platform.",
};

export default function TermsPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <p className="landing-section-kicker">Legal</p>
          <h1>Terms of use</h1>
          <p>
            These terms govern the use of the MylesNet platform by operators.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-prose">
            <h2>About this agreement</h2>
            <p>
              MylesCorp Technologies Ltd provides the MylesNet platform to
              operators. By using the platform you agree to these terms. If you
              are using the platform on behalf of a business, you confirm that
              you have authority to agree to these terms for that business.
            </p>

            <h2>What the platform is for</h2>
            <p>
              The platform helps operators manage customers, plans, payments,
              communications, and network operations. Operators remain
              responsible for their own business decisions and for their
              relationships with their customers.
            </p>

            <h2>Operator responsibilities</h2>
            <ul>
              <li>
                Keep account credentials secure and do not share them
                inappropriately.
              </li>
              <li>
                Provide accurate business information and keep it updated.
              </li>
              <li>
                Use the platform lawfully and respect the rights of end
                customers.
              </li>
              <li>
                Not attempt to disrupt the platform or interfere with other
                operators&apos; use of it.
              </li>
            </ul>

            <h2>Changes to the platform and these terms</h2>
            <p>
              The platform may be updated over time, and these terms may be
              revised. Continued use of the platform after a change takes effect
              indicates acceptance of the updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms can be directed to the MylesNet team
              through the contact details provided on this site.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}