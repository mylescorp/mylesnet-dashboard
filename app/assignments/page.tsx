"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Users, ShieldCheck, UserX, Trophy } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { maximumFractionDigits: d });

export default function AssignmentsPage() {
  const agents = useQuery(api.agents.listAgents, {});
  const teams = useQuery(api.teams.listTeams, {});
  const topAgents = useQuery(api.analytics.getTopAgents, { days: 30, limit: 20 });

  if (agents === undefined || teams === undefined || topAgents === undefined) return <Loading />;

  const teamByAgent = new Map<string, string>();
  for (const team of teams) {
    for (const member of team.agents) teamByAgent.set(member.agentId, team.name);
  }
  const active = agents.filter((a) => a.status !== "deleted" && a.status !== "terminated" && a.lifecycleStatus !== "deactivated");
  const assigned = active.filter((a) => teamByAgent.has(a._id));
  const unassigned = active.filter((a) => !teamByAgent.has(a._id));
  const revenueByAgent = new Map(topAgents.map((t) => [t.agentId, t.revenueLocal]));
  const best = topAgents.length ? topAgents[0] : undefined;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">People</p>
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">Agent roster coverage — who is on a team and who needs one, plus recent output.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Users} label="Active agents" value={active.length} tone="primary" detail="Not terminated or deleted" />
        <MetricCard icon={ShieldCheck} label="Assigned" value={assigned.length} tone="success" detail="On a team" />
        <MetricCard icon={UserX} label="Unassigned" value={unassigned.length} tone={unassigned.length > 0 ? "warning" : "neutral"} detail="Need a team" />
        <MetricCard icon={Trophy} label="Top performer" value={best ? best.agentName : "—"} tone="accent" detail={best ? `${n(best.revenueLocal)} last 30 days` : undefined} />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Roster</p><h2>Agent assignments</h2></div>
        </div>
        <div className="pf-panel">
          {agents.length === 0 ? (
            <EmptyState title="No agents yet" body="Agents appear here once onboarded." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Team</th>
                    <th className="pf-hide-sm">Phone</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Output (30d)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...active].sort((a, b) => (revenueByAgent.get(b._id) ?? 0) - (revenueByAgent.get(a._id) ?? 0)).map((a) => {
                    const team = teamByAgent.get(a._id);
                    return (
                      <tr key={a._id}>
                        <td><strong>{a.name}</strong></td>
                        <td>{team ? <StatusPill tone="success">{team}</StatusPill> : <StatusPill tone="warning">Unassigned</StatusPill>}</td>
                        <td className="pf-hide-sm">{a.phone}</td>
                        <td><StatusPill tone={a.status === "active" ? "success" : "neutral"}>{a.status}</StatusPill></td>
                        <td className="pf-hide-sm">{revenueByAgent.has(a._id) ? n(revenueByAgent.get(a._id)!) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
