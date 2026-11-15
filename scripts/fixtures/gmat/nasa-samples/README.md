# NASA GMAT sample files

Unmodified copies from https://github.com/nasa/GMAT (main @ b8aec552, fetched 2026-11-15), Apache-2.0.
Served as example inputs on the GMAT tools page (referenced from apps/web/src/ui/advanced/examples.ts; Vite emits them as build assets).

| File | Origin path | Use |
|---|---|---|
| Tut_SimulatingAnOrbit.script | application/samples/ | Earth LEO, full mission (Propagate, burn, force model) |
| Ex_HohmannTransfer.script | application/samples/ | Earth transfer with maneuvers |
| Ex_MarsOrbit.script | application/samples/ | Mars-centred mission |
| Ex_OEMPropagation.script | application/samples/ | Script that consumes an OEM ephemeris |
| SampleOEMEphem.oem | application/data/vehicle/ephem/ccsds/ | Real CCSDS OEM (v1.0, EME2000/UTC, Earth) |

Current `parseInitialOrbit` / `parseOem` behaviour: all four scripts are rejected (full scripts are out of
profile per MISSION_FLOW_REFINEMENT_SPEC §9.3); the OEM is rejected (`USEABLE_START_TIME` metadata, v1.0).
