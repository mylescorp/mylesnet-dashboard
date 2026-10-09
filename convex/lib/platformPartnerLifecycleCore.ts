export type RelationshipLifecycleRow = {
  id: string;
  status: "active" | "suspended";
  statusBeforeSuspension?: "active";
  suspendedByRelationshipId?: string;
};

export function planPartnerSuspend(root: RelationshipLifecycleRow, descendants: RelationshipLifecycleRow[]) {
  if (root.status !== "active") throw new Error("Only an active relationship can be suspended");
  const rootPatch = { status: "suspended" as const, statusBeforeSuspension: "active" as const, suspendedByRelationshipId: undefined };
  const descendantPatches = descendants
    .filter(row => row.status === "active")
    .map(row => ({ id: row.id, patch: { status: "suspended" as const, statusBeforeSuspension: "active" as const, suspendedByRelationshipId: root.id } }));
  return { rootPatch, descendantPatches };
}

export function planPartnerRestore(root: RelationshipLifecycleRow, descendants: RelationshipLifecycleRow[]) {
  if (root.status !== "suspended") throw new Error("Only a suspended relationship can be restored");
  const rootPatch = { status: root.statusBeforeSuspension ?? "active" as const, statusBeforeSuspension: undefined, suspendedByRelationshipId: undefined };
  const descendantPatches = descendants
    .filter(row => row.status === "suspended" && row.suspendedByRelationshipId === root.id)
    .map(row => ({ id: row.id, patch: { status: row.statusBeforeSuspension ?? "active" as const, statusBeforeSuspension: undefined, suspendedByRelationshipId: undefined } }));
  return { rootPatch, descendantPatches };
}
