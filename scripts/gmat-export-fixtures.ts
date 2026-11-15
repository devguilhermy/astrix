import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeOrbit, propagate, elementsForOrbit, CONSTANTS } from '../packages/core/src/physics';
import { exportInitialOrbit } from '../packages/core/src/interop/gmat';

// Run with `bun scripts/gmat-export-fixtures.ts /tmp/astrix-gmat`, then invoke the
// installed GMAT console on each generated script. Never used for uploaded text.
const dir = resolve(process.argv[2] ?? '/tmp/astrix-gmat');
mkdirSync(dir, {recursive:true});
for (const body of ['EARTH','MARS'] as const) {
 const orbit = {...makeOrbit(body,400,1200,62,'2024-05-01T00:00:00.000Z'),raanDeg:73,argPeriapsisDeg:116,trueAnomalyDeg:205};
 const state = propagate(elementsForOrbit(orbit),CONSTANTS[body].mu.v,0);
 const frame = body === 'EARTH' ? 'EarthMJ2000Eq' : 'AstrixMarsFrame';
 const fields = ['X','Y','Z','VX','VY','VZ'].map(axis => `Astrix.${frame}.${axis}`).join(' ');
 const script = `${exportInitialOrbit(orbit)}\nCreate ReportFile State;\nGMAT State.Filename = 'astrix-${body.toLowerCase()}-state.txt';\nGMAT State.Precision = 16;\nBeginMissionSequence;\nReport State ${fields};\n`;
 writeFileSync(resolve(dir,`${body.toLowerCase()}.script`),script);
 writeFileSync(resolve(dir,`${body.toLowerCase()}-astrix.json`),`${JSON.stringify({orbit,state},null,2)}\n`);
}
