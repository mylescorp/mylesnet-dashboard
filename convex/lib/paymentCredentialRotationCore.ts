export type CredentialRotationLease = {
  operationId?: string;
  startedAt?: number;
};

export type CredentialRotationRequestState = "blocked" | "resume" | "start";

export function credentialRotationRequestState(input: {
  lease: CredentialRotationLease;
  requestedOperationId: string;
  now: number;
  leaseDurationMs: number;
}): CredentialRotationRequestState {
  if (input.lease.operationId === undefined || input.lease.startedAt === undefined) return "start";
  const elapsed = input.now - input.lease.startedAt;
  const active = elapsed >= 0 && elapsed < input.leaseDurationMs;
  if (!active) return "start";
  return input.lease.operationId === input.requestedOperationId ? "resume" : "blocked";
}
