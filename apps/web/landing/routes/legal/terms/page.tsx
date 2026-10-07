import { CheckCircle2 } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";

export const metadata = pageMetadata(
  "Terms",
  "The terms that apply when operators use the MylesNet platform.",
  { canonical: "/legal/terms" }
);

export default function TermsPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Legal"
            title="Terms of use"
            body={<>These terms govern the use of the MylesNet platform by operators.</>}
            tags={[
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Secure credentials
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Accurate business information
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Lawful platform use
              </>,
            ]}
          />
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

            <h2>Access and commercial terms</h2>
            <p>
              Access periods, renewal, suspension, support, and any trial
              arrangements will be described in the applicable order or written
              quote. We will identify any implementation, configuration, or
              other service charges in writing before that work begins.
            </p>

            <h2>Fees and billing</h2>
            <p>
              Fees, calculation basis, invoice timing, payment methods, taxes,
              and any minimums are those stated in the order or written quote
              accepted by you. Public pricing examples and currency conversions
              are estimates and do not replace those agreed commercial terms.
              Any included implementation or support scope, and any associated
              fees, will be described in the applicable order or quote.
            </p>

            <h2>Support and issue resolution timelines</h2>
            <p>
              We acknowledge support tickets within 24 business hours. Resolution
              timelines depend on complexity: critical service outages are addressed
              continuously until restored, standard issues are typically resolved
              within 3 to 5 business days, and specialised integrations or
              dependencies on third-party vendors may extend up to 10 business
              days. These timelines pause whenever we are waiting for information,
              approvals, or access from you.
            </p>

            <h2>Templates and customization requests</h2>
            <p>
              The System ships with default communication, invoice, and portal
              templates that are provided &quot;as is&quot; and fit the most common ISP
              workflows. If you prefer an alternative look or flow, you may request
              a new template and we will queue it with other roadmap items. Template
              redesigns are not prioritized by default and will only receive
              priority handling when covered by a paid customization engagement or
              a separately agreed fee.
            </p>

            <h2>Payment responsibility and indemnification</h2>
            <p>
              You are solely responsible for verifying the accuracy of account
              numbers and payment instructions when sending us fees or when
              remitting payments to your subscribers through the System. You agree
              to indemnify, defend, and hold MylesCorp Technologies harmless from
              any claims, charge-backs, penalties, or losses that arise from
              payments sent to an incorrect or unauthorised account number,
              whether caused by user error or by third parties acting on your
              behalf.
            </p>

            <h2>Billing system misuse and indemnification</h2>
            <p>
              The System is provided to assist you in managing your ISP operations,
              including subscriber billing, payment collection, and account
              management. You are solely responsible for how you use the System
              and for all actions taken through your account. You agree not to use
              the System to:
            </p>
            <ul>
              <li>
                Overcharge, double-bill, or apply fraudulent fees to your
                subscribers
              </li>
              <li>
                Collect payments for services not rendered or misrepresent
                billing amounts
              </li>
              <li>
                Manipulate billing records, invoices, or payment data for
                unlawful gain
              </li>
              <li>
                Use the System in any manner that violates applicable consumer
                protection, telecommunications, or financial regulations
              </li>
            </ul>
            <p>
              You agree to indemnify, defend, and hold MylesCorp Technologies,
              its directors, employees, and affiliates harmless from and against
              any and all claims, demands, lawsuits, damages, losses, fines,
              penalties, liabilities, costs, and expenses (including reasonable
              legal fees) arising out of or related to your misuse of the billing
              system, any fraudulent or unauthorised billing practices conducted
              through your account, or any breach of applicable laws or regulations
              in connection with your use of the System. This indemnification
              obligation survives termination of these Terms.
            </p>

            <h2>A few disclaimers</h2>
            <p>
              We strive to provide a reliable System, but please understand that
              we offer it &quot;as is&quot; and cannot guarantee its absolute perfection.
              We disclaim any warranties, express or implied, including but not
              limited to, those related to merchantability, fitness for a
              particular purpose, or non-infringement. Additionally, we can&apos;t
              be held responsible for internet downtimes, router malfunctions, or
              other issues caused by you, your employees, or third-party equipment.
            </p>

            <h2>Being a responsible user</h2>
            <p>
              As a System user, you&apos;re responsible for maintaining the
              security of your account and password. Any activity that occurs under
              your account falls under your responsibility. You also agree to use
              the System for lawful purposes only and in accordance with these
              Terms.
            </p>

            <h2>Termination</h2>
            <p>
              We reserve the right to terminate your access to the System and
              these Terms at any time, for any reason, with or without notice.
              Similarly, you may terminate these Terms by discontinuing your use
              of the System.
            </p>

            <h2>Understanding our limitations</h2>
            <p>
              In the unfortunate event of issues arising from your use of the
              System, we won&apos;t be held liable for any damages, including but
              not limited to, direct, indirect, incidental, consequential, or
              punitive damages.
            </p>

            <h2>Governing laws and agreements</h2>
            <p>
              These Terms will be governed by and construed in accordance with
              the laws of Kenya, without regard to its conflict of laws
              provisions. These Terms constitute the entire agreement between
              you and us regarding your use of the System.
            </p>

            <h2>Keeping up with changes</h2>
            <p>
              We may modify these Terms at any time, and we&apos;ll keep you
              informed by posting the revised Terms on the System. Your continued
              use of the System after the revised Terms are posted signifies your
              agreement to be bound by the revised Terms.
            </p>

            <h2>Feature requests and product direction</h2>
            <p>
              We welcome ideas for new functionality, but we will only ship
              features that align with the company&apos;s product direction and
              current roadmap. Feature work is prioritised according to our
              development capacity and existing commitments. Paid feature
              sponsorship or enterprise agreements may accelerate delivery, but
              all such work remains subject to our technical feasibility review
              and scheduling.
            </p>

            <h2>Questions</h2>
            <p>
              Use the current official contact channel published by MylesCorp
              Technologies for your account. Never send passwords, OTPs, recovery
              codes, payment PINs, API keys, or router credentials with a legal
              or commercial inquiry.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
