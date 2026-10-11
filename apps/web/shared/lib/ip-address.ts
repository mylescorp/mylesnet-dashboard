/**
 * Address classification for the public "What is my IP" tool.
 *
 * Values arrive from request headers, so equivalent addresses can be spelled in
 * different ways (compressed vs expanded IPv6, dotted vs hexadecimal
 * IPv4-mapped forms). Classification parses each address into numeric parts so
 * the result depends on the address value, not its spelling.
 */

export type AddressKind =
  | "loopback"
  | "link-local"
  | "private"
  | "public"
  | "unknown";

const parseIpv4 = (value: string): number[] | null => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return octets;
};

const classifyIpv4 = (octets: number[]): AddressKind => {
  const [a, b] = octets;
  if (a === 127) return "loopback";
  if (a === 169 && b === 254) return "link-local";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return "private";
  }
  if (a === 0) return "unknown"; // 0.0.0.0/8 "this network"
  return "public";
};

/**
 * Expand an IPv6 string into eight 16-bit groups, or return null when it is not
 * a valid address. Handles `::` compression, zone ids, and a trailing dotted
 * quad (`::ffff:192.168.0.1`).
 */
const parseIpv6 = (input: string): number[] | null => {
  let addr = input.split("%")[0].toLowerCase();
  if (addr.length === 0 || !addr.includes(":")) return null;

  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    const hi = (((v4[0] << 8) | v4[1]) >>> 0).toString(16);
    const lo = (((v4[2] << 8) | v4[3]) >>> 0).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const group of part.split(":")) {
      if (group.length === 0 || group.length > 4 || !/^[0-9a-f]+$/.test(group)) {
        return null;
      }
      out.push(parseInt(group, 16));
    }
    return out;
  };

  const head = parseGroups(halves[0]);
  if (head === null) return null;

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const tailGroups = parseGroups(halves[1]);
  if (tailGroups === null) return null;
  const missing = 8 - head.length - tailGroups.length;
  if (missing < 0) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tailGroups];
};

const classifyIpv6 = (groups: number[]): AddressKind => {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  if (groups.every((group) => group === 0)) return "unknown"; // unspecified ::

  // ::1 loopback
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return "loopback";
  }

  // IPv4-mapped ::ffff:a.b.c.d (including hexadecimal spelling)
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return classifyIpv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
  }

  // link-local fe80::/10 (fe80 through febf)
  if ((g0 & 0xffc0) === 0xfe80) return "link-local";

  // ULA fc00::/7 (fc00 through fdff)
  if ((g0 & 0xfe00) === 0xfc00) return "private";

  return "public";
};

export const classifyAddress = (value: string | null | undefined): AddressKind => {
  if (!value) return "unknown";
  const addr = value.trim();
  if (addr.includes(":")) {
    const groups = parseIpv6(addr);
    return groups ? classifyIpv6(groups) : "unknown";
  }
  const octets = parseIpv4(addr);
  return octets ? classifyIpv4(octets) : "unknown";
};
