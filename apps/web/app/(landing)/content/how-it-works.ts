export type HowItWorksStep = {
  step: string;
  title: string;
  about: string;
  inPractice: string;
};

export const howItWorksSteps: HowItWorksStep[] = [
  {
    step: "1",
    title: "The shared customer record",
    about:
      "Each customer has one account where you manage their services, billing, and support history.",
    inPractice:
      "when a customer renews, pays, or reports an issue, everything connects back to that one record — no re-asking, no lost context.",
  },
  {
    step: "2",
    title: "Plans and sales",
    about:
      "You design the packages you sell — speed, data, time, or hotspot — and sell them directly or through vouchers and free trials.",
    inPractice:
      "the platform tracks what is sold and what remains available, so a voucher run or a trial wave never turns into manual counting.",
  },
  {
    step: "3",
    title: "Billing and payments",
    about:
      "Invoices, payments, and the money the network brings in are tracked in one financial record.",
    inPractice:
      "you can see revenue, outstanding balances, and how individual plans perform — and every posting is traceable in an append-only ledger.",
  },
  {
    step: "4",
    title: "Network visibility",
    about:
      "Routers, access points, switches, and sites are tracked with health monitoring and data usage insight.",
    inPractice:
      "connectivity problems surface early through monitoring, incidents, and maintenance windows — instead of through the first customer call.",
  },
  {
    step: "5",
    title: "Support that follows the customer",
    about:
      "Tickets capture issues from whichever channel a customer uses, and notifications keep customers informed about renewals, payments, and outages.",
    inPractice:
      "your team picks up every issue with the full customer history attached, and proactive updates beat silent surprises.",
  },
];