# MylesNet Tenant Panel: Full Feature List

Author: Jonathan Myles
Company: MylesCorp Technologies Ltd
Date: 2026-10-10
Target repo: `mylesnet-dashboard` (existing repo)
Panel: Tenant panel (ISP dashboard), route prefix `/dashboard`
Audience: AI coding agent

---

## 1. Rules for the agent (read first, follow strictly)

1. Read the root `AGENTS.md` of the repo before doing anything. If this file conflicts with `AGENTS.md`, follow `AGENTS.md` and report the conflict in your first message.
2. This is an existing repo. Audit before building: list what already exists per module below (routes, components, backend functions, schema, tests), mark each feature as Done, Partial, Broken or Missing, and write the audit to `docs/tenant-panel-audit.md`. Never duplicate what exists. Never break what works.
3. Real auth ships first. If authentication, session handling, role checks or tenant isolation are broken or incomplete, fix them before building any feature on top. No feature may ship without working server-side permission checks and tenant isolation.
4. Do not assume the stack. Read the repo and use what it already uses. Do not introduce a new framework, database or major library without asking me first.
5. No mock data, no placeholder data, no hardcoded values, no sample records, no static arrays posing as real data. Every screen reads from the real backend. Every list, detail, form, chart and stat card must be wired to real backend functions. If the backend function does not exist, build it first, then the screen.
6. Every data screen needs four real states: loading, error with retry, empty with a real action, and success. Empty states must contain a button or link that does something.
7. Never show technical errors, stack traces, function names, file paths or vendor names to users. Log technical detail server-side only. Show plain, professional messages with a next step.
8. Never use em dashes anywhere in code, copy, comments or documents.
9. Panel route convention: tenant panel lives under `/dashboard`. Do not create routes named master-admin, super-admin or tenant-app.
10. Work one module at a time in the order in section 9. After each module: run typecheck, lint and tests, commit locally with a clear message, open a PR, wait for the Greptile review and do not stop until Greptile gives a 5/5 score. Cap at 5 review rounds, then stop and report the remaining blockers instead of gaming the review. Do not reference Linear issue IDs or Linear links anywhere.
11. Do not silently resolve any open decision in section 10. Implement the option I choose, or build in a way that works for both, and ask.
12. Money handling is strict: see section 8. Never use floating point for money.
13. After each module, send a short report: what was built, what was tested, what is incomplete, what needs my decision. Then wait for my go-ahead before the next module.
14. Every feature must have an audit log entry for create, update, delete and money or status changes. Soft delete only.

---

## 2. Phase legend

- P1: Africa launch (Kenya, Uganda, Tanzania). Build first.
- P2: Growth modules.
- P3: Expansion modules.

Each feature line is formatted as: `[phase] ID description`. IDs are stable. Use them in commit messages, tests and the audit file.

---

## 3. Tenant roles (proposal, final role set is an open decision)

| Role | Purpose |
|---|---|
| tenant_owner | Full control of the ISP account, billing with the platform, deletion |
| tenant_admin | Full operations except ownership transfer and platform billing |
| finance_manager | Billing, payments, accounting, payouts, reports |
| support_agent | Subscribers, tickets, communications, limited actions |
| technician | Network, equipment, work orders, installations |
| sales_manager | Leads, agents, resellers, vouchers, targets |
| field_agent | Mobile: sell, collect, install, limited subscriber view |
| viewer | Read only |
| custom roles | Built from the role builder (SET module) |

Rules:
- Every backend function checks authentication, then role, then tenant scope, then runs logic.
- Permission matrix is per module and per action (view, create, edit, delete, approve, export). Build a single source of truth for it.
- Money actions have per-role limits and approval thresholds, configurable by the tenant.

---

## 4. Route map (under `/dashboard`)

```
/dashboard                          Home
/dashboard/subscribers              List
/dashboard/subscribers/[id]         Profile
/dashboard/subscribers/import       Bulk import
/dashboard/packages                 Packages and data products
/dashboard/billing                  Invoices, credit notes, billing runs
/dashboard/payments                 Payments, manual recording, reconciliation
/dashboard/compensation             Compensation rules and history
/dashboard/accounting               Ledger, expenses, reports
/dashboard/sessions                 Live sessions and usage
/dashboard/network                  Devices, sites, topology, IPAM
/dashboard/network/monitoring       Monitoring and alerts
/dashboard/outages                  Outage records and status page
/dashboard/fiber                    OLT, ONU, splitters, routes
/dashboard/cpe                      Customer router management
/dashboard/map                      Coverage and infrastructure map
/dashboard/work-orders              Installations, repairs, scheduling
/dashboard/assets                   Towers, leases, asset lifecycle
/dashboard/vouchers                 Voucher batches and sales
/dashboard/agents                   Agents, resellers, commissions, float
/dashboard/leads                    Sales pipeline
/dashboard/support                  Tickets, knowledge base, inbox
/dashboard/communications           Campaigns, templates, notifications
/dashboard/automation               Workflow builder
/dashboard/surveys                  NPS, CSAT, quality score
/dashboard/loyalty                  Loyalty, referrals, rewards
/dashboard/enterprise               Business customers and contracts
/dashboard/venues                   Venue and event hotspots
/dashboard/marketplace              Buy hardware
/dashboard/courses                  Learn
/dashboard/staff                    Staff, attendance, leave, payroll
/dashboard/reports                  Reports and builder
/dashboard/compliance               Tax, regulator reports, logs
/dashboard/addons                   Content filtering, VoIP, IPTV, ads
/dashboard/insights                 AI features
/dashboard/developers               API keys, webhooks
/dashboard/settings                 All settings
/dashboard/notifications            Notification centre
/dashboard/audit-log                Tenant audit log
```

