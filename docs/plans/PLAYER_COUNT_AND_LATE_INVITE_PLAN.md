# Player count toggle and in-mission invitation QR

**Status (2026-11-15):** proposal for review. Nothing implemented.

Two gaps observed in the trusted-LAN build:

1. The host cannot say how many people will play the mission.
2. The invitation QR exists only in the lobby, and starting a mission closes admission, so nobody can scan in later.

## 1. Current state (evidence)

| Area | Today | Where |
|---|---|---|
| Party size | No count. Lobby offers a `<select>`: *Teammates* / *Solo with personal phones*; disabled once a second device is admitted. Server accepts `solo`/`team` only while the host is alone. | `apps/web/src/ui/multiplayer/HostLobby.tsx:34`, `apps/host/src/room.ts:130-138` |
| Seat cap | Hard-coded 4 devices (host display included) | `room.ts:33`, `room.ts:115` |
| Roles | All four start on the host; transferred one by one with dropdowns | `HostLobby.tsx` role `<select>`s, reducer `ASSIGN_ROLE` |
| Admission after start | `START_GAME` sets `locked=true` → later joins fail `JOIN_LOCKED` | `room.ts:108`, `room.ts:32` |
| Invitation lifetime | 15 min, then manual *Refresh QR invitation* | `room.ts:23`, `room.ts:124` |
| QR rendering | Inline in the lobby only (`qrcode-generator`, `useMemo`) | `HostLobby.tsx` `lan-invitation` section |
| Late phone UX | Phone that arrives while a game exists lands on the *Goal* screen and must tap *Return to mission* | `PlayApp.tsx` `view==='explore'&&guest` branch |
| Mid-game roster | Reducer already allows `ADD_PLAYER`; `ASSIGN_ROLE` is refused only while `running`/`advancing`, both always `false` in turn games | `packages/session/src/reducer.ts:257-267`, `gameState()` |

## 2. Proposal

### A. Player count: toggle buttons 1 · 2 · 3 · 4

**UI**
- Segmented buttons with `aria-pressed`, the same pattern as the destination tabs and `LevelToggle`. Label: *Players*. Each button shows a person-count icon and the number.
- Shown in the host lobby, replacing the Teammates/Solo `<select>`.
- Mirrored on the host's *Design & Play* panel above **Play mission** (remote host only, before a game exists), with a live line: "2 of 3 players joined".
- Phones show the same line read-only.

**Meaning.** The count includes the host person.
- `1` → `participantMode: 'SOLO'`. No invitation is shown (see D1).
- `2–4` → `participantMode: 'TEAM'` with `count` seats: the host plus `count − 1` phones. The device cap becomes `count` instead of the fixed 4.

**Roles.** When a phone is admitted, roles are split by the existing `SET_TEAM` rule (`ROLES.filter((_,i)=>i%count===slot)`, `reducer.ts:254`). The host keeps unclaimed roles and can still reassign them by hand.

**Starting.** Not gated on full seats (keeps the documented "no unanimous readiness" rule). With empty seats, *Play mission* still works, and the line reads "2 of 3 joined — open seats can join later".

**Changing the count**
- Allowed before and after start.
- Raising it opens a seat.
- Lowering it below the number of admitted devices is refused (`ROOM_FULL`); the host must release a device first.

**Out of scope.** The count is **not** part of `QuickDesignConfig`, so mission identity, digest, readiness certificate and saves stay unchanged.

**Server and session**
- `SessionState.seats: 1|2|3|4`, included in the public snapshot so phones can render "x of y".
- `/api/admin` accepts `{action:'players',count}`; this replaces `solo`/`team`. The strict key check at `apps/host/src/index.ts:58` needs a second allowed shape.
- `Room.join`/`ADMIT` cap = `state.seats` (max 4).
- `LobbyInfo` gains `seats`.

### B. Invitation QR available during the mission

**Server**
- Drop the automatic lock on `START_GAME` (`room.ts:108`).
- Admission is open while `admitted < seats` and the host has not closed it.
- It closes automatically when full and reopens when a device is released or kicked.
- *Continue host-only* still locks, as today.

