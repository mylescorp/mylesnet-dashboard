import { requirePanelAccess } from "@/lib/auth/panels";

export default async function ResellerEntryPage() {
  await requirePanelAccess("reseller");
  return <main><h1>Reseller</h1><p>Reseller access is confirmed.</p></main>;
}