---

## 5. Cross-cutting requirements (apply to every module)

- [P1] XC-01 Tenant isolation: every query and mutation is scoped to the tenant and proven by tests that a user of tenant A can never read or write tenant B data.
- [P1] XC-02 Server-side authentication and role check on every backend function. No client-only gating.
- [P1] XC-03 Input validation on every backend function and every form, with clear field-level messages.
- [P1] XC-04 Pagination on every list, server-side filtering and sorting, with saved filters.
- [P1] XC-05 CSV and PDF export on every list and report, respecting permissions and tenant scope.
- [P1] XC-06 Soft delete everywhere with 30-day recovery and a restore screen.
- [P1] XC-07 Audit log entry for every create, update, delete, status change and money movement: who, what, before, after, when, source.
- [P1] XC-08 Multi-currency display and storage in integer minor units, per-ISP base currency, live exchange rates where conversion is needed.
- [P1] XC-09 Multi-language with translation keys for all copy, English, French, Swahili at minimum in P1, Arabic (with right-to-left) and Portuguese in P2. No hardcoded strings.
- [P1] XC-10 Timezone-correct dates, local number and phone formats (E.164 normalisation), per-ISP timezone.
- [P1] XC-11 Light and dark mode on every screen using shared design tokens. No hardcoded colours or font sizes.
- [P1] XC-12 Responsive and fast on low-end Android phones and slow networks. Lightweight pages, lazy loading, no heavy dependencies for simple screens.
- [P1] XC-13 Accessible: keyboard navigation, labels, contrast, focus states.
- [P1] XC-14 Real-time updates for live data (sessions, device status, alerts) without manual refresh.
- [P1] XC-15 Rate limiting on public and sensitive endpoints, protection against abuse.
- [P1] XC-16 Global search across subscribers, invoices, payments, devices, tickets, vouchers.
- [P1] XC-17 Notification centre with unread count, per-user preferences, per-channel preferences.
- [P1] XC-18 Bulk actions with confirmation, progress, partial failure report and undo where safe.
- [P1] XC-19 Idempotency on every payment, webhook and money-affecting operation.
- [P2] XC-20 Keyboard shortcuts and command palette.
- [P2] XC-21 Offline tolerance for mobile and field screens with sync and conflict handling.
- [P2] XC-22 Per-user saved views, column choices and table density.

---

## 6. Modules and features

### 6.1 ONB: Onboarding and account setup

- [P1] ONB-01 Signup with name, email, phone, country. Email one-time code and phone or WhatsApp one-time code. Resend limits and cooldown.
- [P1] ONB-02 ISP profile: business name, subdomain with live availability check and reserved-word block, country, currency, timezone, language.
- [P1] ONB-03 Operating defaults: service types (hotspot, PPPoE, fibre, fixed wireless), billing cycle defaults, payment methods wanted, tax registration details.
- [P1] ONB-04 Password setup, terms and data protection consent with version and timestamp recorded.
- [P1] ONB-05 Provisioning screen showing real progress from backend jobs, failure recovery and retry.
- [P1] ONB-06 First sign-in lands in a real dashboard with a setup checklist driven by real completion state.
- [P1] ONB-07 Invite first staff members with role selection during onboarding.
- [P1] ONB-08 Optional custom domain connection with DNS instructions and verification status.
- [P1] ONB-09 ISP's own plan with the platform: plan selection, trial status, usage against plan limits, upgrade and downgrade.
- [P2] ONB-10 Guided tours, contextual help, in-app tips.
- [P2] ONB-11 Data migration wizard (see IMP module) offered during onboarding.

### 6.2 DSH: Dashboard home

- [P1] DSH-01 KPI cards from real queries: revenue (today, week, month), MRR, active, new, churned, paused and suspended subscribers, overdue balance, collection rate, open tickets, active sessions, devices online and offline, current outages.
- [P1] DSH-02 Charts: revenue trend, subscriber growth, payments by method, usage by package, uptime trend. Date range and site filters.
- [P1] DSH-03 Alerts panel: devices down, failed payments, expiring subscriptions, low stock, float shortfalls, pending approvals.
- [P1] DSH-04 Quick actions: add subscriber, record payment, create voucher batch, open ticket, create work order.
- [P1] DSH-05 Site or market switcher for multi-site ISPs.
- [P1] DSH-06 Live updates without refresh.
- [P1] DSH-07 Setup checklist until complete.
- [P2] DSH-08 Customisable widgets and saved dashboards per user.

### 6.3 SUB: Subscribers

- [P1] SUB-01 List with search, filters (status, package, site, agent, balance, expiry, tags), saved filters, pagination, bulk actions.
- [P1] SUB-02 Create and edit subscriber: identity, contact, address with map pin, notes, tags, groups.
- [P1] SUB-03 Multiple services per subscriber, each with its own package, credentials, static IP, equipment and installation site.
- [P1] SUB-04 Status lifecycle: lead, pending, active, paused, suspended, expired, disconnected, deleted. Defined legal transitions with reason capture.
- [P1] SUB-05 Profile page: services, balance, wallet, invoices, payments, sessions, tickets, devices, documents, notes, activity timeline, compensation history, pause history, communications history.
- [P1] SUB-06 Suspend and reactivate with reason, immediate or scheduled.
- [P1] SUB-07 Plan change: upgrade, downgrade, immediate or next cycle, with correct proration.
- [P1] SUB-08 Credentials: create, reset, MAC binding, device limit, session limit.
- [P1] SUB-09 KYC capture: ID document upload, verification state, restricted access to documents.
- [P1] SUB-10 Consent and terms acceptance records per subscriber.
- [P1] SUB-11 Bulk import and export with validation, dry run, error report, duplicate detection.
- [P1] SUB-12 Send SMS, WhatsApp or email from the profile with templates.
- [P1] SUB-13 Termination flow: final invoice, refund or balance settlement, equipment return tracking.
- [P1] SUB-14 Relocation and address change workflow creating a work order when needed.
- [P2] SUB-15 Merge duplicate subscribers with full history preservation.
- [P2] SUB-16 Account transfer to another subscriber.
- [P2] SUB-17 Family and shared accounts with linked members.
- [P2] SUB-18 View as subscriber (logged, time limited) for support.
- [P2] SUB-19 Lifecycle automations: welcome message, expiry warnings, win-back after churn.

