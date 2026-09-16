import { redirect } from "next/navigation";
import { hasPanelAccess, type ProtectedPanel } from "./panelAccess";
import { requireUser } from "./session";

export type PanelName = ProtectedPanel;

/** Server-only entry gate. Convex remains the authority for every data call. */
export async function requirePanelAccess(panel: PanelName): Promise<void> {
  try {
    const session = await requireUser();
    if (!hasPanelAccess(session.roleSlugs, panel)) throw new Error("Panel access denied");
  } catch {
    redirect("/no-access");
  }

  // Agency and Partner hosts are provisioned, but stay data-dark until their
  // independently approved modules are enabled.
  if ((panel === "agency" && process.env.NEXT_PUBLIC_ENABLE_AGENCY_PANEL !== "true") ||
      (panel === "partner" && process.env.NEXT_PUBLIC_ENABLE_PARTNER_PANEL !== "true")) {
    redirect("/no-access?reason=panel_not_enabled");
  }
}
