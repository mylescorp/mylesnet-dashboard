export type TenantLifecycleStatus = "provisioning" | "trial" | "active" | "suspended" | "cancelled";
export type RestorableTenantStatus = "trial" | "active";

export function decideTenantLifecycleTransition(
  current: TenantLifecycleStatus,
  requested: "active" | "suspended",
  statusBeforeSuspension?: RestorableTenantStatus,
): { changed: boolean; status: TenantLifecycleStatus; statusBeforeSuspension?: RestorableTenantStatus } {
  if (requested === "suspended") {
    if (current === "suspended") return { changed: false, status: current, statusBeforeSuspension };
    if (current !== "active" && current !== "trial") {
      throw new Error("Only trial or active tenants can be suspended");
    }
    return { changed: true, status: "suspended", statusBeforeSuspension: current };
  }

  if (current === "cancelled" || current === "provisioning") {
    throw new Error("This tenant lifecycle state cannot be restored or activated here");
  }
  if (current === "suspended") {
    return { changed: true, status: statusBeforeSuspension ?? "active" };
  }
  if (current === "active") return { changed: false, status: current };
  return { changed: true, status: "active" };
}
