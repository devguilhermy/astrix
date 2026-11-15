/**
 * Explore ship: board a schematic ship in the solar view and fly it. Plan: docs/plans/EXPLORE_SHIP_PLAN.md.
 * Presentation only: flying never advances mission time and nothing here is a NASA observation.
 */
export interface ExploreBody { id: string; name: { en: string; pt: string }; position: readonly [number, number, number]; radius: number }
export interface ExploreTelemetry { speed: number; position: readonly [number, number, number]; nearest: { id: string; distance: number } | null; mode: 'chase' | 'cockpit' }
/** Inside <Canvas>, rendered in the solar view next to SolarSystemScene. Takes over the camera while boarded. */
export { ExploreFlight } from './ExploreFlight';
/** Outside <Canvas>, DOM overlay: board / leave button, HUD, on-screen flight controls, help. */
export { ExploreHud } from './ExploreHud';
