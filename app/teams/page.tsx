"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Plus, Shield, UserPlus, Users, UserMinus, Pencil, Archive } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, ErrorNote, Loading, Select, TextInput, formatDate } from "@/app/components/ui";
import { useUserProfile } from "@/app/components/UserProfileContext";

export default function TeamsPage() {
  const teams = useQuery(api.teams.listTeams, {});
  const agents = useQuery(api.agents.listAgents, {});
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeam = useMutation(api.teams.updateTeam);
  const removeTeam = useMutation(api.teams.removeTeam);
  const addMember = useMutation(api.teams.addTeamMember);
  const removeMember = useMutation(api.teams.removeTeamMember);
  const { user } = useUserProfile();
  const canManage = user?.permissions?.includes("teams:manage") === true;
  const [editing, setEditing] = useState<Id<"teams"> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [leaderAgentId, setLeaderAgentId] = useState("");
  const [memberAgentId, setMemberAgentId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (teams === undefined || agents === undefined) return <Loading />;
  const totalAgents = teams.reduce((sum, team) => sum + team.agents.length, 0);
  const biggest = teams.reduce((a, b) => (b.agents.length > (a?.agents.length ?? 0) ? b : a), teams[0]);
  const reset = () => { setEditing(null); setFormOpen(false); setName(""); setLeaderAgentId(""); setError(null); };
  const save = async () => {
    setError(null);
    try {
      if (!name.trim()) throw new Error("Team name is required");
      if (editing) await updateTeam({ teamId: editing, name: name.trim(), leaderAgentId: leaderAgentId ? leaderAgentId as Id<"agents"> : undefined });
      else await createTeam({ name: name.trim(), leaderAgentId: leaderAgentId ? leaderAgentId as Id<"agents"> : undefined });
      reset();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save team"); }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading"><div><p className="eyebrow">People</p><h1 className="page-title">Teams</h1><p className="page-subtitle">Sales teams and the agents in them, with auditable membership changes.</p></div>{canManage && <button className="pf-button pf-button-primary" onClick={() => { setEditing(null); setFormOpen(true); setName(""); setLeaderAgentId(""); setError(null); }}><Plus size={15} /> Add team</button>}</div>
      <div className="metric-grid"><MetricCard icon={Users} label="Teams" value={teams.length} tone="primary" detail="Active" /><MetricCard icon={UserPlus} label="Agents assigned" value={totalAgents} tone="accent" detail="Across teams" /><MetricCard icon={Shield} label="Largest team" value={biggest ? biggest.name : "—"} tone="success" detail={biggest ? `${biggest.agents.length} agents` : undefined} /></div>
      {canManage && (formOpen || editing !== null) && <div className="section-block"><div className="pf-panel"><div className="section-heading"><div><p className="eyebrow">{editing ? "Update" : "Create"}</p><h2>{editing ? "Edit team" : "New team"}</h2></div></div>{error && <ErrorNote>{error}</ErrorNote>}<div className="grid gap-4 sm:grid-cols-2"><label className="pf-field"><span className="pf-label">Team name *</span><TextInput value={name} onChange={(event) => setName(event.target.value)} /></label><label className="pf-field"><span className="pf-label">Leader</span><Select value={leaderAgentId} onChange={(event) => setLeaderAgentId(event.target.value)}><option value="">No leader</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Select></label></div><div className="flex justify-end gap-3"><button className="pf-button" onClick={reset}>Cancel</button><button className="pf-button pf-button-primary" onClick={save}>Save team</button></div></div></div>}
      <div className="section-block"><div className="section-heading"><div><p className="eyebrow">Rosters</p><h2>Teams</h2></div></div>{teams.length === 0 ? <div className="pf-panel"><EmptyState title="No teams yet" body="Create a team and assign agents." /></div> : <div className="pf-panel"><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Team</th><th>Agents</th><th className="pf-hide-sm">Members</th><th>Created</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{teams.map((team) => <tr key={team._id}><td><strong>{team.name}</strong></td><td>{team.agents.length}</td><td className="pf-hide-sm">{team.agents.length ? team.agents.slice(0, 6).map((member) => member.agentName).join(", ") + (team.agents.length > 6 ? ` +${team.agents.length - 6} more` : "") : "—"}</td><td className="pf-hide-sm">{formatDate(team.createdAt)}</td>{canManage && <td><button className="pf-button pf-button-compact" title="Edit" onClick={() => { setEditing(team._id); setFormOpen(true); setName(team.name); setLeaderAgentId(team.leaderAgentId ?? ""); }}><Pencil size={14} /></button><button className="pf-button pf-button-compact" title="Archive" onClick={async () => { if (window.confirm("Archive this team?")) await removeTeam({ teamId: team._id }); }}><Archive size={14} /></button></td>}</tr>)}</tbody></table></div></div>}</div>
      {teams.map((team) => <div className="section-block" key={`detail-${team._id}`}><div className="section-heading"><div><p className="eyebrow">Roster</p><h2>{team.name}</h2></div></div><div className="pf-panel"><div className="flex items-center gap-3" style={{ marginBottom: 12 }}>{canManage && <><Select value={memberAgentId[team._id] ?? ""} onChange={(event) => setMemberAgentId((current) => ({ ...current, [team._id]: event.target.value }))}><option value="">Add agent…</option>{agents.filter((agent) => !team.agents.some((member) => member.agentId === agent._id)).map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Select><button className="pf-button" disabled={!memberAgentId[team._id]} onClick={async () => { const agentId = memberAgentId[team._id]; if (agentId) { await addMember({ teamId: team._id, agentId: agentId as Id<"agents"> }); setMemberAgentId((current) => ({ ...current, [team._id]: "" })); } }}>Add</button></>}</div>{team.agents.length === 0 ? <p className="pf-muted">No agents assigned.</p> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Agent</th><th className="pf-hide-sm">Joined</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{team.agents.map((member) => <tr key={member.memberId}><td><strong>{member.agentName}</strong></td><td className="pf-hide-sm">{formatDate(member.joinedAt)}</td>{canManage && <td><button className="pf-button pf-button-compact" title="Remove from team" onClick={async () => { if (window.confirm("Remove this agent from the team?")) await removeMember({ teamId: team._id, agentId: member.agentId }); }}><UserMinus size={14} /></button></td>}</tr>)}</tbody></table></div>}</div></div>)}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
