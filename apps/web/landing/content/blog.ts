export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  tag: string;
  date: string;
  excerpt: string;
  sections: BlogSection[];
};

export const posts: BlogPost[] = [
  {
    slug: "mpesa-reconciliation-three-way-match",
    title: "M-Pesa reconciliation: the three-way match that ends disputes",
    tag: "Payments",
    date: "2026-09-25",
    excerpt:
      "A payment, the invoice it settles, and the balance change must agree — here is the matching rule that keeps the ledger honest.",
    sections: [
      {
        heading: "The three-way match",
        paragraphs: [
          "Every M-Pesa payment that lands in your paybill or till number has three faces: the mobile-money statement line, the invoice you raised, and the subscriber balance that moves. When all three agree, the payment is done. When one drifts, the dispute starts.",
          "The rule is simple: the statement amount, the invoice amount, and the balance delta must be identical. If the customer paid 3,500 but the invoice was 3,400, the extra 100 is not a payment — it is an open item until the customer tells you what it is for.",
        ],
      },
      {
        heading: "Unverified, then posted",
        paragraphs: [
          "Import the statement, but do not post to a subscriber until the match is explicit. A payment sits in an unverified bucket until a rule or a person links it to the right invoice. That bucket is the only place mobile-money money lives before it becomes revenue.",
          "Posting without a match is how phantom credits appear — the customer sees a balance drop, the operator sees no invoice, and the next bill run carries a ghost credit that nobody can explain.",
        ],
      },
      {
        heading: "Fixed rule, fixed schedule",
        paragraphs: [
          "Automation is a rule you wrote, not a robot you trust. Start with exact amount + phone number + reference; anything that fails stays in the bucket. Run the rule on a schedule — daily for busy paybills, every weekday for quieter ones — so no day's transactions wait more than one cycle.",
          "The schedule is the discipline. A bucket that grows for three days is a process that has already failed, even if the money is sitting there.",
        ],
      },
    ],
  },
  {
    slug: "voucher-hygiene-expired-codes",
    title: "Voucher hygiene: what expired codes cost you",
    tag: "Vouchers",
    date: "2026-09-12",
    excerpt:
      "Expired codes that linger in agent stock or re-enter circulation are silent revenue leaks — here is the sweep that keeps them clean.",
    sections: [
      {
        heading: "One code, one redemption, one life",
        paragraphs: [
          "A voucher code should be redeemed once, by one subscriber, on one device. After that it is dead — it never re-enters the pool, it never gets reprinted, and it never appears in a new batch. If your system allows a code to be used twice, the second subscriber rides on the first one's payment.",
          "Expired codes are the same problem in slow motion. An agent holds a booklet of codes that expired last month. A customer buys one, it fails, the agent swaps it for a fresh one — but the expired code is still in the booklet, and the next customer might get it.",
        ],
      },
      {
        heading: "The sweep that prevents the leak",
        paragraphs: [
          "Run a nightly job that marks every code past its expiry as void, and removes void codes from every agent's available stock. The agent's next sync shows the reduced count, and the expired codes never reach a customer.",
          "If you print codes, the sweep also marks the printed batch as closed so a reprint cannot accidentally duplicate a code that is already in circulation.",
        ],
      },
      {
        heading: "Agent reconciliation",
        paragraphs: [
          "Once a week, the agent's sold vs. redeemed report should balance. Sold codes minus redeemed codes equals the stock the agent still holds. If it does not, the difference is either expired stock the agent has not returned, or a code that was sold but never redeemed — both are money you cannot account for.",
          "The reconciliation is the conversation starter. An agent who cannot explain the gap is an agent who needs a tighter hand-off, not a spreadsheet adjustment.",
        ],
      },
    ],
  },
  {
    slug: "mikrotik-health-check-in-two-minutes",
    title: "A MikroTik health check you can do in two minutes",
    tag: "Network",
    date: "2026-08-28",
    excerpt:
      "CPU, memory, uptime, interfaces, and disk — five signals that tell you whether a router is healthy or about to make headlines.",
    sections: [
      {
        heading: "The five-minute watchlist",
        paragraphs: [
          "Start with what the router reports about itself: CPU load, memory use, uptime, interface state, and storage. Uptime is the most human of them — a router that rebooted last night tells you more than a slow trend line, because a reboot is an event with a time and, usually, a cause.",
          "Interface state catches the failures that subscribers feel first: a port that is up but flapping, traffic on an interface that should be idle, or one interface carrying far more than it should. These are visible long before anyone files a ticket.",
        ],
      },
      {
        heading: "Watch capacity, not just health",
        paragraphs: [
          "A healthy router can still be the bottleneck. Compare throughput against the link it serves and watch the trend, not the peak: saturation at the same hour every evening is a pricing and shaping conversation; saturation that grows week over week is a capacity one.",
          "Track address table size and DHCP pool usage as well. Both fail in ways that look like 'the internet is down' from the subscriber's side while every individual process on the router is still reporting green.",
        ],
      },
      {
        heading: "Configuration backups and change history",
        paragraphs: [
          "The second part of monitoring is knowing what the router was configured to do. A scheduled configuration backup means a replaced device is a hardware swap instead of an afternoon of reconstruction, and a bad change is a diff instead of a mystery.",
          "Keep the backups somewhere the router itself cannot wipe them, and treat a router whose configuration has changed without a matching change record as an incident, not a curiosity.",
        ],
      },
    ],
  },
  {
    slug: "small-isp-weekly-numbers",
    title: "The four numbers a small ISP should watch every Monday",
    tag: "Operations",
    date: "2026-08-13",
    excerpt:
      "Daily revenue, renewals due vs. renewals done, overdue balance, and active subscribers — the morning dashboard that tells you what the business is about to do.",
    sections: [
      {
        heading: "Revenue and collections",
        paragraphs: [
          "Daily revenue is the cash that actually posted — not what was invoiced, not what was attempted. Mobile-money payments post fast; bank transfers post slow. Track both, and track the gap between attempted and posted, because a well-sold but uncollectible plan is a quiet restructuring.",
          "Monthly recurring revenue (MRR) is the bridge between subscriber counts and money: it tells you whether growth means revenue or just more overhead.",
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
  {
    slug: "spreadsheets-to-one-record",
    title: "Off spreadsheets: what a migration actually involves",
    tag: "Operations",
    date: "2026-07-30",
    excerpt:
      "Inventory every source of truth, pick a cutoff, stage the import, and run one full billing cycle reconciled against the old books.",
    sections: [
      {
        heading: "Inventory the sources of truth",
        paragraphs: [
          "Before you move a single row, list every place subscriber data lives: the billing spreadsheet, the router's user-manager, the mobile-money statement exports, the agent's notebook, the support WhatsApp group. Each one is a source of truth for someone, and the migration has to reconcile all of them.",
          "Do not guess — ask the people who use each source what they trust and what they ignore. The field team's notebook often has the real MAC address that the spreadsheet approximates.",
        ],
      },
      {
        heading: "Dedupe, then cut over",
        paragraphs: [
          "Deduplicate on the immutable keys: national ID, phone number, MAC address. If two rows share a key, they are the same subscriber until a human proves otherwise. Build the staging table, then freeze new sign-ups in the old system for the import window — even if it is only four hours.",
          "Import the staged data, run the first bill cycle entirely in the new system, and reconcile every invoice, every payment, and every suspension against the old books. If the numbers match, the old system is read-only from that day forward.",
        ],
      },
      {
        heading: "One full cycle, then decide",
        paragraphs: [
          "Run one complete billing cycle — invoices generated, payments collected, suspensions executed, reconnections verified — before you declare the migration done. The first cycle is where the edge cases live: the customer who paid twice, the voucher that was already redeemed, the router that did not pick up the new secret.",
          "If the cycle closes clean, you have one record of truth. If it does not, the staging table is still there and the old system is still running — fix the gap and run the cycle again. The cost of a second cycle is far smaller than the cost of a production cutover that drifts.",
        ],
      },
    ],
  },
];

export function formatPostDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}