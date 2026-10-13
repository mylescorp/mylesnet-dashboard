/** Payout state transition rules shared by Convex mutations and unit tests. */
export type PayoutStatus =
  | "pending_approval"
  | "approved"
  | "processing"
  | "paid"
  | "rejected";

const ALLOWED_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> = {
  pending_approval: ["approved", "rejected"],
  approved: ["processing"],
  processing: ["paid"],
  paid: [],
  rejected: [],
};

export function assertPayoutTransition(current: PayoutStatus, next: PayoutStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error("This payout can no longer move to that status.");
  }
}
