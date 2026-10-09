"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@/app/lib/convex";
import { platformPartners } from "@/shared/convex/platformPartners";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

export function PlatformPartnerLifecycle({ id, action }: { id: string; action: "suspend" | "restore" }) {
  const row = useQuery(platformPartners.get, { id });
  const suspend = useMutation(platformPartners.suspend);
  const restore = useMutation(platformPartners.restore);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (row === undefined) return <main className="workspace-page"><p>Loading relationship…</p></main>;
  if (!row) return <main className="workspace-page"><h1 className="page-title">Relationship unavailable</h1><p className="page-subtitle">This relationship may have been archived.</p></main>;
  const isSuspend = action === "suspend";
  const submit = async () => {
    setSaving(true); setError(null); setNotice(null);
    try {
      const result = isSuspend ? await suspend({ id, reason }) : await restore({ id, reason });
      setNotice(`${isSuspend ? "Suspended" : "Restored"} successfully. ${result.affectedRelationships} linked relationship(s) affected.`);
    } catch (cause) { setError(userFacingMessage(cause, "The relationship could not be changed.")); }
    finally { setSaving(false); }
  };
  return <main className="workspace-page"><header className="page-heading"><div><p className="eyebrow">{row.type} oversight</p><h1 className="page-title">{isSuspend ? "Suspend partner relationship" : "Restore partner relationship"}</h1><p className="page-subtitle">{row.parent?.name ?? "Unknown operator"} → {row.partner?.name ?? "Unknown partner"}</p></div></header><section className="pf-panel"><p>This action is audited and applies to descendant relationship access. It does not delete tenant data or interrupt active network sessions.</p>{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}{notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}<label className="pf-field"><span className="pf-label">{isSuspend ? "Suspension reason" : "Restoration reason"}</span><textarea className="pf-input" rows={4} minLength={8} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} /></label><div className="modal-actions"><Link className="secondary-button" href={row.type === "agency" ? "/platform/agencies" : "/platform/resellers"}>Back to registry</Link><button className="primary-button" type="button" disabled={saving || reason.trim().length < 8} onClick={() => void submit()}>{saving ? "Saving…" : isSuspend ? "Suspend relationship" : "Restore relationship"}</button></div></section></main>;
}
