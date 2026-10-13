/** Paid commissions are completed records and disputed commissions are terminal. */
export function assertCommissionCanBeDisputed(status: string): void {
  if (status === "paid" || status === "disputed") {
    throw new Error("A paid or already disputed commission cannot be disputed");
  }
}
