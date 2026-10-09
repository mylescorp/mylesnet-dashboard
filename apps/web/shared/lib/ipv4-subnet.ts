export function firstUsableAddress(network: number, prefix: number): number {
  return prefix >= 31 ? network : network + 1;
}
