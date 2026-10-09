const HOST_LABEL = /^(?=.{1,63}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

export type RadiusLifecycle = "planned" | "active" | "degraded" | "maintenance" | "retired";
export type RadiusTransport = "udp" | "tcp" | "tls";
export type PlatformRadiusInput = {
  name: string; hostname: string; region: string; authPort: number; accountingPort: number;
  transport: RadiusTransport; softwareVersion?: string; lifecycleStatus: RadiusLifecycle; capacitySessions?: number;
};

export function validatePlatformRadiusInput(input: PlatformRadiusInput): PlatformRadiusInput {
  const name = input.name.trim();
  const hostname = input.hostname.trim().replace(/\.$/, "");
  const region = input.region.trim();
  if (!name || name.length > 100) throw new Error("Server name must be between 1 and 100 characters");
  if (!hostname || hostname.length > 253 || !hostname.split(".").every(label => HOST_LABEL.test(label))) throw new Error("Enter a hostname or IPv4 address without a scheme or path");
  if (!region || region.length > 100) throw new Error("Region must be between 1 and 100 characters");
  for (const [label, port] of [["Authentication", input.authPort], ["Accounting", input.accountingPort]] as const) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} port must be an integer from 1 to 65535`);
  }
  if (input.authPort === input.accountingPort) throw new Error("Authentication and accounting ports must differ");
  if (input.capacitySessions !== undefined && (!Number.isInteger(input.capacitySessions) || input.capacitySessions < 1 || input.capacitySessions > 100_000_000)) throw new Error("Session capacity must be a positive integer");
  const { softwareVersion: rawSoftwareVersion, capacitySessions, ...required } = input;
  const normalizedVersion = rawSoftwareVersion?.trim();
  if (normalizedVersion !== undefined && normalizedVersion.length > 80) throw new Error("Software version must be 80 characters or fewer");
  return {
    ...required, name, hostname, region,
    ...(normalizedVersion ? { softwareVersion: normalizedVersion } : {}),
    ...(capacitySessions !== undefined ? { capacitySessions } : {}),
  };
}
