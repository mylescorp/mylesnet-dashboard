export type PublicGatewaySettingsUpdate = {
  tenantId: string;
  environment?: "sandbox" | "production";
  shortCode?: string;
};

export function makePublicGatewaySettingsUpdate(input: {
  tenantId: string;
  environment: "sandbox" | "production" | "";
  shortCode: string;
}): PublicGatewaySettingsUpdate {
  const shortCode = input.shortCode.trim();
  return {
    tenantId: input.tenantId,
    ...(input.environment ? { environment: input.environment } : {}),
    ...(shortCode ? { shortCode } : {}),
  };
}

export function isPaymentGatewayRotationActive(input: {
  pending: boolean;
  leaseExpiresAt: number | null;
  now: number;
}): boolean {
  return input.pending && input.leaseExpiresAt !== null && input.leaseExpiresAt > input.now;
}
