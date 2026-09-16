import { requirePanelAccess } from "@/lib/auth/panels";

export default async function AgencyEntryPage() {
  await requirePanelAccess("agency");
  return <main><h1>Agency</h1><p>Agency access is confirmed.</p></main>;
}
