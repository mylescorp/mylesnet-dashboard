export type PolicyFields = {
  downloadMbps: number; uploadMbps: number; burstDownloadMbps?: number; burstUploadMbps?: number;
  burstThresholdPercent?: number; burstWindowSeconds?: number; concurrentSessions: number; deviceLimit: number;
  dataQuotaGb?: number; timeQuotaHours?: number; fairUseAfterGb?: number; fairUseDownloadMbps?: number; fairUseUploadMbps?: number;
  vlanId?: number; ipPool?: string; staticIpAllowed: boolean; dnsServers: string[]; scheduleStart?: string; scheduleEnd?: string;
  idleTimeoutMinutes?: number; sessionTimeoutHours?: number; firewallProfile?: string; serviceEnabled: boolean;
};

/** Convex arguments cannot contain undefined values; omit blank optional fields. */
export function omitUndefinedFields<T extends object>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

export function validatePolicy(fields: PolicyFields) {
  const bounded = (value: number | undefined, min: number, max: number) => value === undefined || (Number.isFinite(value) && value >= min && value <= max);
  if (!bounded(fields.downloadMbps, 0.1, 10000) || !bounded(fields.uploadMbps, 0.1, 10000)) throw new Error("Access speeds must be between 0.1 and 10,000 Mbps");
  if (!bounded(fields.burstDownloadMbps, fields.downloadMbps, 20000) || !bounded(fields.burstUploadMbps, fields.uploadMbps, 20000)) throw new Error("Burst speeds must be at least the standard speed and no more than 20,000 Mbps");
  if (!bounded(fields.burstThresholdPercent, 1, 100) || !bounded(fields.burstWindowSeconds, 1, 3600)) throw new Error("Burst settings are outside the supported range");
  if ((fields.burstThresholdPercent === undefined) !== (fields.burstWindowSeconds === undefined)) throw new Error("Set both burst threshold and window");
  if ((fields.burstDownloadMbps === undefined) !== (fields.burstUploadMbps === undefined)) throw new Error("Set both burst speeds");
  if (!Number.isInteger(fields.concurrentSessions) || !bounded(fields.concurrentSessions, 1, 1000)) throw new Error("Concurrent sessions must be between 1 and 1,000");
  if (!Number.isInteger(fields.deviceLimit) || !bounded(fields.deviceLimit, 1, 1000)) throw new Error("Device limit must be between 1 and 1,000");
  if (!bounded(fields.dataQuotaGb, 0.01, 1000000) || !bounded(fields.timeQuotaHours, 0.01, 87600) || !bounded(fields.fairUseAfterGb, 0.01, 1000000)) throw new Error("Quota values are outside the supported range");
  const hasFairUseRates = fields.fairUseDownloadMbps !== undefined && fields.fairUseUploadMbps !== undefined;
  if ((fields.fairUseAfterGb !== undefined) !== hasFairUseRates || (fields.fairUseDownloadMbps === undefined) !== (fields.fairUseUploadMbps === undefined)) throw new Error("Set a fair-use threshold and both fair-use speeds together");
  if (!bounded(fields.fairUseDownloadMbps, 0.1, fields.downloadMbps) || !bounded(fields.fairUseUploadMbps, 0.1, fields.uploadMbps)) throw new Error("Fair-use speeds must be between 0.1 Mbps and the standard speed");
  if (fields.vlanId !== undefined && (!Number.isInteger(fields.vlanId) || !bounded(fields.vlanId, 1, 4094))) throw new Error("VLAN ID must be between 1 and 4,094");
  if (fields.ipPool && fields.ipPool.length > 100) throw new Error("IP pool name is too long");
  if (fields.dnsServers.length > 4 || fields.dnsServers.some((ip) => !/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip))) throw new Error("Enter up to four valid IPv4 DNS server addresses");
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((fields.scheduleStart === undefined) !== (fields.scheduleEnd === undefined) || (fields.scheduleStart !== undefined && (!time.test(fields.scheduleStart) || !time.test(fields.scheduleEnd!)))) throw new Error("Set both schedule times using 24-hour HH:MM format");
  if (!bounded(fields.idleTimeoutMinutes, 1, 10080) || !bounded(fields.sessionTimeoutHours, 0.01, 87600)) throw new Error("Session timeout values are outside the supported range");
  if ((fields.firewallProfile?.length ?? 0) > 80) throw new Error("Firewall profile name is too long");
}
