import { isIP } from "node:net";

export function ipBucketKey(ip: string | undefined): string {
  if (!ip || !/^[0-9A-Fa-f:.]{1,45}$/.test(ip)) return "local";
  if (isIP(ip) === 4) return `ip:${ip}`;
  if (isIP(ip) !== 6) return "local";
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const [start = "", end] = canonical.split("::");
  const left = start ? start.split(":") : [];
  const right = end ? end.split(":") : [];
  const groups =
    end === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  const numbers = groups.map((group) => Number.parseInt(group, 16));
  if (numbers.slice(0, 5).every((group) => group === 0) && numbers[5] === 65535) {
    const high = numbers[6] ?? 0;
    const low = numbers[7] ?? 0;
    return `ip:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  // IPv6 addresses commonly rotate within a subscriber's /64; share its budget.
  return `ip6:${numbers
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}/64`;
}