**Host UI**
- New header button **Invite**, shown only to the remote host, with a badge "1 open seat". It opens a panel containing:
  - QR + join address / room / token (moved out of `HostLobby` into a shared `Invitation` component)
  - the pending-requests list with **Admit** / **Deny**
  - the Players toggle
  - *Close admission*
- When the panel opens with under 2 minutes left on the invitation, it rotates automatically (`ROTATE_JOIN_TOKEN`). A countdown is shown.

**Late joiner**
- `ADMIT` → `ADD_PLAYER` → automatic role share, all mid-game.
- `WELCOME` already carries the committed game.
- The phone goes straight to the mission view whenever `snapshot.game` exists. This fixes the *Return to mission* detour for everyone, not only late joiners.

**Security**
- Keeping admission open mid-game widens the join window. It stays bounded by:
  - host approval per device
  - auto-close when full
  - 15-minute invitations
  - rotation
  - the existing pending-request cap of 12
- `MULTIPLAYER.md` must say so explicitly; it currently says admission ends with the lobby.

### C. Protocol and build identity

- The snapshot shape (`seats`) and the admin body shape both change.
- Bump `PROTOCOL_VERSION` 3 → 4 and the `astrix-build.json` protocol field.
- Host and phones already refuse mismatched builds.

## 3. Files

| File | Change |
|---|---|
| `packages/session/src/contracts.ts`, `reducer.ts`, `snapshot.ts`, `protocol.ts` | `seats`, role split on admit, protocol 4 |
| `apps/host/src/room.ts`, `index.ts` | seat cap, `players` admin action, no lock on start, auto-close/reopen |
| `apps/web/src/multiplayer/client.ts` | `LobbyInfo.seats`, admin call |
| `apps/web/src/ui/multiplayer/HostLobby.tsx` → new `Invitation.tsx`, `PlayerCount.tsx` | extract QR panel, toggle buttons |
| `apps/web/src/ui/play/PlayApp.tsx`, `Preparation.tsx` | Invite header button + panel, "x of y joined", guest auto-open mission |
| `apps/web/src/i18n/locales/en.json`, `pt-BR.json`, `ui/multiplayer/copy.ts` | new strings, both languages |
| `docs/MULTIPLAYER.md`, `docs/plans/MULTIPLAYER_LAN_PLAN.md`, `docs/CHANGELOG.md` | admission policy, player count |

## 4. Verification

**`apps/host/src/room.test.ts`**
- count caps join and admit
- lowering below admitted is refused
- `START_GAME` no longer locks
- a phone joining after start is admitted, gets a role share, and its `WELCOME` carries the current game revision
- admission auto-closes when full and reopens after a kick

**Session reducer test:** role split for 2, 3 and 4 seats; host keeps the remainder.

**Presentation test** (`presentation.test.tsx` pattern): toggle `aria-pressed` state, and Invite visible to the host only.

**Two-tab browser smoke (same as the 2026-11-15 check):**
1. Set 3 players, start with one phone.
2. Scan in a second phone mid-mission.
3. Propose from both phones, commit from the host.

Then one real phone on the LAN.

## 5. Decisions for review

- **D1 — meaning of "1".**
  - *Recommended:* host-only solo, no QR.
  - Alternative: keep today's "Solo with personal phones" (phones act as extra consoles for one player), shown as an extra *Use my phones* switch when 1 is selected.
- **D2 — static solo app (`/`, no Bun host).**
  - *Recommended:* no toggle there; multiplayer needs `bun run host`, and the turn runtime has no pass-the-device mode.
  - Alternative: show 2–4 disabled with a hint to start the host.
- **D3 — QR placement during the mission.**
  - *Recommended:* only inside the Invite panel.
  - Alternative: an always-visible corner QR on the host display while seats are open.
- **D4 — count changes after start.**
  - *Recommended:* allowed upward; downward only to ≥ admitted devices.
  - Alternative: freeze the count at start.
