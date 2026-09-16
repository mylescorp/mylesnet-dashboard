export function marketSoftDeleteBlockReason(
  activeDevices: number,
  activeAssignments: number,
  forceCascade: boolean,
): string | null {
  if ((activeDevices > 0 || activeAssignments > 0) && !forceCascade) {
    return (
      `This market has ${activeDevices} active device(s) and ${activeAssignments} active agent assignment(s). ` +
      `Choose to soft-delete all dependents together (forceCascade: true) or reassign them first.`
    );
  }
  return null;
}