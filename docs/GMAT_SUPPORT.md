# GMAT support

ASTRIX11 reads and writes a documented subset of [NASA GMAT](https://software.nasa.gov/software/GSC-19468-1) files. It does not run GMAT and never executes uploaded text. Imported data is a display or a starting orbit. It is never a converted mission, and it carries no resources, objectives or score.

## Where

| Entry | Path |
|---|---|
| Home page header | **GMAT tools** link |
| Simulator menu | **GMAT tools** |
| Direct URL | `<base>gmat` (served by the LAN host too) |

The page lives in the normal app shell. The left panel holds import and export; the 3D view on the right shows the current subject.

## Import

Parsing runs in a cancellable worker. Limits: 10 MiB input, 16 KiB per line, 100,000 samples, 256 segments. UTC is kept to the millisecond; finer nonzero digits and leap-second timestamps are refused. Moon-centred data is refused.

### CCSDS OEM (sampled trajectory)

- KVN text, `CCSDS_OEM_VERS` 1.0 or 2.0.
- One object across all segments; centre Earth, Mars or Sun; `REF_FRAME = EME2000`; `TIME_SYSTEM = UTC`.
- Required metadata: `OBJECT_NAME`, `OBJECT_ID`, `CENTER_NAME`, `REF_FRAME`, `TIME_SYSTEM`, `START_TIME`, `STOP_TIME`. Optional: `USEABLE_START_TIME`/`USEABLE_STOP_TIME` (must lie inside the segment), `INTERPOLATION`, `INTERPOLATION_DEGREE`. `COMMENT` lines are skipped. Any other key is refused.
- Data lines: timestamp and six values (km, km/s). Samples must be strictly increasing and inside the segment bounds; segments must not overlap.

### GMAT ReportFile (sampled trajectory)

Whitespace-delimited. The header must contain `<Spacecraft>.UTCGregorian` and `<Spacecraft>.EarthMJ2000Eq.X/Y/Z` (or `MarsMJ2000Eq`), with optional complete `VX/VY/VZ`. You name the spacecraft; columns are never guessed.

### GMAT script (initial state)

The importer reads **one spacecraft's literal Keplerian initial state** from any GMAT script, including full mission scripts.

Read:

- `Create Spacecraft` / `Create CoordinateSystem`, with or without `GMAT` prefixes and semicolons. `...` continuations and `{ }` groups are joined; `%` comments outside quotes are removed.
- For the selected spacecraft: `DateFormat`, `Epoch`, `CoordinateSystem`, `DisplayStateType = Keplerian`, `SMA`, `ECC`, `INC`, `RAAN`, `AOP`, `TA`; `AnomalyType = TA` is allowed.
- Frames: `EarthMJ2000Eq` (built in), or a created frame with `Axes = MJ2000Eq` and `Origin` Earth, Mars or Sun.
- Epochs: `UTCGregorian`, `TAIGregorian` (quoted), `UTCModJulian`, `TAIModJulian` (numbers). GMAT ModJulian is JD − 2430000 (21545.0 = 2000-01-01 12:00). TAI is converted with the fixed IERS TAI−UTC table (10 s in 1972 to 37 s since 2017); ModJulian values are rounded to the millisecond.

Everything else is counted and reported as ignored, never executed or converted. That covers force models, propagators, burns, solvers, subscribers, other spacecraft and the whole mission sequence. The preview says how many statements and mission commands were ignored.

Refused, with the line or reason:

- The selected spacecraft sets no state. GMAT would use its built-in default or an ephemeris; ASTRIX does not assume one.
- Another state representation or epoch alias on the selected spacecraft, such as `X`/`VX`, `MA`, `StateType` or `Epoch.UTCGregorian`.
- The mission sequence reassigns the selected spacecraft's state, such as `Sat.SMA = 9000` after `BeginMissionSequence`.
- A statement that is not a `Create` or an assignment but names the selected spacecraft outside the mission sequence.
- Hyperbolic or parabolic orbits, periapsis at or below the surface, inclination outside 0–180°.
- Unknown spacecraft names. The error lists the spacecraft the script does create.

`parseInitialOrbit` stays strict: it accepts only a script that contains the initial state and nothing else, which is exactly what export writes. `extractInitialOrbit` is the lenient reader the page uses.

On the host, **Prepare a new mission with this state** opens a compatible preparation. Catalogue constraints and the reference flight still decide whether it can fly.

## Export

The export form takes body (Earth, Mars or Sun), a UTC epoch and SMA, ECC, INC, RAAN, AOP and TA. It shows periapsis and apoapsis altitudes and the script, then re-imports the script through the strict parser and states whether every element matches exactly. A draft the importer would refuse cannot be downloaded; the reason is shown instead.

The script holds one `Astrix` spacecraft, a UTCGregorian epoch and a Keplerian state. Earth uses `EarthMJ2000Eq`; Mars and Sun define `AstrixMarsFrame`/`AstrixSunFrame` with `Axes = MJ2000Eq`. It contains no force model, burn or propagation.

## 3D view

The page draws its subject in the shared 3D canvas instead of the mission world:

- **Initial state** (import or export draft): the central body lit for the epoch, the full two-body conic, periapsis and apoapsis markers with altitudes, the spacecraft and a dashed equatorial reference circle.
- **Sampled trajectory**: the path split at segment breaks and at sample gaps over 120 s. During playback the travelled part turns gold. Gaps show no spacecraft.
- **Caption**: spacecraft and body, UTC time, time since start, altitude, and speed for conics. **Orbit details** lists the elements, period and apsis altitudes, or segments, samples, span and frame.
- **Transport**: play/pause, a time scrubber, speeds from 10× to 6 h/s (the default plays the whole span in about 30 s), return to start. Conics loop over one period; trajectories stop at the last sample.

A successful import is shown at once. The export draft fills an empty view and takes it over when edited. **Show in the 3D view** brings an import back. Leaving the page restores the mission scene.

The conic is ASTRIX two-body motion from the imported state, not GMAT propagation. Trajectory positions between samples are linear display interpolation.

## Example inputs

Chosen from the **Example** list; picking one sets the format and spacecraft.

| File | Source | Result |
|---|---|---|
| `astrix-earth-initial-state.script` | ASTRIX export | Imports exactly |
| `astrix-mars-initial-state.script` | ASTRIX export | Imports exactly |
| `earth-gaps.oem` | ASTRIX fixture | Two segments, five samples, gaps |
| `mars-irregular.txt` | ASTRIX fixture (ReportFile, `Probe`) | Four irregular samples |
| `Tut_SimulatingAnOrbit.script` | NASA GMAT sample | `Sat` initial state; 87 statements ignored |
| `Ex_MarsOrbit.script` | NASA GMAT sample | `MarsOrbiter` (TAIModJulian 21645 → 2000-04-10T11:59:28Z); `MPS1`–`MPS4` also import |
| `Ex_HohmannTransfer.script` | NASA GMAT sample | Refused: `DefaultSC` sets no state |
| `Ex_OEMPropagation.script` | NASA GMAT sample | Refused: `EphSat` takes its state from an ephemeris |
| `SampleOEMEphem.oem` | NASA GMAT data | OEM 1.0, 2,881 samples over two days |

NASA files are unmodified copies of [nasa/GMAT](https://github.com/nasa/GMAT) `main` @ `b8aec552` (Apache-2.0); see `scripts/fixtures/gmat/nasa-samples/README.md` and `THIRD_PARTY_NOTICES.txt`. Vite serves them from `scripts/fixtures/gmat/` and emits them as build assets.

## Not supported

- Running GMAT, or reproducing its force models, maneuvers, targeting or propagation.
- Cartesian or other non-Keplerian initial states, GMAT default states, expressions, includes, functions and object copies.
- Body-fixed or ecliptic frames, Moon-centred data, OEM covariance or acceleration data, XML OEM, and non-UTC OEM/ReportFile time systems.
- Interpolating across gaps, segment breaks or past the data.

## Code

| Area | File |
|---|---|
| Parsers, exporter | `packages/core/src/interop/gmat.ts` (`parseOem`, `parseReport`, `extractInitialOrbit`, `parseInitialOrbit`, `exportInitialOrbit`) |
| Parser tests (including NASA samples) | `packages/core/src/interop/gmat.test.ts` |
| Import panel, example list, worker | `apps/web/src/ui/advanced/AdvancedTools.tsx`, `examples.ts`, `parser.worker.ts` |
| Export panel and round-trip check | `apps/web/src/ui/gmat/ExportPanel.tsx`, `exportModel.ts` |
| 3D subject store | `apps/web/src/ui/advanced/trajectoryStore.ts` |
| 3D scene, caption, transport | `apps/web/src/three/gmat/GmatScene.tsx`, `geometry.ts` |
| Route | `apps/web/src/ui/recovery/routes.ts`, `apps/web/src/App.tsx`, `apps/host/src/static.ts` |

Independent GMAT runs of exported scripts and the reference cases are recorded in [GMAT validation](./research/gmat-validation.md).
