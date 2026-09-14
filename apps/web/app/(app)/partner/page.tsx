import { requirePanelAccess } from "@/lib/auth/panels";

export default async function PartnerEntryPage() {
  await requirePanelAccess("partner");
  return <main><h1>Partner</h1><p>Partner access is confirmed.</p></main>;
}
