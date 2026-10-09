"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Infinity as InfinityIcon,
  Layers,
  Network,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { firstUsableAddress } from "@/shared/lib/ipv4-subnet";

/**
 * IPv4 subnet calculator — pure client-side, nothing sent anywhere.
 *
 * Parses a CIDR such as "192.168.1.0/24" and reports the network, usable
 * range, host counts, mask, and wildcard. A companion "hosts needed" helper
 * answers the planning question ("how many /29s fit a hotspot pool?").
 * Edge prefixes (/31, /32, /0) are handled honestly rather than hidden.
 */

const parseIpv4 = (value: string): number | null => {
  const octets = value.trim().split(".");
  if (octets.length !== 4) return null;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    const number = Number(octet);
    if (number > 255) return null;
  }
  return (
    ((Number(octets[0]) * 256 + Number(octets[1])) * 256 + Number(octets[2])) * 256 +
    Number(octets[3])
  );
};

const intToIp = (value: number): string => {
  const a = (value >>> 24) & 255;
  const b = (value >>> 16) & 255;
  const c = (value >>> 8) & 255;
  const d = value & 255;
  return `${a}.${b}.${c}.${d}`;
};

const maskForPrefix = (prefix: number): number =>
  prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

const parseCidr = (value: string): { ip: number; prefix: number } | null => {
  const match = value.trim().match(/^([0-9.]+)\/(\d{1,2})$/);
  if (!match) return null;
  const ip = parseIpv4(match[1]);
  if (ip === null) return null;
  const prefix = Number(match[2]);
  if (prefix < 0 || prefix > 32) return null;
  return { ip, prefix };
};

const recommendedPrefix = (hosts: number): number | null => {
  if (!Number.isFinite(hosts) || hosts <= 0) return null;
  const needed = hosts + 2;
  if (needed > 2 ** 31) return null;
  const bits = Math.ceil(Math.log2(needed));
  return 32 - bits;
};

const PRESETS = [
  { label: "MikroTik default", value: "192.168.88.0/24" },
  { label: "Home / estate", value: "192.168.1.0/24" },
  { label: "Hotspot pool", value: "10.0.4.0/29" },
  { label: "Small VLAN", value: "172.16.8.0/30" },
];

type MetricBarProps = {
  label: string;
  icon: ReactNode;
  value: string;
};

function MetricBar({ label, icon, value }: MetricBarProps) {
  return (
    <div className="landing-card landing-card-compact landing-tool-metric">
      <span className="landing-tool-label">
        {icon}
        {label}
      </span>
      <span className="landing-tool-value landing-tool-value-sm">{value}</span>
    </div>
  );
}

