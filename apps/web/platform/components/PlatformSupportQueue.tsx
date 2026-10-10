"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@/app/lib/convex";
import { usePaginatedQuery } from "convex/react";
import { platformSupport, type PlatformTicketCategory, type PlatformTicketStatus } from "@/shared/convex/platformSupport";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { hasAnyRole } from "@/shared/auth/rbac";

const categories: PlatformTicketCategory[] = ["network", "billing", "account"];
const statuses: PlatformTicketStatus[] = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"];
const roles = (slugs: string[]) => ({
  canWriteAll: hasAnyRole(slugs, ["platform_super_admin", "platform_owner", "platform_admin", "platform_support"]),
  canRead: hasAnyRole(slugs, ["platform_super_admin", "platform_owner", "platform_admin", "platform_support", "platform_ops", "ops_manager", "platform_finance", "finance_manager"]),
});

export function PlatformSupportQueue() {
  const { user } = useUserProfile();
  const [category, setCategory] = useState<PlatformTicketCategory | "all">("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState(""); const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState<PlatformTicketCategory>("network");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busyId, setBusyId] = useState("");
  const access = roles(user?.roles.map(role => role.slug) ?? []);
  const { results: tickets, status: pageStatus, loadMore } = usePaginatedQuery(platformSupport.list, { category: category === "all" ? undefined : category, includeDeleted }, { initialNumItems: 50 });
  const create = useMutation(platformSupport.create); const update = useMutation(platformSupport.update);
  const remove = useMutation(platformSupport.delete); const restore = useMutation(platformSupport.restore);

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusyId("new");
    try { await create({ subject, description, category: newCategory, priority }); setMessage("Platform ticket created."); setSubject(""); setDescription(""); setCreating(false); }
    catch (caught) { setError(userFacingMessage(caught, "Ticket could not be created.")); }
    finally { setBusyId(""); }
  }

  async function changeStatus(ticketId: string, ticketStatus: PlatformTicketStatus) {
    setBusyId(ticketId); setError(""); setMessage("");
    try { await update({ ticketId, ticketStatus }); setMessage("Ticket updated."); }
    catch (caught) { setError(userFacingMessage(caught, "Ticket could not be updated.")); }
    finally { setBusyId(""); }
  }

  async function changePriority(ticketId: string, ticketPriority: "low" | "medium" | "high" | "urgent") {
    setBusyId(ticketId); setError(""); setMessage("");
    try { await update({ ticketId, priority: ticketPriority }); setMessage("Ticket priority updated."); }
    catch (caught) { setError(userFacingMessage(caught, "Priority could not be updated.")); }
    finally { setBusyId(""); }
  }

  async function editText(ticket: { _id: string; subject: string; description: string }) {
    const nextSubject = access.canWriteAll ? window.prompt("Ticket subject", ticket.subject) : ticket.subject;
    if (nextSubject === null) return;
    const nextDescription = window.prompt("Ticket description", ticket.description);
    if (nextDescription === null) return;
    setBusyId(ticket._id); setError(""); setMessage("");
    try { await update({ ticketId: ticket._id, subject: access.canWriteAll ? nextSubject : undefined, description: nextDescription }); setMessage("Ticket details updated."); }
    catch (caught) { setError(userFacingMessage(caught, "Ticket details could not be updated.")); }
    finally { setBusyId(""); }
  }

  async function deleteTicket(ticketId: string) {
    const reason = window.prompt("Reason for deleting this ticket? (8–500 characters)")?.trim(); if (!reason) return;
    setBusyId(ticketId); setError(""); setMessage("");
    try { await remove({ ticketId, reason }); setMessage("Ticket moved to deleted records."); }
    catch (caught) { setError(userFacingMessage(caught, "Ticket could not be deleted.")); }
    finally { setBusyId(""); }
  }

  async function restoreTicket(ticketId: string) {
    setBusyId(ticketId); setError(""); setMessage("");
    try { await restore({ ticketId }); setMessage("Ticket restored."); }
    catch (caught) { setError(userFacingMessage(caught, "Ticket could not be restored.")); }
    finally { setBusyId(""); }
  }

  if (!access.canRead) return <main className="workspace-page"><h1 className="page-title">Support queue</h1><p className="pf-muted">Your platform role does not have access to the global support queue.</p></main>;
  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform support</p><h1 className="page-title">Global ticket queue</h1><p className="page-subtitle">Support has full ticket access. Operations sees network tickets; finance sees billing tickets.</p></div>{access.canWriteAll ? <button className="primary-button" onClick={() => setCreating(value => !value)}>{creating ? "Cancel" : "New ticket"}</button> : null}</header>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    {creating ? <form className="pf-panel" onSubmit={event => void createTicket(event)}><div className="form-grid"><label className="pf-field"><span className="pf-label">Subject</span><input className="pf-input" required maxLength={180} value={subject} onChange={event => setSubject(event.target.value)} /></label><label className="pf-field"><span className="pf-label">Category</span><select className="pf-input" value={newCategory} onChange={event => setNewCategory(event.target.value as PlatformTicketCategory)}>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="pf-field"><span className="pf-label">Priority</span><select className="pf-input" value={priority} onChange={event => setPriority(event.target.value as typeof priority)}>{["low", "medium", "high", "urgent"].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="pf-field" style={{ gridColumn: "1 / -1" }}><span className="pf-label">Description</span><textarea className="pf-input" required maxLength={10000} rows={4} value={description} onChange={event => setDescription(event.target.value)} /></label></div><button className="pf-button" disabled={busyId === "new"}>{busyId === "new" ? "Creating…" : "Create ticket"}</button></form> : null}
    <section className="pf-panel"><div className="pf-page-toolbar"><label className="pf-field"><span className="pf-label">Category</span><select className="pf-input" value={category} onChange={event => setCategory(event.target.value as PlatformTicketCategory | "all")}><option value="all">All in my role scope</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>{access.canWriteAll ? <label className="pf-field"><span className="pf-label">Records</span><select className="pf-input" value={includeDeleted ? "deleted" : "active"} onChange={event => setIncludeDeleted(event.target.value === "deleted")}><option value="active">Active tickets</option><option value="deleted">Deleted tickets</option></select></label> : null}</div>
      {pageStatus === "LoadingFirstPage" ? <p className="pf-muted">Loading tickets…</p> : tickets.length === 0 ? <EmptyState title="No tickets" body="There are no tickets matching this category and status." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Ticket</th><th>Tenant</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA due</th><th>Actions</th></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket._id}><td><Link href={`/platform/support/${ticket._id}`}><strong>{ticket.subject}</strong></Link><small className="table-subtext">{ticket.description}</small></td><td>{ticket.tenantName ?? "Platform"}</td><td>{access.canWriteAll && !ticket.deletedAt ? <select className="pf-input" disabled={busyId === ticket._id} value={ticket.category ?? "account"} onChange={event => { setBusyId(ticket._id); setError(""); setMessage(""); void update({ ticketId: ticket._id, category: event.target.value as PlatformTicketCategory }).then(() => setMessage("Ticket category updated.")).catch(caught => setError(userFacingMessage(caught, "Category could not be updated."))).finally(() => setBusyId("")); }}>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select> : ticket.category ?? "account"}</td><td>{ticket.deletedAt ? ticket.priority : <select className="pf-input" disabled={busyId === ticket._id} value={ticket.priority} onChange={event => void changePriority(ticket._id, event.target.value as "low" | "medium" | "high" | "urgent")}>{["low", "medium", "high", "urgent"].map(value => <option key={value} value={value}>{value}</option>)}</select>}</td><td>{ticket.deletedAt ? <StatusPill tone="neutral">deleted</StatusPill> : <select className="pf-input" disabled={busyId === ticket._id} value={ticket.ticketStatus} onChange={event => void changeStatus(ticket._id, event.target.value as PlatformTicketStatus)}>{statuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>}</td><td>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : "—"}</td><td><div className="cell-actions">{ticket.deletedAt ? <button type="button" className="secondary-button" disabled={!access.canWriteAll || busyId === ticket._id} onClick={() => void restoreTicket(ticket._id)}>Restore</button> : <><button type="button" className="secondary-button" disabled={busyId === ticket._id} onClick={() => void editText(ticket)}>Edit</button>{access.canWriteAll ? <button type="button" className="secondary-button" disabled={busyId === ticket._id} onClick={() => void deleteTicket(ticket._id)}>Delete</button> : null}</>}</div></td></tr>)}</tbody></table></div>}
      {pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? <button type="button" className="secondary-button" disabled={pageStatus === "LoadingMore"} onClick={() => loadMore(50)}>{pageStatus === "LoadingMore" ? "Loading…" : "Load older tickets"}</button> : null}
    </section>
  </main>;
}
