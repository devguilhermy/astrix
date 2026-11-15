import { forecastTrajectory, previewAscent, previewBurn, recommendAscentProgram, recommendBurns, type AscentPreview, type AscentProgram, type BurnPreview, type BurnSpec, type Design, type SimState, type TrajectoryForecast } from '@astrix/core';

/** All flight previews run here: they are pure, bounded (up to ~64 x 1500 RK4 steps) and must never block input or render. */
export type FlightRequest =
  | { id: number; op: 'ascent'; design: Design }
  | { id: number; op: 'recommendAscent'; design: Design }
  | { id: number; op: 'burn'; subject: Design | SimState; burn: BurnSpec }
  | { id: number; op: 'trajectory'; subject: Design | SimState; horizonSec: number }
  | { id: number; op: 'recommendBurns'; design: Design };
export type RecommendedAscent = { ok: true; program: AscentProgram; preview: AscentPreview } | { ok: false; code: string };
export type FlightResult = AscentPreview | RecommendedAscent | BurnPreview | TrajectoryForecast | readonly BurnSpec[];
export type FlightResponse = { id: number; result: FlightResult } | { id: number; error: string };

self.onmessage = (event: MessageEvent<FlightRequest>) => {
  const request = event.data;
  try {
    let result: FlightResult;
    switch (request.op) {
      case 'ascent': result = previewAscent(request.design); break;
      case 'recommendAscent': { const found = recommendAscentProgram(request.design); result = 'program' in found ? { ok: true, program: found.program, preview: found.preview } : { ok: false, code: found.code }; break; }
      case 'burn': result = previewBurn(request.subject, request.burn); break;
      case 'trajectory': result = forecastTrajectory(request.subject, request.horizonSec); break;
      case 'recommendBurns': result = recommendBurns(request.design); break;
    }
    const response: FlightResponse = { id: request.id, result };
    self.postMessage(response);
  } catch (error) {
    const response: FlightResponse = { id: request.id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
