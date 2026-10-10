"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformSupport } from "@/shared/convex/platformSupport";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { useState } from "react";

export function PlatformSupportTicketDetail({ ticketId }: { ticketId: string }) {
  const { user } = useUserProfile();
  const ticket = useQuery(platformSupport.get, { ticketId });
  const update = useMutation(platformSupport.update);
  const [error, setError] = useState("");
  const canManage = user?.roles.some(role => ["platform_super_admin", "platform_owner", "platform_admin", "platform_support"].includes(role.slug)) ?? false;
  if (ticket === undefined) return <p className="pf-muted">Loading ticket…</p>;
  if (!ticket) return <EmptyState title="Ticket not found" body="The ticket is missing, deleted, or outside your role scope." />;
  return <main className="workspace-page"><header className="page-heading"><div><p className="eyebrow"><Link href="/platform/support">Global ticket queue</Link></p><h1 className="page-title">{ticket.subject}</h1><p className="page-subtitle">{ticket.category ?? "account"} · {ticket.priority} · {ticket.ticketStatus.replaceAll("_", " ")}</p></div><StatusPill tone={ticket.ticketStatus === "resolved" || ticket.ticketStatus === "closed" ? "success" : "warning"}>{ticket.ticketStatus.replaceAll("_", " ")}</StatusPill></header>
    <section className="pf-panel">{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}<p>{ticket.description}</p><dl className="tenant-detail-fields"><dt>Category</dt><dd>{ticket.category}</dd><dt>Workspace</dt><dd>{ticket.tenantName ?? "Platform"}</dd><dt>Market</dt><dd>{ticket.marketName ?? "—"}</dd><dt>Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd><dt>First response due</dt><dd>{ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt).toLocaleString() : "—"}</dd><dt>Resolution due</dt><dd>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : "—"}</dd></dl>
      {canManage ? <button className="secondary-button" onClick={async () => { const subject = window.prompt("Ticket subject", ticket.subject); if (subject === null) return; const description = window.prompt("Ticket description", ticket.description); if (description === null) return; setError(""); try { await update({ ticketId, subject, description }); } catch (cause) { setError(userFacingMessage(cause, "Ticket details could not be updated.")); } }}>Edit details</button> : null}</section>
  </main>;
}
