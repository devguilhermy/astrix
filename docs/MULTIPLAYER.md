# Trusted-LAN multiplayer groundwork

The Bun process is the only LAN mission authority. The host browser and phones project its snapshots; they never advance a second simulation. This release supplies admission, role ownership, readiness, presence and reconnect plumbing. Dedicated phone design/flight consoles (plan W5/W6) are outside this wave. Do not present their full multi-phone gameplay acceptance as demonstrated.

## Prepare online

Install Bun on the host, then run from the repository:

```sh
bun install
bun run build
```

Keep the prepared repository, dependencies and `apps/web/dist` on the computer. Build assets, fonts, QR encoding and committed science data are served locally; the host command does not download dependencies or start Vite. Missing production assets produce an actionable error. A static solo/shared-screen deployment needs no Bun backend.

## Start without internet

Connect the host and phones to an operator-controlled, trusted Wi-Fi router or hotspot with peer access. Disable WAN while leaving LAN connected. Run:

```sh
bun run host
# If more than one eligible interface exists, select an address printed by the CLI:
bun run host --bind 192.168.1.20 --port 3000
```

The address above is an example, not a promised address. Only private IPv4 addresses on non-virtual interfaces are candidates; the listener never defaults to `0.0.0.0` or a public interface. Several candidates require explicit `--bind`; no guessing the default internet route. IPv6-only networks are not supported in this wave. Changing interface/address requires stopping/restarting the process, which ends its room; no live migration is promised.

Open the **loopback control URL** printed by Bun on the host computer (`http://127.0.0.1:3001/` by default). `--control-port` changes that separate, loopback-only port. It bootstraps the host capability and redirects to the selected LAN origin. The public `/host` page alone cannot grant host rights. Never share the loopback bootstrap or a host fragment; only the phone invitation belongs in the QR.

Select Team or Solo-with-personal-phones **before** starting a scenario. Team assigns each admitted phone a player; all roles start on the host and can be transferred individually. Solo auxiliary devices share the same player/`ALL` identity and do not fabricate team achievements. Start design explicitly; this does not launch the spacecraft.

## Join, approve and assign

The lobby shows the QR, selectable `/join` address, room identifier and high-entropy invitation. The QR is encoded by the locally bundled MIT `qrcode-generator` library, never an external image service. Use each phone's native camera reader. Manual alternative: type the displayed `/join` address, room ID, invitation and a short non-sensitive name. Async Clipboard is optional and may be absent on HTTP.

The join fragment carries `room` and `token`; the page removes it and sends the secret in a JSON POST body. This limits routine URL logging; it **does not encrypt traffic**, protect screenshots or erase prior browser history. Invitations expire after 15 minutes. Refresh QR rotates the invitation without revoking already admitted devices. Closing admission hides the invitation and blocks new requests.

The host must admit each pending request, assign roles, and each player checks Ready after reviewing the snapshot/assignments. Ready is **not** design sign-off. One owner per discipline, several disciplines per player. Maximum **four admitted device sessions including the host display**: three phones, no extra spectator. Pending requests do not consume a seat, are separately capped, and expire after two minutes. The fourth phone is refused rather than evicting anyone.

A second tab with the same credential replaces the old connection; this is a device-session cap, not hardware fingerprinting. Disconnected seats are reserved for 120 seconds. Release device revokes its credential, socket and outstanding tickets. Role ownership/history remain until explicit reassignment. Before pairing a replacement after a release, transfer the old player's roles to the host; zero-role offline players can then leave the current roster while historical actor IDs remain intact.

## Firewall and network troubleshooting

Allow only the selected TCP LAN port on the host's private-network firewall profile. The loopback control port does not need LAN access. Never disable the firewall globally, forward router ports, enable UPnP or create a public tunnel. Same SSID is insufficient when a guest AP isolates clients. Use a rehearsed peer-access router/hotspot. Approve normal browser/OS local-network prompts if appropriate; do not disable browser security flags. A phone's `localhost` means the phone, not the host computer.

Private-address/subnet checks, exact Host/Origin checks, bearer admission, expiring single-use 30-second socket tickets and ingress/queue bounds are defense in depth. **HTTP and WebSocket traffic are plaintext and can be observed/modified by an on-path attacker.** Use only a trusted isolated LAN and no personal/sensitive information. Hostile/public-network operation needs a separately approved trusted HTTPS/WSS deployment.

