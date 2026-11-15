import { forecastMission, type Design, type ResolvedMissionDefinition } from '@astrix/core';

self.onmessage = (event: MessageEvent<{ id: number; design: Design; definition: ResolvedMissionDefinition; horizonSec: number }>) => {
  const { id, design, horizonSec } = event.data;
  try {
    const result = forecastMission(design, 'DEFAULT', horizonSec);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