export default function SubnetCalculatorTool() {
  const [cidrValue, setCidrValue] = useState("192.168.88.0/24");
  const [hostsValue, setHostsValue] = useState("250");

  const result = useMemo(() => {
    const parsed = parseCidr(cidrValue);
    if (!parsed) return null;
    const { ip, prefix } = parsed;
    const mask = maskForPrefix(prefix);
    const network = (ip & mask) >>> 0;
    const broadcast = (network | ~mask) >>> 0;
    const total = 2 ** (32 - prefix);
    let usable: number;
    if (prefix >= 31) usable = prefix === 31 ? 2 : 1;
    else usable = total - 2;
    const first = firstUsableAddress(network, prefix);
    const last = prefix === 31 ? broadcast : prefix === 32 ? network : broadcast - 1;
    const wildcard = (~mask) >>> 0;

    const notes: string[] = [];
    if (prefix === 31) notes.push("A /31 gives two usable addresses — a point-to-point link, not a network for hosts.");
    if (prefix === 32) notes.push("A /32 is a single host address, used for loopback-style entries.");
    if (prefix === 0) notes.push("A /0 is the whole IPv4 space — only meaningful in routing tables, not for a subnet.");
    if (prefix <= 8) notes.push(`A /${prefix} is enormous — make sure a host count this large is what you intended.`);

    return { network, first, last, broadcast, total, usable, mask, wildcard, prefix, notes };
  }, [cidrValue]);

  const hostsPrefix = useMemo(() => {
    const hosts = Number(hostsValue);
    const prefix = recommendedPrefix(hosts);
    if (prefix === null) return null;
    const usable = prefix >= 31 ? (prefix === 31 ? 2 : 1) : 2 ** (32 - prefix) - 2;
    return { prefix, usable };
  }, [hostsValue]);

  const cidrError = cidrValue.trim() !== "" && !result;

  return (
    <div className="landing-tool">
      <form
        className="landing-tool-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="landing-field">
          <label className="landing-field-label" htmlFor="subnet-cidr">
            Network in CIDR form
          </label>
          <input
            id="subnet-cidr"
            className={`landing-field-input${cidrError ? " landing-field-input--error" : ""}`}
            type="text"
            value={cidrValue}
            onChange={(event) => setCidrValue(event.target.value)}
            placeholder="192.168.1.0/24"
            aria-describedby="subnet-cidr-help"
            spellCheck={false}
          />
          <p className="landing-field-help" id="subnet-cidr-help">
            Address and prefix, e.g. 192.168.1.0/24 or an address from the range.
          </p>
        </div>

        <div className="landing-field-tabs" role="group" aria-label="Example networks">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`landing-field-tab${cidrValue === preset.value ? " landing-field-tab--active" : ""}`}
              onClick={() => setCidrValue(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>

      {cidrError && (
        <p className="landing-tool-status" role="alert">
          Enter a valid IPv4 address and a prefix between 0 and 32 — for example, 192.168.1.0/24.
        </p>
      )}

      {result && (
        <div className="landing-tool-grid" style={{ width: "100%" }}>
          <MetricBar label="Network" icon={<Network size={15} aria-hidden="true" />} value={intToIp(result.network)} />
          <MetricBar label="First usable" icon={<ArrowUp size={15} aria-hidden="true" />} value={intToIp(result.first)} />
          <MetricBar label="Last usable" icon={<ArrowDown size={15} aria-hidden="true" />} value={intToIp(result.last)} />
          <MetricBar label="Broadcast" icon={<Radio size={15} aria-hidden="true" />} value={intToIp(result.broadcast)} />
          <MetricBar label="Usable hosts" icon={<Users size={15} aria-hidden="true" />} value={String(result.usable)} />
          <MetricBar label="Total addresses" icon={<Layers size={15} aria-hidden="true" />} value={String(result.total)} />
          <MetricBar label="Netmask" icon={<Box size={15} aria-hidden="true" />} value={intToIp(result.mask)} />
          <MetricBar label="Wildcard" icon={<InfinityIcon size={15} aria-hidden="true" />} value={intToIp(result.wildcard)} />
        </div>
      )}

      {result && result.notes.length > 0 && (
        <ul className="landing-prose-note" style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
          {result.notes.map((note) => (
            <li key={note.slice(0, 24)}>{note}</li>
          ))}
        </ul>
      )}

      <div className="landing-tool-form">
        <div className="landing-field">
          <label className="landing-field-label" htmlFor="subnet-hosts">
            Hosts a pool must fit
          </label>
          <input
            id="subnet-hosts"
            className="landing-field-input"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={hostsValue}
            onChange={(event) => setHostsValue(event.target.value)}
            aria-describedby="subnet-hosts-help"
          />
          <p className="landing-field-help" id="subnet-hosts-help">
            {hostsPrefix
              ? `A /${hostsPrefix.prefix} fits ${hostsPrefix.usable} usable hosts — subtract the network and broadcast addresses from the total.`
              : "Enter the number of hosts; the calculator suggests the prefix that fits them."}
          </p>
        </div>
      </div>

      <div className="landing-tool-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setCidrValue("192.168.88.0/24");
            setHostsValue("250");
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Reset
        </Button>
        <p className="landing-tool-status" role="status" aria-live="polite">
          {result
            ? `/${result.prefix} with ${result.usable} usable host${result.usable === 1 ? "" : "s"}.`
            : "Enter a CIDR to see the network's details."}
        </p>
      </div>

      <p className="landing-prose-note">
        Usable-host arithmetic drops the network and broadcast addresses, which is the number
        that matters when you size a hotspot pool or a PPPoE range. Everything is computed in
        your browser — nothing is sent anywhere.
      </p>
    </div>
  );
}
