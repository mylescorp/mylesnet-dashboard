import { CheckCircle2 } from "lucide-react";
import { pageMetadata } from "@/landing/content/seo";
import LandingCard from "@/landing/components/LandingCard";

export const metadata = pageMetadata(
  "Privacy",
  "How MylesNet handles customer, operator, and usage information.",
  { canonical: "/legal/privacy" }
);

export default function PrivacyPage() {
  return (
    <>
      <section className="landing-page-banner">
        <div className="landing-page-banner-inner">
          <LandingCard
            variant="hero"
            titleAs="h1"
            eyebrow="Legal"
            title="Privacy"
            body={
              <>
                This page explains, in plain language, how MylesNet handles
                information as part of running the platform.
              </>
            }
            tags={[
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Operator account required
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Encrypted in transit
              </>,
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                Protected settings
              </>,
            ]}
          />
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

            <h2>Staff access protocol</h2>
            <p>
              Our staff access protocol limits technical support access to
              authorized personnel for system debugging and support resolution.
              This is separate from access by authorized workspace operators.
              Each debugging session is thoroughly documented, including the
              reason for access, duration, and actions taken. This ensures
              complete transparency and maintains the integrity of our privacy
              commitment.
            </p>

            <h2>No contact policy</h2>
            <p>
              MylesCorp Technologies maintains a strict no-contact policy
              regarding customer communications. We do not initiate contact with
              your clients for marketing, promotional, or sales purposes. Our
              communication is limited to:
            </p>
            <ul>
              <li>Automated billing notifications</li>
              <li>System maintenance alerts</li>
              <li>Direct responses to customer-initiated support requests</li>
              <li>Legal or service-affecting notifications</li>
            </ul>

            <h2>Data protection measures</h2>
            <p>
              We implement comprehensive security measures to protect your
              information. All data is encrypted using industry-standard protocols
              during transmission and storage. Our security infrastructure
              includes:
            </p>
            <ul>
              <li>Multi-layer firewall protection</li>
              <li>Regular security audits and updates</li>
              <li>Strict access control protocols</li>
              <li>Continuous system monitoring</li>
              <li>Secure data backup systems</li>
            </ul>

            <h2>Data sharing</h2>
            <p>
              MylesCorp does not sell customer data or share it with advertising
              or marketing agencies. We share information only with the service
              providers needed to run the features you use: the payment processors
              described below, the hosting and database providers that store the
              billing system on our behalf, and the connected AI services
              described in the next section.
            </p>

            <h2>Connected AI services (MCP)</h2>
            <p>
              An ISP workspace can connect an external AI service, such as
              ChatGPT, Claude or Codex, to its billing system through our Model
              Context Protocol (MCP) server at
              https://mcp.mylesnet.africa/mcp. The AI service can then call
              tools that read the workspace&apos;s billing data or request actions.
              This section explains what that connection collects, why, who
              receives it, how long it is kept and how to control it.
            </p>

            <h3>What we collect</h3>
            <ul>
              <li>
                Connection records. When an operator connects a service, we
                record which service it is (for example &quot;ChatGPT&quot;), the workspace,
                the operator who approved it, when it was connected and when it
                expires. If the operator uses an API key instead, we record the
                key&apos;s name, when it was created and when it was last used.
                Keys and tokens are stored hashed or signed, never in plain text.
              </li>
              <li>
                Tool inputs. These are the values the AI service sends with
                each tool call, such as a subscriber&apos;s name, phone number or
                account number to look up, a date range, a router, or an IP
                address.
              </li>
              <li>
                Tool outputs. These are the results we send back. Depending on
                the tool and the operator&apos;s permissions, they can include
                subscriber names and contact details, account, package and
                expiry information, payment amounts and references, invoices,
                data usage and session history, support tickets, voucher stock,
                and router status, logs and configuration. Router passwords and
                other credentials are removed before any router output is
                returned.
              </li>
              <li>
                Request logs. Our web servers log each request&apos;s IP address,
                user agent, time, path and response status. They do not log
                request or response bodies.
              </li>
            </ul>

            <h3>Why we use it</h3>
            <ul>
              <li>
                To answer the request the operator made through the AI service,
                and nothing else.
              </li>
              <li>
                To authenticate the connection and apply the operator&apos;s
                existing permissions, so a tool never returns data the operator
                could not see in the billing app.
              </li>
              <li>
                To hold requested actions (reconnecting or disconnecting a
                subscriber, creating or changing a subscriber, blocking or
                unblocking an IP address, applying a router fix) until an
                authorized operator confirms them. The AI service cannot carry
                out these actions by itself.
              </li>
              <li>
                To keep the service secure: rate limiting, detecting abuse and
                troubleshooting failures.
              </li>
            </ul>
            <p>
              We do not use tool inputs or outputs to train AI models, for
              advertising, or to build profiles of subscribers.
            </p>

            <h3>Who receives it</h3>
            <ul>
              <li>
                The AI service the operator connected receives the tool outputs
                and handles them under its own terms and privacy policy, for
                example OpenAI&apos;s for ChatGPT.
              </li>
              <li>
                ipinfo.io receives an IP address, and nothing else, when the IP
                lookup tool is used, so it can return that address&apos;s network
                owner and location.
              </li>
              <li>
                An AI provider (Anthropic or OpenRouter) receives router
                diagnostic data when the MikroTik diagnosis tool asks for a
                written explanation of its findings.
              </li>
              <li>
                Our hosting and database providers store connection records and
                saved requests on our behalf, under contracts that require them
                to protect the data.
              </li>
            </ul>
            <p>
              No other party receives MCP data.
            </p>

            <h3>How long we keep it</h3>
            <ul>
              <li>
                Tool inputs and outputs for read tools are used to answer the
                request and are not stored by MylesCorp afterwards.
              </li>
              <li>
                Access tokens expire after 1 hour. Connections and refresh tokens
                expire after 30 days unless they are disconnected sooner.
                Unfinished connection attempts are deleted one day after they
                expire.
              </li>
              <li>
                Requested actions are saved, with their inputs and whether they
                were confirmed, in the workspace&apos;s AI Chat under &quot;MCP
                session&quot;. Diagnosis audits and findings and any AI explanation
                are saved in the workspace too. Both are kept while the workspace
                account is active and are deleted with it, as described in Data
                Retention and Management.
              </li>
              <li>
                Web server request logs are kept for 14 days.
              </li>
              <li>
                Information already sent to an AI service is kept according to
                that service&apos;s policy. Disconnecting stops future access; it
                does not delete what the service already received.
              </li>
            </ul>

            <h3>Your controls</h3>
            <ul>
              <li>
                Only operators whose role includes the AI Chat permission can
                connect a service, and a workspace administrator can remove
                that permission from any role.
              </li>
              <li>
                An operator can see and disconnect their connected services at
                any time at /mcp/oauth/connections on their billing domain.
                Disconnecting takes effect immediately.
              </li>
              <li>
                API keys can be deleted in the billing app under Settings →
                Developer. A deleted key stops working immediately.
              </li>
              <li>
                Every requested action waits for an operator to confirm or
                reject it in AI Chat.
              </li>
              <li>
                Use the AI service&apos;s own settings to delete conversations
                or data it holds.
              </li>
              <li>
                Workspaces can use the rights listed under Customer Rights,
                including a report or export of their stored data and deletion
                on termination.
              </li>
            </ul>

            <h2>Diagnostic features</h2>
            <p>
              Some diagnostic features, inside the billing app and through MCP,
              send diagnostic context to a configured AI provider to generate
              explanations. MylesCorp saves diagnostic audits and findings, and
              may save the associated AI interaction. A diagnostic request does
              not change router configuration.
            </p>

            <h2>Data retention and management</h2>
            <p>
              We retain customer data only for the duration necessary to provide
              services and comply with legal requirements. Upon service
              termination, non-essential data is securely deleted from our
              systems. Financial records are maintained according to applicable
              laws and regulations, with strict security protocols governing
              their storage.
            </p>

            <h2>Customer rights</h2>
            <p>
              As a MylesCorp Technologies customer, you maintain control over
              your personal information. You have the right to:
            </p>
            <ul>
              <li>
                Request a comprehensive report of your stored data
              </li>
              <li>
                Correct any inaccurate information
              </li>
              <li>
                Export your data in a standard format
              </li>
              <li>
                Request deletion of your information upon service termination
              </li>
              <li>
                Receive notification of any security incidents affecting your
                data
              </li>
            </ul>

            <h2>Compliance and updates</h2>
            <p>
              This privacy policy complies with current data protection
              regulations and industry standards. We regularly review and update
              our privacy practices to ensure continued compliance and optimal
              data protection. This policy was last updated on 24 September
  2026.
            </p>

            <h2>Payment data protection</h2>
            <p>
              We implement additional security measures specifically for
              payment-related data:
            </p>
            <ul>
              <li>
                Payment card information is encrypted using PCI DSS compliant
                protocols
              </li>
              <li>
                Bank account details are stored with enhanced encryption
                standards
              </li>
              <li>
                Payment processing logs are maintained with restricted access
              </li>
              <li>
                Automated monitoring systems detect unusual payment patterns
              </li>
              <li>
                Regular PCI compliance audits are conducted
              </li>
            </ul>

            <h2>Financial data retention</h2>
            <p>
              Our financial data retention policies include:
            </p>
            <ul>
              <li>
                Transaction records are maintained for 7 years as per
                regulatory requirements
              </li>
              <li>
                Payment method details are stored securely only until account
                closure
              </li>
              <li>
                Audit logs of financial transactions are preserved for compliance
                purposes
              </li>
              <li>
                Automated data purging occurs after retention periods expire
              </li>
            </ul>

            <h2>Automated billing data processing</h2>
            <p>
              Our billing system employs automated processing to ensure accuracy
              and efficiency:
            </p>
            <ul>
              <li>
                Usage data is automatically collected and processed for billing
                purposes
              </li>
              <li>
                Automated notifications are sent for payment due dates, successful
                payments, and failed transactions
              </li>
              <li>
                System algorithms analyze usage patterns for billing accuracy and
                the reporting and diagnostic features described above
              </li>
              <li>
                Automated data validation checks ensure billing information
                integrity
              </li>
              <li>
                All automated processes are regularly audited for compliance and
                accuracy
              </li>
            </ul>

            <h2>Third-party payment processors</h2>
            <p>
              When using third-party payment processors:
            </p>
            <ul>
              <li>
                We select only PCI-compliant payment processors with strong
                security records
              </li>
              <li>
                Minimal necessary information is shared with payment processors
                to complete transactions
              </li>
              <li>
                We maintain contractual agreements requiring processors to
                protect your data
              </li>
              <li>
                Payment processor interactions are logged and monitored
              </li>
              <li>
                We regularly review and assess the security practices of our
                payment partners
              </li>
            </ul>

            <h2>Data breach response protocol</h2>
            <p>
              In the unlikely event of a data breach affecting billing
              information:
            </p>
            <ul>
              <li>
                We will notify affected customers within 72 hours of breach
                confirmation
              </li>
              <li>
                Detailed information about the breach scope and affected data
                will be provided
              </li>
              <li>
                We will cooperate fully with law enforcement and regulatory
                authorities
              </li>
              <li>
                Remediation steps will be implemented immediately to prevent
                further exposure
              </li>
              <li>
                Credit monitoring services may be provided for affected
                customers when appropriate
              </li>
            </ul>

            <h2>Billing system access logs</h2>
            <p>
              Our billing system maintains detailed access logs:
            </p>
            <ul>
              <li>
                All administrator access to billing data is logged with timestamps
                and action details
              </li>
              <li>
                Customer account access is recorded for security monitoring
              </li>
              <li>
                Failed login attempts are monitored and flagged for security
                review
              </li>
              <li>
                Access logs are retained for as long as your account is active
              </li>
              <li>
                Regular access pattern analysis is conducted to detect potential
                security issues
              </li>
            </ul>

            <h2>Contact information</h2>
            <p>
              For privacy questions or requests, including anything about
              connected AI services, email sales@mylesnet.africa. Do not send
              passwords, OTPs, API secrets, payment PINs, or unnecessary customer
              records by email or chat.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}