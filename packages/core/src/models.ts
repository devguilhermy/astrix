import type { BusId, LevelId, Q, ScenarioId } from './contracts';
import { clamp } from './physics';

export const RULES_VERSION = 4;
export interface ModelParameter extends Q { readonly units: string; readonly range: readonly [number, number] }
const parameter = (v: number, units: string, range: readonly [number, number], note: string): ModelParameter => ({ v, units, range, p: { kind: 'assumption', note: `${note} Rules ${RULES_VERSION}; authored educational coefficient, not calibrated hardware data.` } });
export const LEVELS: Readonly<Record<LevelId, { budgetFactor: ModelParameter; technical: boolean }>> = {
 ASPIRING: { budgetFactor: parameter(1.30, 'budget multiplier', [1, 2], 'Existing difficulty allowance; no hidden free hardware.'), technical: false },
 EXPERT: { budgetFactor: parameter(1.275, 'budget multiplier', [1, 2], 'Explicit allowance funds paid thermal, power, payload and enough radio hardware for allocated contact after coarse recovery.'), technical: true },
};
export const ENGINEERING = {
 sigma: parameter(5.670374419e-8, 'W m^-2 K^-4', [5.670374419e-8, 5.670374419e-8], 'Rounded Stefan–Boltzmann constant derived from SI defining constants.'),
 solarFlux: parameter(1361, 'W/m² at 1 AU', [1300, 1400], 'Rounded reference solar irradiance, inverse-square scaling shared with electrical power.'),
 arrayEol: parameter(.86, 'fraction of BOL output', [.7, 1], 'Monotonic linear exercise-duration array degradation; not real 14-day aging.'),
 batteryEol: parameter(.85, 'fraction of BOL capacity', [.7, 1], 'Monotonic linear exercise-duration battery capacity envelope; no chemical repair.'),
 reacquireSec: parameter(180, 's', [60, 600], 'Sensor/actuator fallback acquisition time; not momentum unloading.'),
 reacquirePower: parameter(2, 'W for CubeSat; ×10 SmallSat', [1, 5], 'Extra electrical load during reacquisition.'),
 fallbackAccuracyScale: parameter(1.5, 'accuracy-error multiplier', [1, 3], 'Recovered ADCS retains increased deterministic angular calibration bias; no hardware repair.'),
 normalThreshold: parameter(.65, 'dimensionless quality', [.5, .9], 'Minimum reduced envelope quality for normal mode; not dB.'),
 robustThreshold: parameter(.3, 'dimensionless quality', [.1, .5], 'Robust mode tolerance; no propagation through occultation.'),
 degradedLinkQuality: parameter(.45, 'dimensionless quality', [.3, .6], 'Scheduled bounded degraded-link envelope.'),
 robustRate: parameter(.45, 'fraction of normal rate', [.2, .7], 'Coding/resilience throughput trade-off.'),
 robustPower: parameter(1.2, 'transmit-power multiplier', [1, 1.5], 'Extra modeled robust-link transmit power.'),
 allocationHours: parameter(8, 'h per Earth day', [4, 12], 'Authored station allocation, not a live DSN schedule.'),
 commandLifetimeSec: parameter(172800, 's', [3600, 259200], 'Every operational request expires after two Earth days, including waiting time.'),
 resetCooldownSec: parameter(300, 's', [60, 1800], 'Minimum reset cooling/diagnostic interval before recovery can start.'),
 bootSec: parameter(120, 's', [60, 600], 'Powered recovery duration; explicit restart leaves payload/send Off.'),
 bootPower: parameter(3, 'W for CubeSat; ×10 SmallSat', [1, 10], 'Additional boot power, reserved and debited at recovery start.'),
 captureLow: parameter(-.04, 'fraction of nominal Δv', [-.1, 0], 'Lower bounded capture demand; sampled once per Technical Mars attempt.'),
 captureHigh: parameter(.08, 'fraction of nominal Δv', [0, .2], 'Upper planning requirement; uncertainty changes burn demand, not the solved orbit.'),
 thermalDwellSec: parameter(600, 's', [60, 1800], 'Continuous survival-limit violation required for thermal terminal failure.'),
 payloadDwellSec: parameter(30, 's', [10, 120], 'Continuous operating-limit violation before thermal payload inhibition.'),
 heaterOnK: parameter(278, 'K', [270, 285], 'AUTO thermostat turns On at/below this temperature.'),
 heaterOffK: parameter(286, 'K', [280, 295], 'AUTO thermostat turns Off at/above this temperature.'),
} as const;
export interface ThermalModel { capacityJK: ModelParameter; radiatorM2: ModelParameter; absorbingM2: ModelParameter; bodyHeatW: ModelParameter; emissivity: ModelParameter; operatingMinK: ModelParameter; operatingMaxK: ModelParameter; survivalMinK: ModelParameter; survivalMaxK: ModelParameter; initialK: ModelParameter }
const thermal = (capacity: number, area: number, absorbing: number, bodyHeat: number): ThermalModel => ({
 capacityJK: parameter(capacity, 'J/K', [capacity / 2, capacity * 2], 'Single equipment-bus lumped thermal capacity.'),
 radiatorM2: parameter(area, 'm²', [area / 2, area * 2], 'Effective radiating area/view factor into deep space.'),
 absorbingM2: parameter(absorbing, 'm²', [absorbing / 2, absorbing * 2], 'Solar absorption area includes absorptivity/view factor; flux is multiplied by area.'),
 bodyHeatW: parameter(bodyHeat, 'W', [0, bodyHeat * 2], 'Bounded absorbed body infrared, constant in this reduced model; albedo omitted.'),
 emissivity: parameter(.8, 'fraction', [.5, 1], 'Gray-body radiative emissivity.'),
 operatingMinK: parameter(260, 'K', [250, 275], 'Payload lower operating limit.'),
 operatingMaxK: parameter(330, 'K', [315, 345], 'Payload upper operating limit.'),
 survivalMinK: parameter(230, 'K', [210, 250], 'Equipment-bus survival lower limit.'),
 survivalMaxK: parameter(360, 'K', [345, 380], 'Equipment-bus survival upper limit.'),
 initialK: parameter(290, 'K', [275, 305], 'Initial/arrival thermal condition; cruise thermal physics is not modeled.'),
});
export const THERMAL_MODELS: Readonly<Record<BusId, ThermalModel>> = {
 CUBESAT_3U: thermal(6000, .025, .003, 1),
 SMALLSAT: thermal(120000, .28, .08, 10),
 CREW_CAPSULE: thermal(5000000, 8, 1, 200),
};
export const MISSION_REQUIREMENTS: Readonly<Record<ScenarioId, { payload: string; recordingMB: number; minimumLinkKbps: number }>> = {
 FIRST_LIGHT: { payload: 'CAM_EO', recordingMB: 1000, minimumLinkKbps: 100 },
 STORM_WATCH: { payload: 'RAD_MON', recordingMB: 32, minimumLinkKbps: 1 },
 CREW_PATHFINDER: { payload: 'CREW_OBSERVER', recordingMB: 100, minimumLinkKbps: 100 },
 RED_RELAY: { payload: 'SS_MAPPER', recordingMB: 6500, minimumLinkKbps: 100 },
};
export function lifeFactor(elapsed: number, durationSec: number, eol: number): number { return 1 - (1 - eol) * clamp(elapsed / durationSec, 0, 1); }
export function thermalEquilibriumK(bus: BusId, absorbedW: number): number {
 const m = THERMAL_MODELS[bus];
 return Math.pow(Math.max(0, absorbedW) / (ENGINEERING.sigma.v * m.emissivity.v * m.radiatorM2.v), .25);
}
export const isTechnical = (profile: LevelId): boolean => profile === 'EXPERT';
export function stationAllocated(t: number, offsetSec = 0): boolean { const daySec = 86400; return (((t - offsetSec) % daySec) + daySec) % daySec < ENGINEERING.allocationHours.v * 3600; }
/** Midpoint integration of C dT/dt = absorbed W − εσAT⁴; dt is seconds. */
export function thermalStepK(bus: BusId, temperatureK: number, absorbedW: number, dtSec: number): number {
 const m = THERMAL_MODELS[bus], k = ENGINEERING.sigma.v * m.emissivity.v * m.radiatorM2.v;
 const midpoint = temperatureK + (absorbedW - k * temperatureK ** 4) * dtSec / (2 * m.capacityJK.v);
 return temperatureK + (absorbedW - k * midpoint ** 4) * dtSec / m.capacityJK.v;
}
