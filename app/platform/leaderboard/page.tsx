"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState, Loading, ErrorNote, formatMoney } from "../components/ui";
import { Trophy, Medal, Award, CircleSlash2 } from "lucide-react";

export default function LeaderboardPage() {
  const snapshots = useQuery(api.leaderboard.getLeaderboard, {});
  const latestDate = useQuery(api.leaderboard.getLatestSnapshotDate, {});
  const compute = useMutation(api.leaderboard.computeLeaderboard);
  const agents = useQuery(api.agents.listAgents, {});

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (snapshots === undefined || latestDate === undefined || agents === undefined) return <Loading />;

  const agentName = (id: string) => agents.find((a) => a._id === id)?.name ?? `#${String(id).slice(-6)}`;

  const handleCompute = async () => {
    setError(null);
    setBusy(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await compute({ snapshotDate: date });
      setMessage(`Snapshot computed for ${result.agentCount} agents (${date}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compute leaderboard");
    } finally {
      setBusy(false);
    }
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={18} color="#C9B037" />;
    if (rank === 2) return <Medal size={18} color="#A8A9AD" />;
    if (rank === 3) return <Award size={18} color="#B08D57" />;
    return <span className="pf-muted" style={{ width: 18, textAlign: "center" }}>{rank}</span>;
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">Per-agent performance ranking by sales volume, renewal rate, and commission earned.</p>
        </div>
        <button type="button" className="primary-button" onClick={handleCompute} disabled={busy}>
          {busy ? "Computing…" : "Compute Snapshot"}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      {!latestDate && <EmptyState title="No snapshots yet" body="Run a snapshot to generate today's ranking." />}

      {latestDate && (
        <div className="pf-panel">
          <h2>Snapshot · {latestDate}</h2>
          {snapshots.length === 0 ? (
            <EmptyState title="No data for this snapshot" />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Sales Volume</th>
                    <th className="pf-hide-sm">Renewals</th>
                    <th className="pf-hide-sm">Renewal Rate</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s._id}>
                      <td>{rankIcon(s.rank)}</td>
                      <td><strong>{agentName(s.agentId)}</strong></td>
                      <td>{s.totalSalesVolume}</td>
                      <td className="pf-hide-sm">{s.renewalCount}</td>
                      <td className="pf-hide-sm">
                        {s.renewalRateAvailable ? (
                          `${(s.renewalRate! * 100).toFixed(1)}%`
                        ) : (
                          <span className="pf-hint" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                            <CircleSlash2 size={14} /> N/A
                          </span>
                        )}
                      </td>
                      <td>{formatMoney(s.totalCommissionEarned, s.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pf-muted" style={{ marginTop: 12 }}>
            Renewal rate shows <strong>N/A</strong> for agents where renewal data is not yet available
            (pending Centipid CSV reconciliation) — those agents are never misranked against agents with data.
          </p>
        </div>
      )}
    </div>
  );
}
