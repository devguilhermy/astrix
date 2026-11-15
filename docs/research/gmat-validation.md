# Independent GMAT reference run

Observed 2026-11-14: NASA GMAT **R2025a**, Linux Ubuntu x64 distribution, console build Apr 9 2025, ran `scripts/validate-orbits.script` successfully.

Distribution: https://sourceforge.net/projects/gmat/files/GMAT/GMAT-R2025a/gmat-ubuntu-x64-R2025a.tar.gz . GMAT is a NASA resource listed by this challenge: https://software.nasa.gov/software/GSC-19468-1 .

## Method

The script creates circular Earth orbits at 400, 420, 500 and 600 km, an idealized heliocentric transfer ellipse whose periapsis is 149,598,000 km and apoapsis 227,956,000 km, and a Mars capture orbit at 400 × 33,000 km altitude. GMAT reports orbital parameters, then numerically propagates the transfer with a Sun point-mass force model to apoapsis. This is the same two-body approximation intended for the game, not validation of a real flight trajectory or launch opportunity.

GMAT uses its installed body constants; the game uses rounded NASA fact-sheet constants. Small differences are expected. Earth/Mars radius values used to construct the input semimajor axes match the design plan. No third-body forces, drag, J2, radiation transport or actual hardware were validated.

## Observed output

| Quantity | GMAT result |
|---|---:|
| Earth period at 400 km | 5,553.62427334215 s |
| Earth period at 420 km | 5,578.22270937129 s |
| Earth period at 500 km | 5,676.9780306622 s |
| Earth period at 600 km | 5,801.231788109618 s |
| Earth circular speed at 420 km | 7.657269481699864 km/s |
| Heliocentric transfer orbital period | 44,735,023.67012663 s |
| Transfer periapsis speed | 32.72984112040886 km/s |
| Transfer apoapsis speed | 21.47922744709911 km/s |
| Mars 400 × 33,000 km orbit period | 86,493.86305538189 s |
| Mars capture periapsis speed | 4.520245236954238 km/s |
| Numerically propagated Earth–Mars transfer time | 258.883238831746 days |
| Heliocentric radius at transfer arrival | 227,955,999.9999983 km |

These support the plan's rounded reference values: about 92.97 min at 420 km, 258.9 days for the ideal transfer, and 24.03 h for the wide Mars orbit. Application unit tests must compare the implemented functions against these independently observed values; the GMAT run alone does not prove application correctness.

## Reproduce

Extract the distribution outside this repository. From its `bin` directory:

```sh
./GmatConsole-R2025a -r /absolute/path/to/astrix/scripts/validate-orbits.script
```

The report is written to the distribution's `output/astrix-gmat-results.txt`.

The local run warned that optional Python 3.12 and MATLAB interface libraries were unavailable. Neither interface was used; GMAT interpreted and ran the mission successfully. No runtime, binary, ephemeris bundle or downloaded archive is committed to the game.

## Interchange profile and boundaries

The historical run above predates the interchange implementation. It does not validate the new exporter or parsers. Initial-condition export writes one `Astrix` spacecraft, UTCGregorian epoch and Keplerian SMA/ECC/INC/RAAN/AOP/TA; Earth uses `EarthMJ2000Eq`, Mars defines a Mars-origin `MJ2000Eq` frame. It contains no propagation, force model, burns, spacecraft hardware or game state. ASTRIX uses Earth μ=398600 km³/s² and radius 6378.137 km, Mars μ=42828 km³/s² and radius 3396.2 km; GMAT defaults differ. Compare body-centred Cartesian position within 1e-6 km; compare velocity within 1e-8 km/s only after scaling GMAT velocity by sqrt(μ_ASTRIX/μ_GMAT) using the independently established GMAT body constant. For unscaled velocities disclose the μ mismatch instead of asserting that tolerance. Circular/equatorial angles alone are not a valid comparison.

Text parsing is performed in a cancellable worker. The input limit is 10 MiB, 16 KiB per line, 100,000 samples and 256 segments. No uploaded text is executed, included or used to fetch URLs. Leap-second timestamps are refused. OEM supports CCSDS 2.0 KVN, Earth/Mars, EME2000, UTC, six km/km/s state values and explicit time bounds. Metadata and chronological segment/sample order must agree. Display interpolation is linear only within a segment and when adjacent samples are no more than 120 seconds apart; exact samples remain visible, larger intervals and segment gaps show no craft, and no extrapolation is performed. The 120-second display cutoff is a conservative application policy, not detection of maneuvers or a guarantee of physical accuracy. Viewer geometry has an independent roughly 8192-vertex / 512-path cap and can omit whole runs rather than join gaps. The GMAT ReportFile profile requires the user-selected spacecraft's exact `<name>.UTCGregorian` and `<name>.<Earth|Mars>MJ2000Eq.X/Y/Z` headers, optional complete VX/VY/VZ headers, whitespace-delimited rows and UTCGregorian literals. No columns are guessed.

All three input profiles store UTC at millisecond precision. Nonzero fractional digits beyond three are refused rather than silently truncating the epoch or sample time; extra trailing zeroes are accepted. Export emits UTCGregorian milliseconds.

