import { requirePanelAccess } from "@/lib/auth/panels";
import Link from "next/link";

export default async function AdminEntryPage() {
  await requirePanelAccess("admin");
  return <main className="workspace-page tenant-admin-entry"><p className="eyebrow">Tenant administration</p><h1 className="page-title">Your tenant workspace</h1><p className="page-subtitle">Open the tenant control surface to view the workspace derived from your active organization membership.</p><Link href="/dashboard/tenant" className="primary-button">Open tenant workspace</Link></main>;
}