### 6.4 PAU: Subscription pause

(See business rules in section 7.1.)

- [P1] PAU-01 Pause a subscription from the subscriber profile by staff, with reason.
- [P1] PAU-02 Per-ISP and per-package pause rules: minimum and maximum length, maximum pauses per year, optional pause fee, free or paid.
- [P1] PAU-03 Preserve remaining paid days or data during the pause and restore on resume.
- [P1] PAU-04 Scheduled pause and scheduled resume with automatic execution and reminders before resume.
- [P1] PAU-05 Billing stops during pause and restarts correctly on resume with no duplicate or missed invoices.
- [P1] PAU-06 Self-service pause and resume requests from the subscriber panel, with optional approval workflow.
- [P1] PAU-07 Pause history and reports per subscriber and per ISP.
- [P1] PAU-08 Network enforcement: session disconnected and access blocked during pause, restored on resume.
- [P2] PAU-09 Pause and resume through WhatsApp and USSD (tenant configuration screen and message templates).
- [P2] PAU-10 Pause analytics: reasons, duration, resume rate, churn after pause.

### 6.5 PKG: Packages and data products

- [P1] PKG-01 Package types: hotspot, PPPoE, static IP, fibre, fixed wireless, public IP add-on.
- [P1] PKG-02 Package fields: name, speed up and down, burst, price, currency, duration, data cap, fair-use threshold and throttle speed, validity, device limit, site availability.
- [P1] PKG-03 Package status and visibility: draft, active, archived, public or private to agents.
- [P1] PKG-04 Promo codes: percentage, fixed, free days, usage limits, expiry, package scope.
- [P1] PKG-05 Time-of-day and night packages.
- [P1] PKG-06 Bundles of services.
- [P1] PKG-07 Tax settings per package (inclusive or exclusive, tax class).
- [P1] PKG-08 Changing a package price or speed applies to new subscribers, existing subscribers, or both, with preview of affected count.
- [P2] PKG-09 Pay-as-you-go micro packages, data rollover, data gifting, shared and family data pools.
- [P2] PKG-10 Borrow-now-pay-later data with limits and recovery rules.
- [P2] PKG-11 Bandwidth policies: QoS classes, fair-use throttling, per-package shaping profiles pushed to the network layer.
- [P2] PKG-12 IPv6 and public IP add-on management.
- [P3] PKG-13 VoIP and IPTV add-on products.

### 6.6 BIL: Billing

(See business rules in section 7.4.)

- [P1] BIL-01 Billing engine: recurring and prepaid, per-package cycle, anniversary or fixed-day billing.
- [P1] BIL-02 Invoice generation: automatic and manual, numbering, line items, taxes, discounts, notes, PDF, send by SMS, WhatsApp, email.
- [P1] BIL-03 Proration for plan changes, mid-cycle starts, pause and resume.
- [P1] BIL-04 Grace periods, automatic suspension and reactivation on payment.
- [P1] BIL-05 Payment reminders: schedule before and after due date, channel per subscriber, templates.
- [P1] BIL-06 Credit notes, refunds with approval, write-offs with approval and reason.
- [P1] BIL-07 Wallet: top-up, balance, auto-pay from wallet, wallet statement.
- [P1] BIL-08 Billing runs: preview, execute, review failures, rerun safely (idempotent).
- [P1] BIL-09 Tax-compliant invoices per country with tax registration number, tax breakdown and sequence rules.
- [P1] BIL-10 Statements per subscriber and aged receivables report.
- [P1] BIL-11 Invoice status: draft, sent, viewed, partial, paid, overdue, void, disputed.
- [P2] BIL-12 Multiple tax rates and withholding tax.
- [P2] BIL-13 Corporate invoicing: consolidated invoices across services and sites.

### 6.7 PAY: Payments and manual payment recording

(See business rules in section 7.3.)

- [P1] PAY-01 Collect via mobile money (M-Pesa, Airtel Money, MTN MoMo, Orange Money and similar), cards, bank transfer and a pan-African aggregator, configured per ISP.
- [P1] PAY-02 Payment gateway configuration per ISP: credentials stored securely, test mode, status, webhook health.
- [P1] PAY-03 Automatic reconciliation of gateway payments to subscribers and invoices, with an unmatched queue.
- [P1] PAY-04 Manual payment recording: cash, bank deposit, cheque, mobile money sent directly, POS. Recorded against subscriber, invoice or wallet with date, amount, method, reference, receiver and optional proof upload.
- [P1] PAY-05 Partial payments, overpayments, advance payments, split payments across methods, allocation across several invoices.
- [P1] PAY-06 Automatic receipts by SMS, WhatsApp or email with duplicate receipt detection.
- [P1] PAY-07 Approval workflow for large or backdated entries, thresholds configurable per role.
- [P1] PAY-08 Reversal or correction of a recorded payment only with reason, full audit trail and approval where configured.
- [P1] PAY-09 Bulk entry and CSV import of bank or mobile money statements with automatic matching and a review queue.
- [P1] PAY-10 Duplicate transaction reference detection.
- [P1] PAY-11 Daily cash-up per staff member and per agent tied to float, with shortfall and overage flags.
- [P1] PAY-12 Payment history, filters, export, refunds and disputes list.
- [P1] PAY-13 Payment failure handling: retries, notifications, status.
- [P2] PAY-14 Chargeback and dispute management with evidence upload.
- [P2] PAY-15 Payment fraud scoring and holds.
- [P2] PAY-16 Wallet KYC and AML limits following local e-money rules, per-tier transaction limits.
- [P2] PAY-17 Direct debit and recurring card mandates where supported.

