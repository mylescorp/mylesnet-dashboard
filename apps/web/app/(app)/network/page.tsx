import { requirePanelAccess } from "@/lib/auth/panels";

export default async function NetworkEntryPage() {
  await requirePanelAccess("network");
  return <main><h1>Network operations</h1><p>Network access is confirmed.</p></main>;
}
