export type TenantSnapshotMetric = {
  tenantId: string;
  tenantName: string;
  date: string;
  revenueUSD: number;
  salesCount: number;
  newSubscribers: number;
};

export type TenantLeaderboardMetric = "newSubscribers" | "salesCount" | "revenueUSD";

export function aggregateTenantLeaderboard(rows: TenantSnapshotMetric[], metric: TenantLeaderboardMetric) {
  const byTenant = new Map<string, { tenantId: string; tenantName: string; revenueUSD: number; salesCount: number; newSubscribers: number; snapshotDays: Set<string> }>();
  for (const row of rows) {
    if (!row.tenantId || !Number.isFinite(row.revenueUSD) || !Number.isFinite(row.salesCount) || !Number.isFinite(row.newSubscribers)) continue;
    const tenant = byTenant.get(row.tenantId) ?? {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      revenueUSD: 0,
      salesCount: 0,
      newSubscribers: 0,
      snapshotDays: new Set<string>(),
    };
    tenant.revenueUSD += row.revenueUSD;
    tenant.salesCount += row.salesCount;
    tenant.newSubscribers += row.newSubscribers;
    tenant.snapshotDays.add(row.date);
    byTenant.set(row.tenantId, tenant);
  }
  return [...byTenant.values()]
    .map((row) => ({
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      revenueUSD: Math.round(row.revenueUSD * 100) / 100,
      salesCount: row.salesCount,
      newSubscribers: row.newSubscribers,
      snapshotDays: row.snapshotDays.size,
      score: row[metric],
    }))
    .sort((a, b) => b.score - a.score || a.tenantName.localeCompare(b.tenantName) || a.tenantId.localeCompare(b.tenantId))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
