export type GuideSection = {
  heading: string;
  paragraphs: string[];
};

export type Guide = {
  slug: string;
  title: string;
  kicker: string;
  intro: string;
  sections: GuideSection[];
};

export const guides: Guide[] = [
  {
    slug: "billing-and-payments",
    title: "ISP billing & payment operations",
    kicker: "Guide",
    intro:
      "Prepaid and postpaid billing, vouchers, and reconciliation are where small ISPs either keep control or slowly leak money. This guide covers the operating habits that keep them clean.",
    sections: [
      {
        heading: "Start from one record of truth",
        paragraphs: [
          "The most common failure is not one big mistake — it is dozens of small ones that nobody notices because accounts, vouchers, and network sessions live in separate places. Every customer should have one account record that carries their services, payment history, and network identity, so a renewal or an overdue check always starts from the same facts.",
          "When a payment arrives, it should post once, update the balance once, and change that customer's entitlements once. If those three steps are not traceable in sequence, disputes become guesswork.",
        ],
      },
      {
        heading: "Prepaid vs postpaid discipline",
        paragraphs: [
          "Prepaid services pay before value is delivered: a voucher, a day pass, or a topped-up account that expires on a date. Postpaid services invoice for a period and carry an outstanding balance until paid.",
          "Whatever mix you run, the rule is the same — the expiry or due date is computed from the payment, not typed by hand twice. Verifiable records mean a customer who says 'I paid' can be answered in seconds, not after an afternoon of receipts.",
        ],
      },
      {
        heading: "Reconciliation is a habit, not an event",
        paragraphs: [
          "Reconcile payment channels on a fixed rhythm — daily for busy channels, weekly for slow ones. Match every mobile-money or bank statement line to a posted payment, and treat anything unmatched as an open item until it resolves.",
          "Unreconciled money is the quiet leak. A small steady flow of unmatched payments becomes a quarterly mess that costs more than the amounts involved.",
        ],
      },
      {
        heading: "Suspensions that never surprise",
        paragraphs: [
          "Define the overdue-to-suspension path in advance: how many days, what reminders go out in between, and who can reverse it. Customers stop trusting networks that cut service without warning and let dozens of 'favourable' exceptions create chaos.",
          "Predictable policy is also what makes reconnection traceable — you can show a customer exactly when, why, and how their service will come back after they pay.",
        ],
      },
    ],
  },
  {
    slug: "kenya-payment-automation",
    title: "Kenya payment automation guide",
    kicker: "Guide",
    intro:
      "Most Kenyan households and businesses pay with M-Pesa, and increasingly Airtel and card rails. The operators that grow smoothly make this money arrive, reconcile, and entitle service without manual steps.",
    sections: [
      {
        heading: "How mobile-money payments should flow",
        paragraphs: [
          "The healthy pattern is simple: a customer pays, the payment posts to their account as an unverified item, matching to an invoice shows the balance change, and only then does the customer's service entitlement update. Every one of those steps leaves a trace.",
          "That trace matters because mobile money is fast and forgiving of mistakes — the customer experience is built on 'it just goes through' — but your records are the only place the truth lives.",
        ],
      },
      {
        heading: "M-Pesa today, and the recurring path ahead",
        paragraphs: [
          "Today most small operators check statements, export, match, and post — often by hand. M-Pesa's side is instant; the accounting side is where the day's work hides.",
          "Direct, automatic M-Pesa posting and recurring debits are on MylesNet's roadmap. Until they ship, the practical habit is fixed-rule import matching on a strict schedule, so no day's transactions wait more than one reconciliation cycle.",
        ],
      },
      {
        heading: "The four checks that keep money honest",
        paragraphs: [
          "First, every received payment posts exactly once. Second, every posting carries the exchange snapshot of its moment, so the amount owes no explanation later. Third, balances are always derivable from posted events, never from a hand-edited number. Fourth, nothing — float, settlement, or correction — moves off the visible record.",
          "When operators follow these four checks, an audit of any month takes minutes instead of a week.",
        ],
      },
    ],
  },
  {
    slug: "mikrotik-radius-operations",
    title: "MikroTik & RADIUS operations",
    kicker: "Guide",
    intro:
      "MikroTik gear is the backbone of most small East African networks. The difference between a well-run router and a firefighting one is visible in a handful of daily practices.",
    sections: [
      {
        heading: "Health checks before complaints",
        paragraphs: [
          "Check CPU, memory, uptime, interface state, and telemetry on a schedule — not when a customer calls. A router drifting toward saturation shows the warning signs in its health metrics long before users feel it.",
          "MylesNet monitors router health out of the box on supported MikroTik devices, so your day starts from the dashboard, not from a complaint.",
        ],
      },
      {
        heading: "Configuration you can restore, and prove",
        paragraphs: [
          "Backup every router's configuration, and keep the history. When something changes overnight and nobody remembers doing it, a backup history with drift detection turns a mystery into a diff. Restoring a known-good configuration is a minutes job instead of a rebuild.",
          "This is the discipline that keeps one technician's 'quick change' from becoming next week's outage.",
        ],
      },
      {
        heading: "The AAA upgrade path",
        paragraphs: [
          "RADIUS (Remote Authentication Dial-In User Service) centralises who gets on the network and with what speed. Hotspot logins, PPPoE sessions, and subscriber entitlements can all hang off one AAA service.",
          "FreeRADIUS and full PPPoE provisioning are on MylesNet's roadmap. Until then, keep credentials, address allocations, and entitlements in one place on your side, so the move to centralised AAA later is a configuration change rather than a records project.",
        ],
      },
    ],
  },
  {
    slug: "captive-portal-hotspot-guide",
    title: "Captive portal & hotspot guide",
    kicker: "Guide",
    intro:
      "A captive portal is the front door of a monetised hotspot: the page a phone sees before it can use the internet. Done well, it converts guests into paying users; done badly, it blocks them from both.",
    sections: [
      {
        heading: "What a good splash page does",
        paragraphs: [
          "It catches the device, asks for just enough — a voucher, a package, or a self-registration — and puts the customer online with the right speed and data policy. It also records the session, so revenue from hotspot sales is visible, not a bag of paper codes.",
          "The captive portal is specifically not the place for a registration form with fourteen fields. Every extra field is a dropped sale.",
        ],
      },
      {
        heading: "Vouchers, trials, and guest access",
        paragraphs: [
          "Vouchers with QR codes work well in markets and guest networks because they sell like products and redeem like keys. Free trials and giveaway bundles let you run promotions with control — an expiry you decide, not a permanent free session.",
          "Unused-voucher hygiene matters: expired codes should sweep clean and never re-enter circulation between disputes.",
        ],
      },
      {
        heading: "The MylesNet portal plan",
        paragraphs: [
          "MylesNet's captive portal and hotspot commerce are specified and sequenced on the roadmap — splash pages, self-service registration, vouchers, and hotspot commerce hosted inside the operator console. Until build work starts, an operator-configured portal continues to live in the dashboard.",
          "The principle that does not change: the portal is a surface of one platform, sharing customer, payment, and network records with everything else.",
        ],
      },
    ],
  },
  {
    slug: "wisp-launch-playbook",
    title: "WISP launch playbook",
    kicker: "Playbook",
    intro:
      "From coverage plan to first paying customers for a small wireless ISP. The goal is a network that is funded by early subscribers, not by endless goodwill.",
    sections: [
      {
        heading: "Coverage before wires",
        paragraphs: [
          "Map the houses and businesses you can realistically serve before you promise anyone. Take line-of-sight seriously, and price the plan to recover gear on the towers, not just the router on the wall.",
          "A 'maybe' coverage map is where small WISPs over-promise and under-deliver within the first month.",
        ],
      },
      {
        heading: "Sell what you can really deliver",
        paragraphs: [
          "A handful of honest plans beats a menu of promises. Time and data packages that match how your market buys — a student plan, a day pass, a residential month — turn a connection into predictable revenue.",
          "Set voucher and package records up before the first customer so every sale is trackable from day one.",
        ],
      },
      {
        heading: "The first month is about receipts",
        paragraphs: [
          "The ten customers who join first will shape your reputation. Give them the reliable behaviours before the network is flashy: clearly known renewal dates, traceable payments, and a working way to raise a problem.",
          "A network that is honest about what it runs today builds the trust that the next hundred subscribe on.",
        ],
      },
    ],
  },
  {
    slug: "estate-network-playbook",
    title: "Fiber & estate network playbook",
    kicker: "Playbook",
    intro:
      "Estates and apartment buildings pack many homes onto shared infrastructure. The operators who thrive there win on per-household clarity, not on raw bandwidth.",
    sections: [
      {
        heading: "Per-household accounts, not shared confusion",
        paragraphs: [
          "Every home gets its own account with its own billing, renewal date, and service history. Shared plans and administratively merged households are where 'who paid what' becomes the landlord's nightly argument.",
          "Multiple services per customer come free with clean accounts — a home and a shop on the same record, billed separately but run through one view.",
        ],
      },
      {
        heading: "Visible revenue per building",
        paragraphs: [
          "Reporting on active households per building and revenue per block turns the estate into a business you can run, not a utility you babysit. When a building underperforms, the reports show it early.",
          "Overdue-to-suspension policy that residents understand in advance keeps renewals calm and disputes rare.",
        ],
      },
      {
        heading: "Hardware treated as an estate",
        paragraphs: [
          "Routers, switches, access points, and distribution points should be one inventory, with a site record each. Health checks and session visibility keep problems visible before a block of homes loses service on a Saturday night.",
        ],
      },
    ],
  },
  {
    slug: "subscriber-migration-checklist",
    title: "Subscriber migration checklist",
    kicker: "Checklist",
    intro:
      "Moving customer records and balances off spreadsheets — or out of a system nobody quite trusts — into one operational view. Half the value is the move; the other half is the cleanup that makes it stick.",
    sections: [
      {
        heading: "Inventory what you actually have",
        paragraphs: [
          "Before importing, list every source of truth: subscriber sheets, payment books, records in the head of your longest-serving technician. Decide which is authoritative for what — an account number, a phone, a service address — and what to do when sources disagree. Conflicts you resolve now never chase you later.",
          "Agree the scope: customers only this month, services next, historical payments after that. Scope creep is the number one reason migrations stall.",
        ],
      },
      {
        heading: "Clean data is cheap to import",
        paragraphs: [
          "Deduplicate phone numbers and account names before import. Decide blocking rules for conflicts (latest record wins, or every conflict reviewed). Take account balances as of a fixed cutoff date — never 'today' — so the numbers don't keep moving under you while you work.",
          "The import itself should land in a staging pass you can inspect, then commit once it checks out.",
        ],
      },
      {
        heading: "Verify forward, keep the past",
        paragraphs: [
          "After the move, run the first full billing cycle and reconcile it against your old books end-to-end. Keep the old source accessible — read-only — for at least one full cycle, so 'how did we do it before?' has a definitive answer while the team learns the new system.",
          "The checklist closes when a renewal, a reconfigured device, and a disputed payment can each be answered from the new record alone.",
        ],
      },
    ],
  },
  {
    slug: "isp-kpi-primer",
    title: "ISP KPI primer",
    kicker: "Primer",
    intro:
      "Dashboards flood operators with numbers. These are the few that matter for a small network — and what to do about each one when it moves.",
    sections: [
      {
        heading: "Revenue, the honest way",
        paragraphs: [
          "Daily revenue and monthly recurring revenue (MRR) are the two that decide whether the network is growing. Track payment success — how much of what was attempted actually posted — because a well-sold but uncollectible plan is a quiet restructuring.",
          "Average revenue per user (ARPU) is the bridge between sub counts and money: it tells you whether growth means revenue or just more overhead.",
        ],
      },
      {
        heading: "Churn and renewals",
        paragraphs: [
          "Look at expirations due in the coming window and at who actually renews. The difference between 'due' and 'renewed' is the early warning of churn — and it is the number you can act on fastest with a renewal reminder.",
          "Overdue balances are a KPI, not a report to file: visible receivables get collected, buried ones forgive themselves.",
        ],
      },
      {
        heading: "Network health as a customer metric",
        paragraphs: [
          "Saturation, heavy users, and interface health ultimately show up inside churn and complaints. When a churn number moves, the first question is what changed in the network and the payment experience, not what the competitor charged.",
          "Pick the smallest set of numbers your team will actually look at every morning. A KPI nobody reads is decoration.",
        ],
      },
    ],
  },
];