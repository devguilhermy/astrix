// Copied from Void Protocol apps/web/src/net/transportPolicy.ts:15–18 @218625d.
// Owner-authorized selected reuse, ASTRIX Apache-2.0; see CREDITS.md. LAN policy below is new.
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_CAP_MS = 30_000;
export const RECONNECT_MAX_ATTEMPTS = 12;
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
    const exp = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** attempt);
    return Math.round(exp / 2 + random() * (exp / 2));
}
export const terminalClose = (code: number): boolean => [1000, 1008, 1009, 4401, 4403, 4406, 4409].includes(code);
export const terminalHttp = (status: number): boolean => [400, 401, 403, 404, 409, 410, 426].includes(status);
