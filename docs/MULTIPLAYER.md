# Trusted-LAN turn-based multiplayer

The Bun process is the only LAN mission authority. The host browser and phones project its snapshots; they never advance a second simulation. The host designs and starts a mission, phones propose current plans, and the host commits a turn. Reading, discussion, idle time and disconnects do not advance mission time.

## Turn protocol and build identity

Protocol **4** and the production `astrix-build.json` manifest bind protocol, rules and flight-model versions. The host rejects missing/incompatible production metadata. `START_GAME` carries a bounded quick configuration; `COMMIT_TURN` and `PROPOSE_TURN` identify a decision, turn revision and plan. The authority validates everything again; clients never supply physical outcomes. Protocol 4 added `seats` to the public snapshot and the `{action:'players',count}` host admin request.

Ordinary client frames are bounded to 8,192 bytes. Retained declarative-definition tooling has a 32,768-byte definition limit and 40,960-byte definition-frame ceiling. Oversized/unsupported named requests receive explicit feedback without forgetting credentials. Only actual credential revocation/authentication failures justify discarding a valid credential.

The current shared Wi-Fi is **not an isolated trusted LAN qualification**. Do not broaden firewall rules or expose other laptop services as part of game setup. Same-SSID reachability, native QR scanning, iOS/Android suspension and physical-device behavior still require explicit observed evidence.

## Prepare online

Install Bun on the host, then run from the repository:

```sh
bun install
bun run build
```

Keep the prepared repository, dependencies and `apps/web/dist` on the computer. Build assets, fonts, QR encoding and committed science data are served locally; the host command does not download dependencies or start Vite. Missing production assets produce an actionable error. A static solo/shared-screen deployment needs no Bun backend. Besides `/`, `/host` and `/join`, the host answers the app paths `/gmat`, `/quiz` and `/science` with the app shell, so the GMAT tools, the quiz and the rendered documentation also open on LAN devices.

## Start without internet

Connect the host and phones to an operator-controlled, trusted Wi-Fi router or hotspot with peer access. Disable WAN while leaving LAN connected. Run:

```sh
bun run host
# If more than one eligible interface exists, select an address printed by the CLI:
bun run host --bind 192.168.1.20 --port 3000
```

The address above is an example, not a promised address. Only private IPv4 addresses on non-virtual interfaces are candidates; the listener never defaults to `0.0.0.0` or a public interface. Several candidates require explicit `--bind`; no guessing the default internet route. IPv6-only networks are not supported in this wave. Changing interface/address requires stopping/restarting the process, which ends its room; no live migration is promised.

Open the **loopback control URL** printed by Bun on the host computer (`http://127.0.0.1:3001/` by default). `--control-port` changes that separate, loopback-only port. It bootstraps the host capability and redirects to the selected LAN origin. The public `/host` page alone cannot grant host rights. Never share the loopback bootstrap or a host fragment; only the phone invitation belongs in the QR.

Choose **Players** 1–4; the count includes the host person and appears in every snapshot (`seats`), so phones can show "x of y joined". **1** is host-only solo: no phone can be admitted. **2–4** is a team with that many seats: the host display plus `count − 1` phones. Each admitted phone takes the next seat's share of the four disciplines (seat *k* receives the roles at positions *i* with *i* mod count = *k*); the host keeps every unclaimed role and can still transfer roles one by one. The count can change before and after the mission starts: raising it opens a seat; lowering it below the admitted devices is refused (`ROOM_FULL`) until the host releases a device. Starting is not gated on full seats. Only the authenticated host device commits turns. **Design & Play** prepares the mission; selecting a plan previews it, and the named commit button executes it.

## Join, approve and assign

The lobby shows the QR, selectable `/join` address, room identifier and high-entropy invitation. The QR is encoded by the locally bundled MIT `qrcode-generator` library, never an external image service. Use each phone's native camera reader. Manual alternative: type the displayed `/join` address, room ID, invitation and a short non-sensitive name. Async Clipboard is optional and may be absent on HTTP.

The join fragment carries `room` and `token`; the page removes it and sends the secret in a JSON POST body. This limits routine URL logging; it **does not encrypt traffic**, protect screenshots or erase prior browser history. Invitations expire after 15 minutes. Refresh QR rotates the invitation without revoking already admitted devices. Closing admission hides the invitation and blocks new requests.

**Admission stays open during the mission.** Starting a mission no longer closes it, so a phone can scan in mid-game, be admitted, receive its seat's role share and land on the current committed game. This widens the join window compared with earlier builds, where admission ended with the lobby. It remains bounded by:

- host approval of every device; a pending request never acquires a seat or role on its own;
- automatic closing when every seat is taken (`ROOM_FULL`), reopening only when the host releases or kicks a device or raises the count;
- 15-minute invitations;
- invitation rotation, which invalidates the previous QR;
- at most 12 pending requests, each expiring after two minutes.

