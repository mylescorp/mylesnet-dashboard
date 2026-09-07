"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Users, UserPlus, Shield } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill, formatDate } from "@/app/components/ui";

export default function TeamsPage() {
  const teams = useQuery(api.teams.listTeams, {});

  if (teams === undefined) return <Loading />;

  const totalAgents = teams.reduce((s, t) => s + t.agents.length, 0);
  const biggest = teams.reduce((a, b) => (b.agents.length > (a?.agents.length ?? 0) ? b : a), teams[0]);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">People</p>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">Sales teams and the agents in them.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Users} label="Teams" value={teams.length} tone="primary" detail="Active" />
        <MetricCard icon={UserPlus} label="Agents assigned" value={totalAgents} tone="accent" detail="Across teams" />
        <MetricCard icon={Shield} label="Largest team" value={biggest ? biggest.name : "—"} tone="success" detail={biggest ? `${biggest.agents.length} agents` : undefined} />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Rosters</p><h2>Teams</h2></div>
        </div>
        {teams.length === 0 ? (
          <div className="pf-panel">
            <EmptyState title="No teams yet" body="Teams appear here once created and assigned agents." />
          </div>
        ) : (
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Team</th><th>Agents</th><th className="pf-hide-sm">Members</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team._id}>
                      <td><strong>{team.name}</strong></td>
                      <td>{team.agents.length}</td>
                      <td className="pf-hide-sm">
                        {team.agents.length ? team.agents.slice(0, 6).map((m) => m.agentName).join(", ") + (team.agents.length > 6 ? ` +${team.agents.length - 6} more` : "") : "—"}
                      </td>
                      <td className="pf-hide-sm">{formatDate(team.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {teams.length > 0 && (
        <div className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">Detail</p><h2>Team rosters</h2></div>
          </div>
          {teams.map((team) => (
            <div className="pf-panel" key={`detail-${team._id}`} style={{ marginBottom: 14 }}>
              <strong style={{ display: "block", marginBottom: 8 }}>{team.name}</strong>
              {team.agents.length === 0 ? (
                <p className="pf-muted" style={{ margin: 0 }}>No agents assigned.</p>
              ) : (
                <div className="pf-table-wrap">
                  <table className="pf-table">
                    <thead><tr><th>Agent</th><th className="pf-hide-sm">Joined</th></tr></thead>
                    <tbody>
                      {team.agents.map((member) => (
                        <tr key={member.memberId}>
                          <td><strong>{member.agentName}</strong></td>
                          <td className="pf-hide-sm">{formatDate(member.joinedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Status</p><h2>Team state</h2></div>
        </div>
        <div className="pf-panel">
          {teams.map((team) => (
            <p key={team._id} className="pf-muted" style={{ margin: "4px 0" }}>
              <StatusPill tone={team.status === "active" ? "success" : "neutral"}>{team.status}</StatusPill> {team.name}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