Script import accepts only literal `Create Spacecraft`/`Create CoordinateSystem` and uniquely assigned supported properties. DateFormat must be UTCGregorian, DisplayStateType Keplerian, and the frame Earth/Mars MJ2000Eq. Full mission scripts, assignments to unsupported resources, expressions, object copies, includes, maneuvers and propagation are refused. The normal orbit quote and actor/revision rules still decide whether an imported state can become a game design. A separate altitude-shape/inclination-only candidate preserves the current body, frame, epoch and orientation and is explicitly not an exact import.

The external viewer owns no score, power, crew or science. It uses the existing Canvas and pauses the attempt; closing does not resume. Position interpolation is a display approximation and does not imply continuation of GMAT dynamics.

### Initial-condition export comparison (2026-11-14)

The integration owner ran the generated Earth and Mars scripts with NASA GMAT R2025a. Both executed without syntax errors; optional Python and MATLAB plugin warnings were unrelated to these scripts. Reports explicitly selected EarthMJ2000Eq and the Mars-origin AstrixMarsFrame, respectively. The measured position-vector error, unscaled velocity-vector error and normalized velocity-direction residual versus ASTRIX were:

| Body | Position error | Raw velocity error | Velocity-direction residual |
|---|---:|---:|---:|
| Earth | 9.09 × 10⁻¹³ km | 3.9258 × 10⁻⁶ km/s | 1.28 × 10⁻¹⁵ |
| Mars | 1.17 × 10⁻⁸ km | 1.0768 × 10⁻⁵ km/s | 3.68 × 10⁻¹⁵ |

The speed ratios imply μ ≈ 398600.4415 km³/s² for Earth and 42828.314258067 km³/s² for Mars, inferred from these outputs rather than independently queried GMAT constants. The raw velocity differences therefore do not meet 10⁻⁸ km/s and are not represented as a pass at that tolerance. This comparison covers the selected initial conditions, not future GMAT dynamics or arbitrary imports.

To generate actual exported initial states and corresponding ASTRIX Cartesian references:

```sh
bun scripts/gmat-export-fixtures.ts /tmp/astrix-gmat
cd /path/to/GMAT/bin
./GmatConsole-R2025a -r /tmp/astrix-gmat/earth.script
./GmatConsole-R2025a -r /tmp/astrix-gmat/mars.script
```

Compare the resulting `astrix-earth-state.txt` and `astrix-mars-state.txt` reports in the GMAT output directory with `/tmp/astrix-gmat/*-astrix.json`. These commands generate local files and invoke an independently installed executable; browser uploads never invoke GMAT.

## Mission-design expansion: independent conic references

Observed 2026-11-15: the downloaded NASA GMAT R2025a console successfully interpreted and ran [validate-flight.script](../../scripts/validate-flight.script). The script explicitly sets Earth μ to 398600 and Luna μ to 4902.8 km³/s², matching the new engine's rounded constants. It uses RungeKutta89 with point-mass gravity, no drag, SRP or third-body force, and inertial body-centered frames.

The Earth transfer starts at radius 6578.137 km with tangential speed 7.784257434611812 km/s. Its first impulse is +2.4545860090817744 km/s; at the transfer apoapsis, a second +1.4772709110334405 km/s impulse circularizes. GMAT's `VNB` first axis is the velocity direction. Mass decrement is deliberately disabled in this independent **kinematics** case; it does not validate the game's fuel accounting.

| Reference state | Elapsed seconds reported by GMAT | Position vector (km) | Velocity vector (km/s) |
|---|---:|---|---|
| Transfer apoapsis, before circularization | 18931.93096113391 | (−42164.13699999993, 4.566022327179287e−7, 0) | (−6.408207786705008e−11, −1.597388674032814, 0) |
| After circularization | 18931.93096113391 | Same position | (−1.233454187749175e−10, −3.074659585066255, 0) |
| Earth escape: initial (6578.137, 0, 0) km and (0, 11.3, 0) km/s | 86400 | (−268932.0309020925, 157475.1054304831, 0) | (−2.709612233076099, 1.310232636839253, 0) |
| Lunar circular coast: initial radius 1837.4 km, speed 1.6335041143928368 km/s | 7067.459813109599 | (1837.399999999994, −5.701440386474133e−7, 0) | (5.068897523941018e−10, 1.633504114392833, 0) |

Requested transfer and lunar times were 18931.930961285834 s and 7067.459813349092 s. The small reported-time differences are retained rather than rounded away. Compare the application at the actual reported time, or disclose the resulting time offset.

Reproduce from the extracted distribution's `bin` directory:

```sh
./GmatConsole-R2025a -r /absolute/path/to/astrix/scripts/validate-flight.script
```

The reports are `output/astrix-raise-reference.txt`, `output/astrix-escape-reference.txt` and `output/astrix-moon-reference.txt`. Optional Python 3.12 and MATLAB plugin libraries were unavailable; neither was used. This independent run establishes reference outputs only: it does not by itself demonstrate application agreement, atmospheric ascent, a lunar ephemeris, sphere-of-influence transitions, lunar targeting, resource integration or full mission success. Application comparison results belong in [Verification](../VERIFICATION.md).