The host can also close admission explicitly (*Close admission*), and **Continue host-only** closes it. The host lobby reports `seats`, `locked` (closed by the host) and `admissionOpen` (not locked and fewer admitted devices than seats).

The host admits pending requests and assigns disciplines. Ready is informational coordination, not permission to commit each turn. A controller proposes a current plan; a host commitment resolves it once. There is one owner per discipline and at most **as many admitted device sessions as the Players count, including the host display** (never more than four). Pending requests do not consume seats. A phone beyond the count is refused rather than evicting anyone.

A second tab with the same credential replaces the old connection; this is a device-session cap, not hardware fingerprinting. Disconnected seats are reserved for 120 seconds. Release device revokes its credential, socket and outstanding tickets. Role ownership/history remain until explicit reassignment or until a replacement is admitted: the replacement takes the released seat's share, and the released zero-role player leaves the current roster while historical actor IDs remain intact.

## Firewall and network troubleshooting

Allow only the selected TCP LAN port on the host's private-network firewall profile. The loopback control port does not need LAN access. Never disable the firewall globally, forward router ports, enable UPnP or create a public tunnel. Same SSID is insufficient when a guest AP isolates clients. Use a rehearsed peer-access router/hotspot. Approve normal browser/OS local-network prompts if appropriate; do not disable browser security flags. A phone's `localhost` means the phone, not the host computer.

Private-address/subnet checks, exact Host/Origin checks, bearer admission, expiring single-use 30-second socket tickets and ingress/queue bounds are defense in depth. **HTTP and WebSocket traffic are plaintext and can be observed/modified by an on-path attacker.** Use only a trusted isolated LAN and no personal/sensitive information. Hostile/public-network operation needs a separately approved trusted HTTPS/WSS deployment.

## Suspension, refresh and recovery

Keep phone pages visible when participating. No wake-lock, service worker, in-page camera, background task or secure-context API is required. Background/lock timing varies across iOS/Android and is not established by desktop emulation.

The client probes every 5 seconds and disables input when disconnected/stale. Reconnect uses bounded jittered retries and a fresh single-use ticket; `pageshow` and returning to visible force resynchronization. A full newer snapshot replaces the projection even when sequence numbers skip. Pending IDs query saved results; no disconnected gameplay queue or automatic tap replay exists. Unknown outcomes are explicitly labeled for human review.

Credentials and unresolved IDs use sessionStorage with memory continuity while the page lives. If storage is denied, the lobby explains that refresh requires new host-approved pairing; release the old seat. Reopening the loopback control URL recovers host access even without storage. A revoked credential cannot recover its former role by reusing the invitation.

Disconnects update presence and safety annotations; they never execute a plan. The host does not integrate missed wall time or run a background flight clock. Networking heartbeats and credential expiry continue independently of mission time.

Reconnection restores the latest committed state and correlated results. Review the current decision and commit explicitly when ready; there is no speed control or automatic resume. Bun retains the mission across host-browser refresh. Exiting/crashing/restarting Bun destroys the in-memory room; host restart persistence and host migration are not provided by local saves.

## Fallbacks

While Bun is alive, **Continue host-only** revokes phone sessions, transfers roles, keeps committed mission state and historical actors, and locks admission. The next decision still needs an explicit host commit. Team statistics are not rewritten as solo achievement.

If LAN access cannot be established, serve the prepared static `apps/web/dist` for solo/hot-seat play, or use the prepared development environment locally. Static mode does not continue a room whose Bun process was lost. No fallback silently starts a dev server or external relay.

## Verification hand-off

Build-specific observed results belong in [Verification](./VERIFICATION.md). Automated real HTTP/WebSocket and browser checks do not establish physical-phone qualification or isolated-WAN operation.

Physical-device rehearsal:

1. Prepare/build online, disconnect WAN, run the selected-interface command and open loopback bootstrap. Confirm the QR contains only the public join invitation.
2. Set 4 players and join three phones, including iOS Safari and Android Chrome; approve and check each phone's role share. Check both languages at 320 px and landscape. Refuse a fourth phone and exercise manual joining without Clipboard. Then set 3 players, start with one phone and scan in a second phone mid-mission.
3. Use Design & Play on the host. Propose from a phone, verify no time changes, commit on the host and compare the resulting revision/receipt on every device. Repeat an intent ID and send an outdated decision: neither may advance twice.
4. Refresh the host and controller. Verify the same committed mission, no automatic turn and preserved known outcomes. Recover host access through loopback bootstrap if storage is unavailable.
5. Background/unlock each phone, toggle airplane mode, exercise bfcache/pageshow and tab replacement. Verify stale controls are disabled, fresh state returns and unknown outcomes are explained rather than replayed.
6. Release a phone; refuse its old ticket/credential and confirm admission reopens. Rotate the invitation; refuse the old invitation. Exercise seat reservation, host-only continuation (admission closes) and laptop sleep/wake: no catch-up flight.
7. Record actual devices, OS/browser versions, build, subnet, topology and outcomes. Do not change unrelated laptop services or broaden firewall exposure as part of testing.
