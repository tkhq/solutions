/**
 * Normalize an address to lowercase for consistent encoding and Turnkey parsing.
 */

export function toLowercaseAddress(addr: string): `0x${string}` {
  if (!addr || !addr.startsWith("0x")) return addr as `0x${string}`;
  return ("0x" + addr.slice(2).toLowerCase()) as `0x${string}`;
}