## Suspension, refresh and recovery

Keep phone pages visible when participating. No wake-lock, service worker, in-page camera, background task or secure-context API is required. Background/lock timing varies across iOS/Android and is not established by desktop emulation.

The client probes every 5 seconds and disables input when disconnected/stale. Reconnect uses bounded jittered retries and a fresh single-use ticket; `pageshow` and returning to visible force resynchronization. A full newer snapshot replaces the projection even when sequence numbers skip. Pending IDs query saved results; no disconnected gameplay queue or automatic tap replay exists. Unknown outcomes are explicitly labeled for human review.

Credentials and unresolved IDs use sessionStorage with memory continuity while the page lives. If storage is denied, the lobby explains that refresh requires new host-approved pairing; release the old seat. Reopening the loopback control URL recovers host access even without storage. A revoked credential cannot recover its former role by reusing the invitation.

The host display disconnect immediately adds its own safety pause. Confirmed teammate controller loss adds a device-specific pause after the heartbeat deadline; brief suspicion alone does not change speed. Solo auxiliary-phone loss does not pause the host's shared solo responsibilities. Bun detects scheduling gaps longer than its one-second catch-up bound and pauses with `host-stall` instead of simulating laptop-sleep time. Prevent OS sleep using normal system settings during a demonstration.

Reconnection removes only its own disconnect reason and **never resumes**. Review ownership, acknowledge Ready, clear host safety stops from the lobby, then choose Explicitly resume. Physical decisions and learning stops remain until their authorized acknowledgements. The Bun process retains the mission across host-browser refresh; exiting/crashing/restarting Bun destroys the in-memory room. No host migration, persistence or recovery of a stopped process is promised.

## Fallbacks

While Bun is alive, **Continue host-only** pauses, revokes all phone sessions, transfers roles with approval invalidation, keeps mission state and historical actors, and locks admission. Explicit Resume is still required. Team statistics are not rewritten as solo achievement.

If LAN access cannot be established, serve the prepared static `apps/web/dist` for solo/hot-seat play, or use the prepared development environment locally. Static mode does not continue a room whose Bun process was lost. No fallback silently starts a dev server or external relay.

## Verification hand-off

Observed integration commands and the real HTTP/WebSocket desktop-browser rehearsal are recorded in [VERIFICATION.md](./VERIFICATION.md#bottom-mission-control-and-lan-groundwork-2026-11-15). Those checks cover admission, readiness, room capacity, refresh continuity, host-only continuation and startup CSP recovery; they do not establish physical-phone support, isolated-WAN operation or completed phone gameplay. The following procedure is a rehearsal checklist, not a claim that every step was performed.

Manual rehearsal:

1. Prepare/build online, disconnect WAN, run the selected-interface command, open loopback bootstrap. Confirm the QR contains only the public join invitation, not host capability.
2. Join three phones (include iOS Safari and Android Chrome), approve and assign roles, check name/Ready labels in en and pt-BR at 320 px and landscape. Try a fourth phone: expect room-full refusal. Exercise manual URL/room/token joining without Clipboard.
3. Start design on the host, open the shared mission, make one host-owned change. Confirm phones receive the same revision; instrument their stores/loop to confirm no simulation stepping. Full role phone command flows require W5/W6 and must not be claimed here.
4. Refresh the host browser: mission remains in Bun, phones observe pause. Recover via bootstrap if needed, re-acknowledge roles, clear only the relevant stop and explicitly resume.
5. Lock/background/unlock each phone, toggle airplane mode, exercise bfcache/pageshow and tab replacement. Confirm stale labels, fresh snapshot/results and no duplicate tap. Repeat with sessionStorage denied: refresh must ask for re-pairing, not silently claim the old identity.
6. Release a phone, try its old ticket/credential, rotate QR and try the old invitation. Test the 120-second seat reservation and explicit host-only continuation. Sleep/wake the laptop: expect `host-stall`, no catch-up flight.
7. Check firewall-denial and AP-isolation guidance, host-only and independent static fallback. Record actual devices, OS/browser versions, build, interface/subnet, topology and results in the verification record; no device support or latency claim is established by source inspection.
