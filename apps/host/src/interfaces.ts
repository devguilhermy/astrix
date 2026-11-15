import { networkInterfaces } from 'node:os';
export interface LanInterface { name: string; address: string; netmask: string }
const ipv4 = (value: string): number | null => {
  const parts = value.split('.'); if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null;
  return parts.reduce((v, p) => (v * 256 + Number(p)) >>> 0, 0);
};
export function isPrivateAddress(address: string): boolean {
  const value = ipv4(address); if (value === null) return false;
  return (value >>> 24) === 10 || (value >>> 20) === 0xac1 || (value >>> 16) === 0xc0a8;
}
export function lanInterfaces(): LanInterface[] {
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) => /^(lo|docker|veth|virbr|br-|tun|tap|wg|tailscale|zt)/i.test(name) ? [] : (entries ?? []).filter(entry => entry.family === 'IPv4' && !entry.internal && isPrivateAddress(entry.address)).map(entry => ({ name, address: entry.address, netmask: entry.netmask })));
}
export function selectInterface(candidates: LanInterface[], bind?: string): LanInterface {
  const selected = bind ? candidates.find(entry => entry.address === bind) : candidates.length === 1 ? candidates[0] : undefined;
  if (!selected) throw new Error(`Choose a private IPv4 interface with --bind <ip>. Candidates:\n${candidates.map(i => `  ${i.name}: ${i.address}`).join('\n') || '  none (connect to a peer-access Wi-Fi/hotspot; IPv6-only networks are not supported)'}`);
  return selected;
}
export function isAllowedPeer(address: string, selected: LanInterface): boolean {
  const peer = ipv4(address.replace(/^::ffff:/, '')), host = ipv4(selected.address), mask = ipv4(selected.netmask);
  return peer !== null && host !== null && mask !== null && isPrivateAddress(address.replace(/^::ffff:/, '')) && (peer & mask) === (host & mask);
}
