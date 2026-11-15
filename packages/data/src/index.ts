import radlab from '../snapshots/radlab-dostel1-2024-05-10.json';
import donki from '../snapshots/donki-2024-05.json';
import usgs from '../snapshots/usgs-missions.json';
import sources from '../sources-extra.json';
import type { RadlabProfile, UsgsMission } from './contracts';

export const RADLAB_PROFILE: RadlabProfile = radlab;
export const DONKI_SNAPSHOT = donki;
export const USGS_MISSIONS: readonly UsgsMission[] = usgs.missions;
export const EXTRA_SOURCES = sources;
export { SCIENCE_TOPICS } from './science';
export { SCIENCE_BINDINGS } from './scienceBindings';
export { TRAJECTORY_SCIENCE_EN, TRAJECTORY_SCIENCE_PT_BR } from './scienceTrajectory';
export type { ScienceTopicId } from './science';
export type * from './contracts';