### 6.8 CMP: Subscriber compensation

(See business rules in section 7.2.)

- [P1] CMP-01 Compensation types: extra days, extra data, wallet credit, invoice discount, free upgrade for a period.
- [P1] CMP-02 Automatic rules: configurable threshold (outage longer than N hours at the subscriber's site) triggers compensation proportional to verified downtime, read from verified outage records.
- [P1] CMP-03 Manual compensation by staff with reason, per-role amount limits, approval above threshold.
- [P1] CMP-04 Apply to one subscriber, a selected group, a whole site or a market in one action, with preview of count and total cost before confirming.
- [P1] CMP-05 Notify subscribers what they received and why by SMS, WhatsApp, push or email using templates.
- [P1] CMP-06 Caps and exclusions: planned maintenance, force majeure, abuse cases, per-subscriber monthly cap.
- [P1] CMP-07 Compensation history per subscriber, cost reports per outage, site and period, accounting export.
- [P1] CMP-08 Reversal with reason and audit trail.
- [P2] CMP-09 Compensation policy templates and simulation (what would last month's outages have cost).

### 6.9 ACC: Accounting and expenses

- [P1] ACC-01 Expense tracking: category, vendor, amount, tax, date, receipt upload, payment status, site assignment.
- [P1] ACC-02 Revenue and expense summary per period and site.
- [P1] ACC-03 Export to QuickBooks, Xero and CSV.
- [P2] ACC-04 Ledger and chart of accounts, journal entries, automatic postings from invoices, payments, refunds, compensation and expenses.
- [P2] ACC-05 Bank reconciliation with statement import and matching.
- [P2] ACC-06 Profit and loss and balance sheet per site and consolidated.
- [P2] ACC-07 Vendor bills and supplier payments, accounts payable ageing.
- [P2] ACC-08 Period close with lock to prevent back-dated edits.
- [P2] ACC-09 Budgets and variance reporting.

### 6.10 SES: Live sessions and usage

- [P1] SES-01 Live session list with subscriber, IP, MAC, device, site, package, start time, data used, speed, search and filters.
- [P1] SES-02 Disconnect a session with reason, optional block.
- [P1] SES-03 Usage history per subscriber and per site with charts and export.
- [P1] SES-04 Top users and bandwidth by site and package.
- [P1] SES-05 Fair-use status and throttling indicators.
- [P2] SES-06 Per-subscriber connection quality score from session and device data.
- [P2] SES-07 Abuse and spam detection alerts with action options.

### 6.11 NET: Network equipment and monitoring

- [P1] NET-01 Sites: create, edit, location, power type, contacts, assigned staff.
- [P1] NET-02 Device inventory: routers, access points, switches, antennas, OLTs, UPS, with model, serial, IP, site, status, firmware, assigned subscribers, warranty.
- [P1] NET-03 Add a device without redeploying the system: self-service registration and secure collector pairing.
- [P1] NET-04 MikroTik first: connect, test, import config, view interfaces, queues, PPPoE and hotspot status.
- [P1] NET-05 Remote actions: reboot, disconnect user, enable or disable, apply package profile, with confirmation and audit.
- [P1] NET-06 Configuration backup and restore with version history.
- [P1] NET-07 Continuous monitoring: online and offline detection for every device and link, with last seen and flap handling.
- [P1] NET-08 Alerts on offline and recovered events by SMS, WhatsApp, email, push to configurable recipients, with quiet hours and escalation rules.
- [P1] NET-09 Auto-create a support ticket on outage, auto-update and auto-close on recovery.
- [P1] NET-10 Health metrics: signal, load, connected clients, temperature, throughput, where the device provides them, with history charts.
- [P1] NET-11 Site survivability status: show whether each site is in cloud-connected or local-survival mode, last sync time, queued events.
- [P1] NET-12 Secure remote management status over VPN, with key rotation.
- [P1] NET-13 Network topology view.
- [P1] NET-14 IP address management: pools, assignments, static IPs, conflicts.
- [P2] NET-15 Power and site monitoring: battery, solar, generator fuel, grid status, low-battery warnings.
- [P2] NET-16 Adapters for Ubiquiti, TP-Link Omada, Cambium, Huawei and ZTE.
- [P2] NET-17 Bulk firmware management and scheduled maintenance windows (which also feed compensation exclusions).
- [P2] NET-18 Upstream capacity tracking and utilisation alerts.
- [P3] NET-19 Wholesale bandwidth reselling to other ISPs: offers, contracts, metering, billing.

### 6.12 OUT: Outages and status

- [P1] OUT-01 Verified outage records: start, end, affected devices, sites and subscribers, cause, resolution notes.
- [P1] OUT-02 Manual outage creation and edit for events the system could not detect, with approval.
- [P1] OUT-03 Planned maintenance windows with subscriber notice and compensation exclusion flag.
- [P1] OUT-04 Automatic SMS or WhatsApp to affected subscribers when a site goes down and when it recovers.
- [P1] OUT-05 Uptime per device, site and market with percentages and downtime logs, exportable.
- [P1] OUT-06 SLA tracking for enterprise contracts against verified outages.
- [P1] OUT-07 Public status page per ISP on a branded subdomain, with incident history.
- [P2] OUT-08 Customer outage map.
- [P2] OUT-09 Post-incident review notes and root cause tagging.

### 6.13 FIB: Fibre management

- [P2] FIB-01 OLT and ONU inventory and provisioning.
- [P2] FIB-02 Optical power readings with thresholds and alerts.
- [P2] FIB-03 Splitters, ports and fibre route records linked to the map.
- [P2] FIB-04 ONU assignment to subscribers and activation workflow.
- [P2] FIB-05 Fibre fault tickets linked to routes and work orders.

### 6.14 CPE: Customer router management

- [P2] CPE-01 Customer router inventory linked to subscribers.
- [P2] CPE-02 Remote WiFi name and password change, reboot, firmware update (TR-069 or equivalent).
- [P2] CPE-03 CPE health and signal readings.
- [P2] CPE-04 Bulk configuration pushes with staged rollout.

### 6.15 MAP: Coverage and infrastructure map

- [P1] MAP-01 Map of sites, towers, devices and subscribers with status colours.
- [P1] MAP-02 Draw and manage coverage areas, check an address against coverage.
- [P2] MAP-03 Fibre routes and splitters on the map.
- [P2] MAP-04 Heatmaps of subscribers, revenue and outages.
- [P2] MAP-05 Site prospecting: potential locations, demand signals, leads on the map.

### 6.16 WRK: Installations and work orders

- [P1] WRK-01 Work order types: installation, repair, relocation, survey, maintenance, disconnection, equipment recovery.
- [P1] WRK-02 Create from subscriber, ticket, outage or lead. Assign to technician, schedule, priority, SLA timer.
- [P1] WRK-03 Technician view: day schedule, checklist, equipment used, notes, photos, customer signature.
- [P1] WRK-04 Status flow: new, scheduled, en route, on site, completed, cancelled, with timestamps.
- [P1] WRK-05 Technician stock: assign equipment, track usage, reconcile.
- [P1] WRK-06 Completion triggers: activate service, bill installation fee, notify subscriber.
- [P2] WRK-07 GPS tracking of technicians and route suggestions.
- [P2] WRK-08 Offline completion with later sync on the mobile app.
- [P2] WRK-09 Customer rating after job completion.

### 6.17 AST: Sites, towers, leases and assets

- [P2] AST-01 Asset register: purchase date, cost, warranty, location, assigned person, status.
- [P2] AST-02 Maintenance schedule and history per asset.
- [P2] AST-03 Depreciation methods and reporting.
- [P2] AST-04 Tower and site lease records: landlord, rent, due dates, reminders, documents.
- [P2] AST-05 Landlord payments and reminders linked to expenses.
- [P2] AST-06 Serial number history across installs, returns and repairs.

### 6.18 VCH: Vouchers

- [P1] VCH-01 Create voucher batches: package, quantity, prefix, expiry, price, agent assignment.
- [P1] VCH-02 Voucher states: generated, assigned, sold, redeemed, expired, voided.
- [P1] VCH-03 Print-ready scratch card layouts with QR and branding, PDF export.
- [P1] VCH-04 Sale through agents with float deduction and commission.
- [P1] VCH-05 Redemption through captive portal, subscriber panel and staff entry.
- [P1] VCH-06 Fraud flags: repeated failures, unusual redemption patterns, duplicate attempts.
- [P1] VCH-07 Voucher reports: batches, sales, redemption rate, revenue by agent.
- [P2] VCH-08 Voucher roaming across partner ISPs with settlement.
- [P2] VCH-09 Voucher resale rules and expiry extensions.

### 6.19 AGT: Agents, resellers and float

- [P1] AGT-01 Agent profiles: contact, territory, tier, commission rules, float limit, status.
- [P1] AGT-02 Float management: top-up, deduct on sales, balance, limit, statement.
- [P1] AGT-03 Daily cash reconciliation and shortfall flags (ties to PAY-11).
- [P1] AGT-04 Commission rules: per package, per sale, per renewal, tiers. Statements.
- [P1] AGT-05 Payouts via mobile money or bank with approval and history.
- [P1] AGT-06 Targets and performance dashboards.
- [P1] AGT-07 Assign subscribers and vouchers to agents.
- [P2] AGT-08 Sub-resellers with multi-tier structure, wholesale pricing, margins, wallet and credit limits.
- [P2] AGT-09 Reseller white-label settings: brand, logo, domain, portal look.
- [P2] AGT-10 Reseller API keys.
- [P2] AGT-11 Territory management and conflict rules.

### 6.20 LED: Leads and sales pipeline

- [P1] LED-01 Lead capture: manual, import, website form, referral, agent entry, coverage check results.
- [P1] LED-02 Pipeline stages with drag and drop, owners, follow-up reminders.
- [P1] LED-03 Convert lead to subscriber with data carried over and work order creation.
- [P1] LED-04 Lead source and conversion reporting.
- [P2] LED-05 Quotes for business leads, e-signature, contract generation.
- [P2] LED-06 Lead scoring.

### 6.21 SUP: Support

- [P1] SUP-01 Ticketing: categories, priority, SLA, assignment, status, attachments, internal notes, merge, link to subscriber, device, outage and work order.
- [P1] SUP-02 Ticket creation from staff, subscriber panel, SMS, WhatsApp, email and automatic from outages.
- [P1] SUP-03 Canned replies and templates.
- [P1] SUP-04 SLA timers, breach alerts, escalation.
- [P1] SUP-05 Knowledge base: articles, categories, publish to subscriber panel.
- [P1] SUP-06 Support analytics: volume, response and resolution time, reasons, satisfaction.
- [P2] SUP-07 Shared inbox for WhatsApp, SMS, email and social with assignment and click-to-call.
- [P2] SUP-08 AI reply drafting and AI chat assistant for common subscriber questions.
- [P2] SUP-09 Outage broadcast replies and status macros.

### 6.22 COM: Communications

- [P1] COM-01 Channels setup: SMS sender ID, WhatsApp number, email sender, push.
- [P1] COM-02 Message templates with variables, language versions, approval state for WhatsApp templates.
- [P1] COM-03 Campaigns: audience builder, schedule, preview, send, delivery report, cost per campaign.
- [P1] COM-04 Automated notifications: payment received, invoice, expiry, suspension, outage, resume, compensation, pause.
- [P1] COM-05 Opt-out handling and consent respect.
- [P1] COM-06 Delivery logs with failure reasons.
- [P1] COM-07 SMS balance, credits and low balance alerts.
- [P2] COM-08 A/B testing for campaigns.
- [P2] COM-09 WhatsApp and USSD self-service bot configuration: menu design, language, actions allowed (balance, buy, renew, pause, resume, ticket, receipt).

### 6.23 AUT: Workflow automation

- [P2] AUT-01 Visual rule builder: trigger, conditions, actions.
- [P2] AUT-02 Triggers: device down for N minutes, payment failed, subscription expiring, ticket breached SLA, low stock, new lead.
- [P2] AUT-03 Actions: send message, create ticket, create work order, apply compensation, change status, call webhook, assign user.
- [P2] AUT-04 Run history, test mode, error handling, safe limits against loops.
- [P2] AUT-05 Prebuilt templates (for example: device down for 10 minutes, notify manager and compensate affected users).

### 6.24 SVY: Surveys and satisfaction

- [P2] SVY-01 NPS and CSAT surveys after tickets, installations and on schedule.
- [P2] SVY-02 Survey builder with channels and languages.
- [P2] SVY-03 Results dashboard, detractor alerts and follow-up tasks.
- [P2] SVY-04 Connection quality score per subscriber (shared with SES-06).

### 6.25 LOY: Loyalty and referrals

- [P1] LOY-01 Referral programme: codes, rewards for referrer and referee, fraud checks, approval, payout as credit or data.
- [P2] LOY-02 Loyalty tiers and points with earn and redeem rules.
- [P2] LOY-03 Spin-to-win and promotions.
- [P2] LOY-04 Leaderboards for agents and sites.
- [P2] LOY-05 Free data for referrals and milestones.

### 6.26 ENT: Enterprise customers

- [P2] ENT-01 Business accounts with multiple sites and contacts.
- [P2] ENT-02 Contracts: term, SLA, pricing, renewal dates, documents, e-signature.
- [P2] ENT-03 Leased line and dedicated services provisioning.
- [P2] ENT-04 Consolidated corporate invoicing and statements.
- [P2] ENT-05 SLA reports and credits from verified outages.
- [P2] ENT-06 Enterprise portal access for customer users.

### 6.27 VEN: Venues and events

- [P3] VEN-01 Venue hotspots: per-venue portal, branding, packages, schedule.
- [P3] VEN-02 Event access codes and time-bound passes.
- [P3] VEN-03 Sponsored access flows.
- [P3] VEN-04 Footfall analytics: visitors, dwell time, repeat visits.

### 6.28 MKT: Marketplace (buyer side)

- [P2] MKT-01 Browse catalog with categories, filters, specs, compatibility tags, photos, multi-currency prices.
- [P2] MKT-02 Cart, checkout and orders with all payment methods.
- [P2] MKT-03 Order tracking and delivery status.
- [P2] MKT-04 Quotations and bulk order requests.
- [P2] MKT-05 Credit terms and buy-now-pay-later: limit, balance, schedule, repayments, reminders.
- [P2] MKT-06 Warranty, returns and RMA requests with serial history.
- [P2] MKT-07 Reviews and ratings.
- [P2] MKT-08 Purchased devices auto-added to inventory with serial numbers and warranty.
- [P2] MKT-09 Reorder suggestions from low stock and failures.

### 6.29 CRS: Courses (learner side)

- [P2] CRS-01 Course catalog, search, categories, free and paid.
- [P2] CRS-02 Enrollment and payment, promo codes, subscription bundles.
- [P2] CRS-03 Lesson player for video and text, resources, quizzes, progress.
- [P2] CRS-04 Live classes and webinars: registration, reminders, attendance, recordings.
- [P2] CRS-05 Verifiable completion certificates.
- [P2] CRS-06 Assign courses to staff and agents with completion tracking by managers.
- [P2] CRS-07 Reviews and discussions.

### 6.30 HRM: Staff and payroll

- [P1] HRM-01 Staff directory with roles, sites, contacts, status, invite and deactivate.
- [P2] HRM-02 Attendance and shifts.
- [P2] HRM-03 Leave requests and approvals.
- [P2] HRM-04 Payroll runs with statutory deductions per country, payslips, payment records.
- [P2] HRM-05 Technician and agent performance records.

### 6.31 RPT: Reports and analytics

- [P1] RPT-01 Standard reports: revenue, collections, ageing, subscribers, churn, usage, sessions, tickets, uptime, outages, vouchers, agents, commissions, compensation, pauses, expenses.
- [P1] RPT-02 Filters by period, site, package, agent, currency. Export CSV and PDF.
- [P1] RPT-03 Scheduled reports by email.
- [P2] RPT-04 Custom report and dashboard builder with saved reports.
- [P2] RPT-05 Cohort and retention analysis.
- [P2] RPT-06 Data export for external analytics tools.

### 6.32 CPL: Compliance and logs

- [P1] CPL-01 Tax authority e-invoicing integration for the launch countries (Kenya, Uganda, Tanzania), submission status, retries, error queue.
- [P1] CPL-02 Regulator reports for launch countries in the required format, generated and exportable.
- [P1] CPL-03 Session and CGNAT log retention for the legally required period, secure export for lawful requests, access logged.
- [P1] CPL-04 Data protection: consent records, subscriber data export on request, subscriber deletion and anonymisation workflow with legal holds.
- [P1] CPL-05 Licence and compliance document tracker with expiry reminders.
- [P2] CPL-06 Country adapters for additional markets.

### 6.33 ADD: Add-ons

- [P2] ADD-01 Content filtering and parental controls: categories, per-subscriber and per-package policies.
- [P3] ADD-02 VoIP and IPTV resale: plans, numbers, channels, billing.
- [P3] ADD-03 Captive portal advertising and sponsored WiFi: campaign review, placement, impression and click reports, revenue share statements.
- [P3] ADD-04 Bundles and partner offers sold in the subscriber panel.

### 6.34 AIX: Insights and AI

- [P3] AIX-01 Churn prediction with reasons and suggested retention actions.
- [P3] AIX-02 Network anomaly and fraud detection with alerts.
- [P3] AIX-03 Forecasts for revenue, capacity and hardware demand.
- [P3] AIX-04 AI assistant for staff: summarise a subscriber, draft replies, explain an outage.

### 6.35 IMP: Data import and migration

- [P1] IMP-01 Import subscribers, packages, balances, invoices and payment history from spreadsheets with mapping, validation, dry run and rollback.
- [P1] IMP-02 Import from other ISP billing systems (for example Splynx, Centipid, WHMCS) through documented export formats, with field mapping profiles.
- [P1] IMP-03 Import credentials and sessions cutover plan with minimal downtime and a verification report.
- [P1] IMP-04 Import history log with downloadable error reports.

### 6.36 API: Developers

- [P2] API-01 API keys with scopes, expiry, rotation, revocation, shown once.
- [P2] API-02 Webhooks with event selection, signing secret, delivery log, retries, replay.
- [P2] API-03 API usage and rate limit dashboard.
- [P2] API-04 Link to API documentation and sandbox.

### 6.37 SET: Settings

- [P1] SET-01 Business profile, address, tax registration, logo.
- [P1] SET-02 Branding: colours, logo, subscriber portal look, custom domain, email sender, SMS sender.
- [P1] SET-03 Users and invitations, role assignment, deactivate, force sign-out.
- [P1] SET-04 Role builder: custom roles with per-module and per-action permissions, money limits and approval thresholds.
- [P1] SET-05 Security: two-factor authentication, session timeout, trusted devices, active sessions list, login history, IP allow list.
- [P1] SET-06 Billing defaults: cycles, grace periods, reminders schedule, invoice numbering and templates, tax settings.
- [P1] SET-07 Payment gateways and payout methods.
- [P1] SET-08 Notification preferences and quiet hours.
- [P1] SET-09 Pause rules, compensation rules, voucher rules, referral rules.
- [P1] SET-10 Integrations: accounting, messaging providers, tax authority credentials.
- [P1] SET-11 Data export of all tenant data and account deletion request with grace period.
- [P1] SET-12 Platform subscription and invoices (ISP's own plan with the platform).
- [P1] SET-13 Translation and language options for subscriber-facing copy.
- [P2] SET-14 Single sign-on for enterprise tenants.
- [P3] SET-15 Whole-tenant white-label options.

### 6.38 NTF and AUD: Notifications and audit

- [P1] NTF-01 Notification centre, filters, mark read, per-type preferences.
- [P1] NTF-02 In-app, email, SMS, push and WhatsApp for staff alerts as configured.
- [P1] AUD-01 Tenant audit log viewer with search, filters, export, tamper-evident records.
- [P1] AUD-02 Money actions, role changes, setting changes and exports always logged.

---

## 7. Business rules for the critical money and service flows

### 7.1 Subscription pause

1. Pause creates a pause record: subscription, requested by, approved by, start, planned end, reason, fee, status.
2. On pause start: record remaining paid days or remaining data allowance, disconnect active sessions, block access, set subscription status to paused, stop invoice generation, cancel pending renewals.
3. During pause: no billing, no usage accrual, no suspension reminders. Wallet and balance remain untouched except for the optional pause fee.
4. On resume (manual or scheduled): restore remaining days or data, set expiry to resume date plus remaining time, re-enable access, resume billing from the correct date, send confirmation.
5. Limits are enforced server-side: minimum and maximum length, maximum pauses per rolling year, eligibility by package and balance state (for example no pause with overdue invoices, unless the tenant allows it).
6. If the maximum length is reached, auto-resume and notify.
7. All state changes are idempotent. Running the scheduler twice must not double-resume or double-charge.
8. Acceptance: a test proves that pausing and resuming leaves no duplicate invoice, no missed invoice and the correct expiry date.

### 7.2 Subscriber compensation

1. Eligibility comes only from verified outage records or an approved manual entry.
2. Automatic rule example: if verified downtime at the subscriber's site exceeds N hours, credit = downtime hours divided by 24 multiplied by the daily package value, subject to a cap per outage and per month. Rounding rules and minor units are explicit.
3. Compensation form is chosen per rule: extra days (extend expiry), extra data (add allowance), wallet credit (ledger entry), invoice discount (applies to next invoice), or free upgrade (temporary profile with automatic revert).
4. Exclusions: planned maintenance windows, force majeure flag, subscribers with abuse flags, subscribers already compensated for the same outage.
5. A bulk application shows a preview with subscriber count, total cost and exclusions before confirmation. Confirmation needs the permission and, above a cost threshold, an approval.
6. Every compensation creates an immutable record linked to the outage, rule or staff member, and a ledger entry when money is involved.
7. Reversal needs a reason and creates a counter-entry, never deletes the original.
8. Acceptance: tests cover exclusions, caps, duplicates, rounding, bulk preview equals bulk result, and permission and approval enforcement.

### 7.3 Manual payment recording

1. Required fields: subscriber or invoice or wallet target, amount in minor units, currency, method, date received, reference (required for bank, cheque, mobile money), receiver (user), optional proof file.
2. Allocation: default oldest invoice first, user can override. Overpayment goes to wallet. Partial payment leaves invoice partially paid. Split payments create one payment with multiple method lines.
3. Duplicate protection: warn and block on the same reference, amount and subscriber within a configurable window, with an override that needs a reason.
4. Backdated entries beyond a configurable number of days require approval. Amounts above the role limit require approval.
5. Posting: creates a payment record, receipt, allocation entries, ledger entries and audit log in one atomic operation.
6. Reversal or correction: reason required, approval where configured, creates reversing entries, original stays visible, receipt voided and subscriber notified if configured.
7. Statement import (CSV): map columns, preview, auto-match by reference, phone number and amount, send unmatched to a review queue, never auto-post low-confidence matches.
8. Cash-up: each staff member and agent closes the day with counted cash against recorded cash, shortfall or overage flagged and visible to finance_manager.
9. Acceptance: tests cover partial, over, advance, split, duplicate, backdated approval, reversal and cash-up differences.

### 7.4 Billing

1. All money values are stored as integers in minor units with an explicit currency. No floating point anywhere.
2. Billing runs are idempotent per subscription per period. Re-running must not create duplicate invoices.
3. Proration uses a documented, tested formula (day-based by default, tenant option for fixed-month). Rounding is explicit and consistent.
4. Tax is calculated per line using the package tax class and the tenant tax settings, inclusive or exclusive.
5. Invoice numbering is sequential per tenant and per tax rules, with no gaps for issued invoices. Voided invoices stay in the sequence.
6. Suspension and reactivation follow grace period settings and are triggered by payment allocation events.
7. Every payment gateway webhook is verified, idempotent, and reconciled to a payment record.
8. Acceptance: tests cover proration, tax inclusive and exclusive, grace period, reactivation, duplicate webhook delivery and billing re-run.

---

## 8. Money safety rules (apply everywhere)

- Integer minor units and explicit currency on every amount.
- Idempotency keys on every money-affecting operation and webhook.
- Atomic posting of payment, allocation, ledger and audit entries.
- Role-based amount limits and approval thresholds, enforced server-side.
- Immutable history: corrections create counter-entries.
- Reconciliation views for gateways, wallets, agent float, vouchers and payouts.
- No secrets or credentials in source code or logs. Gateway credentials encrypted at rest.

---

## 9. Build order

1. Foundation audit and fixes: auth, sessions, roles, tenant isolation, audit log, design tokens, i18n scaffolding, error and state patterns (XC items).
2. ONB and SET (profile, users, roles, security basics).
3. SUB and PKG.
4. BIL, PAY (including manual recording), CMP rules scaffolding.
5. NET and OUT (monitoring, alerts, tickets, verified outages), then CMP automation on verified outages.
6. PAU, SES, VCH, AGT (float, cash-up, commissions).
7. SUP, COM, LED, WRK, MAP.
8. IMP and CPL (migration, tax e-invoicing, regulator reports, log retention).
9. DSH and RPT completed with real aggregated data.
10. P1 closeout: full permission and tenant isolation test pass, load check, accessibility check.
11. P2 modules in this order: ACC, FIB, CPE, AST, AUT, SVY, LOY, ENT, MKT, CRS, HRM, API, NET extras.
12. P3 modules: ADD, VEN, AIX, NET-19 and remaining items.

Do not start a later module until the previous one is merged, reviewed and reported.

---

## 10. Open decisions (do not resolve silently)

1. Final tenant role set: the table in section 3 is a proposal. Build the permission system to support custom roles, ask before locking defaults.
2. Payment aggregator for each launch country (Kenya, Uganda, Tanzania): ask before wiring a provider.
3. SMS, WhatsApp and USSD providers per country: ask before wiring a provider.
4. Tax authority integration method per country (direct or through a certified provider): ask before building.
5. Time-series and telemetry storage approach if the existing backend cannot handle device and session volume: propose options with cost, then ask.
6. Data retention periods per country for session and CGNAT logs: confirm before enabling deletion jobs.
7. Pause eligibility rules (for example allowed with overdue balance or not): confirm defaults.
8. Compensation default formula and caps: confirm defaults.
9. Marketplace and courses data ownership between tenant panel and owner panel: confirm interfaces before building MKT and CRS.

---

## 11. Definition of done (per feature)

A feature is done only when all of these are true:

- Backend functions exist with authentication, role, tenant scope and input validation.
- UI uses real data with loading, error, empty and success states.
- Permission matrix row exists and is enforced server-side.
- Audit log entries written for all changes.
- Tests exist: happy path, rejection path, wrong role, wrong tenant, and edge cases listed in section 7 where relevant.
- No mock data, no hardcoded values, no placeholder text, no em dashes.
- Light and dark mode, responsive, translation keys used.
- Typecheck, lint and tests pass.
- Committed, PR opened, Greptile score 5/5 or blockers reported after 5 rounds.
- Feature ID listed in the audit file with status updated to Done and evidence (route, function, test names).
