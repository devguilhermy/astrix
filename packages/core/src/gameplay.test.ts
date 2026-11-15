import { describe, expect, test } from 'bun:test';
import { canonicalJson, deepFreeze, digestOf } from './mission/digest';
import { defaultQuickDesign, missionOffers, quickDesignBrief, quickKitOptions, validateQuickDesignConfig } from './quickDesign';
import { certifyQuickDesign, commitTurn, createTurnGame, previewTurn, restoreTurnGame, retryTurnGame, turnDebrief, turnDecision } from './gameplay';
import { createSim, flight } from './sim/state';
import { telemetry, nextBoundary } from './sim/selectors';
import { forecastTimeline } from './sim/forecast';
import { stepSim } from './sim/step';
import { runTrajectory } from './sim/trajectoryForecast';
import { universalPropagate, len, cross, dotv } from './flight/conic';
import { lambertVelocity } from './flight/lambert';
import { CONSTANTS, elementsForOrbit, propagate } from './physics';
import type { TurnGameState, TurnResult } from './gameplayTypes';

function accepted(result: TurnResult) { if(!result.ok)throw new Error(`${result.code}: ${result.message}`);return result.value; }
function commit(game:TurnGameState,planId:string,key=`turn-${game.revision}`) {
 return accepted(commitTurn(game,{decisionId:turnDecision(game).id,baseRevision:game.revision,planId,idempotencyKey:key}));
}

describe('immutable deterministic turn authority',()=>{
 test('preview and commitment resolve exactly the same immutable state, resources and receipt',()=>{
  const game=deepFreeze(createTurnGame(defaultQuickDesign())),before=canonicalJson(game);
  const a=accepted(previewTurn(game,'observe')),b=accepted(previewTurn(game,'observe')),c=commit(game,'observe');
  expect(a).toEqual(b);expect(a.state.sim).toEqual(c.state.sim);expect(a.receipt).toEqual(c.receipt);
  expect(c.receipt.elapsedSec).toBeGreaterThan(0);expect(c.state.revision).toBe(1);expect(canonicalJson(game)).toBe(before);
  expect(c.receipt.delta.deliveredMB).toBe(c.telemetry.objective.value);
 });
 test('stale decisions and reused keys cannot advance twice',()=>{
  const game=createTurnGame(defaultQuickDesign()),request={decisionId:turnDecision(game).id,baseRevision:0,planId:'observe',idempotencyKey:'once'};
  const next=accepted(commitTurn(game,request)).state,duplicate=accepted(commitTurn(next,request));
  expect(duplicate.state).toBe(next);expect(duplicate.receipt).toEqual(next.receipts[0]);
  expect(commitTurn(next,{...request,idempotencyKey:'new'})).toMatchObject({ok:false,code:'STALE_DECISION'});
  expect(commitTurn(next,{...request,planId:'abort'})).toMatchObject({ok:false,code:'DUPLICATE_KEY'});
  expect(previewTurn(game,'unlisted')).toMatchObject({ok:false,code:'INVALID_PLAN'});
 });
 test('all published committed state is finite JSON and geometry forecasts do not mutate prediction caches',()=>{
  const game=createTurnGame(defaultQuickDesign()),before=structuredClone(game.sim);
  forecastTimeline(game.sim,86400);nextBoundary(game.sim);
  expect(game.sim).toEqual(before);expect(JSON.parse(JSON.stringify(game))).toEqual(game);
  const next=commit(game,'observe').state;expect(()=>canonicalJson(next)).not.toThrow();
 });
 test('boundary saves replay the evidence; tampering and old rules are refused',()=>{
  const game=commit(createTurnGame(defaultQuickDesign()),'observe').state;
  expect(restoreTurnGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
  const altered=structuredClone(game);flight(altered.sim).socWh+=1;
  expect(()=>restoreTurnGame(altered)).toThrow('deterministic');
  expect(()=>restoreTurnGame({...game,rulesVersion:5})).toThrow('Unsupported');
  expect(()=>restoreTurnGame({...game,commits:[]})).toThrow('incomplete');
 });
 test('checkpoint retries retain assisted provenance through save and subsequent commitments',()=>{
  const checkpoint=createTurnGame(defaultQuickDesign()),later=commit(checkpoint,'observe').state;
  const retried=retryTurnGame(later,checkpoint),branch=commit(retried,'observe').state;
  expect(branch.assisted).toBe(true);expect(telemetry(branch.sim).assisted).toBe(true);
  expect(restoreTurnGame(JSON.parse(JSON.stringify(branch)))).toEqual(branch);
  expect(retryTurnGame(later).config).toEqual(later.config);
 });
 test('aborting never fabricates completion or adds discoveries for unmet goals',()=>{
  const ended=commit(createTurnGame(defaultQuickDesign()),'abort').state,d=turnDebrief(ended);
  expect(d.outcome).not.toBe('SUCCESS');expect(d.discoveries).toEqual([]);expect(d.cause).toBe('SESSION_ENDED');
  expect(turnDecision(ended)).toMatchObject({terminal:true,plans:[]});
 });
});

describe('actual readiness, complete identity and bounded constraints',()=>{
 test('a nominal readiness witness commits through the ordinary engine to actual delivered evidence',()=>{
  const config=defaultQuickDesign(),proof=certifyQuickDesign(config);let game=createTurnGame(config,proof);
  expect(['READY','STRETCHED']).toContain(proof.status);
  for(const planId of proof.witness)game=commit(game,planId).state;
  const d=turnDebrief(game);expect(d.outcome).toBe('SUCCESS');expect(d.evidence.filter(e=>e.required).every(e=>e.state==='MET')).toBe(true);
  expect(d.evidence[0].actual).toBeGreaterThanOrEqual(d.evidence[0].target!);
 });
 test('goal, seed, route, kit and initial orbit invalidate certification without changing the allowance',()=>{
  const config=defaultQuickDesign(),brief=quickDesignBrief(config),proof=certifyQuickDesign(config);
  for(const change of [{ambition:'AMBITIOUS' as const},{seed:8},{approach:'CAUTIOUS' as const},{kit:'LIGHT' as const}]){
   const changed={...config,...change},b=quickDesignBrief(changed);
   expect(b.identity).not.toBe(brief.identity);expect(b.budgets.cost.limit).toBe(brief.budgets.cost.limit);
   expect(()=>createTurnGame(changed,proof)).toThrow('different design');
  }
  const initialOrbit={...brief.design.orbit!,epochUTC:'2026-11-14T00:00:00.123Z'};
  const imported={...config,initialOrbit};expect(validateQuickDesignConfig(imported)).toBe(true);
  expect(quickDesignBrief(imported).design.orbit).toEqual(initialOrbit);expect(quickDesignBrief(imported).identity).not.toBe(brief.identity);
  expect(validateQuickDesignConfig({...imported,initialOrbit:{...initialOrbit,epochUTC:'2026-02-31T00:00:00Z'}})).toBe(false);
  expect(validateQuickDesignConfig({...config,seed:Infinity})).toBe(false);
  expect(validateQuickDesignConfig({...config,budget:1e9})).toBe(false);
 });
 test('oversized equipment is refused even if a caller forges a Ready badge',()=>{
  const bad={...defaultQuickDesign('EARTH_TO_MOON','EXPERT'),kit:'SCIENCE' as const},b=quickDesignBrief(bad);
  expect(b.blockers.some(r=>r.code==='NO_SLOT')).toBe(true);
  expect(certifyQuickDesign(bad).status).toBe('OVER_LIMITS');
  const forged={...certifyQuickDesign(defaultQuickDesign()),identity:b.identity,status:'READY' as const};
  expect(()=>createTurnGame(bad,forged)).toThrow();
 });
 for(const level of ['ASPIRING','EXPERT'] as const)for(const offer of missionOffers(undefined,level)){
  test(`${level} ${offer.missionId} has two physically certified approaches`,()=>{
   const cautious={...offer.config,approach:'CAUTIOUS' as const},balanced={...offer.config,approach:'BALANCED' as const};
   for(const config of [cautious,balanced]){
    const p=certifyQuickDesign(config);expect(['READY','STRETCHED']).toContain(p.status);expect(p.outcome).toBe('SUCCESS');expect(p.witness.length).toBeGreaterThan(0);
   }
   expect(quickDesignBrief(cautious).identity).not.toBe(quickDesignBrief(balanced).identity);
  },180000);
 }
 test('powered lunar success requires actual launch, upper-stage burns, captured Moon orbit and delivered maps',()=>{
  const config=defaultQuickDesign('EARTH_TO_MOON'),p=certifyQuickDesign(config);let game=createTurnGame(config);
  for(const plan of p.witness)game=commit(game,plan).state;
  const t=telemetry(game.sim),s=flight(game.sim),events=game.receipts.flatMap(r=>r.events);
  expect(t.outcome).toBe('SUCCESS');expect(events.some(e=>e.kind==='LIFTOFF')).toBe(true);expect(events.some(e=>e.kind==='ORBIT_INSERTION')).toBe(true);
  expect(s.traj.receipts.map(r=>r.id)).toEqual(['TLI','LOI']);expect(s.traj.receipts.every(r=>r.status==='EXECUTED'&&r.propellantUsedKg>0)).toBe(true);
  expect(t.flight?.orbit).toMatchObject({body:'MOON',kind:'ELLIPSE'});expect(t.objective.value).toBeGreaterThan(0);
  expect(t.evidence.every(e=>!e.required||e.state==='MET')).toBe(true);
  expect(game.receipts.find(r=>r.planId==='launch')!.delta.fuelKg).toBeLessThan(0);
 },180000);
});

describe('retained numeric and event edge contracts',()=>{
 test('deadline at ignition wins before the burn can manufacture objective evidence',()=>{
  const b=quickDesignBrief(defaultQuickDesign('RAISE_YOUR_ORBIT')),raw={...b.design.definition,objectives:b.design.definition.objectives.map(o=>({...o,deadlineSec:60}))};
  const definition={...raw,digest:digestOf(raw)},design={...b.design,definition,definitionDigest:definition.digest};let sim=createSim(design,17);
  for(let i=0;i<100&&!telemetry(sim).ended;i++)sim=stepSim(sim,60).state;
  expect(telemetry(sim).outcome).toBe('FAILURE');expect(flight(sim).traj.receipts).toHaveLength(0);expect(flight(sim).propellantKg).toBe(22);
 });
 test('apsis burns arm once rather than chasing the next apsis on every integration tick',()=>{
  const d=quickDesignBrief(defaultQuickDesign('LEAVE_ORBIT_SAFELY')).design,run=runTrajectory(d,20000);
  expect(run.final.traj.receipts).toHaveLength(1);expect(run.final.traj.receipts[0].status).toBe('EXECUTED');
  expect(run.final.traj.receipts[0].propellantUsedKg).toBeGreaterThan(0);
  expect(()=>runTrajectory(d,NaN)).toThrow();
 });
 test('near-parabolic long coasts remain finite, reversible and conservative',()=>{
  const mu=CONSTANTS.EARTH.mu.v,r:[number,number,number]=[7000,0,0];
  for(const scale of [1-1e-10,1,1+1e-10,1.02]){
   const v:[number,number,number]=[0,Math.sqrt(2*mu/7000)*scale,0],initial=dotv(v,v)/2-mu/len(r),x=universalPropagate(r,v,5e6,mu);
   expect([...x.r,...x.v].every(Number.isFinite)).toBe(true);expect(Math.abs(dotv(x.v,x.v)/2-mu/len(x.r)-initial)).toBeLessThan(1e-8);
   const back=universalPropagate(x.r,x.v,-5e6,mu);expect(len([back.r[0]-r[0],back.r[1]-r[1],back.r[2]-r[2]])).toBeLessThan(.01);
  }
  expect(()=>universalPropagate([0,0,0],[1,0,0],0,mu)).toThrow();expect(()=>universalPropagate(r,[0,8,0],Infinity,mu)).toThrow();
 });
 test('Lambert targeting reaches its specified endpoint under the same conic propagator',()=>{
  const mu=CONSTANTS.EARTH.mu.v,r:[number,number,number]=[7000,0,0],target:[number,number,number]=[-100000,20000,5000],duration=50000;
  const v=lambertVelocity(r,target,duration,mu,[0,0,1]);expect(v).not.toBeNull();
  const at=universalPropagate(r,v!,duration,mu);expect(len([at.r[0]-target[0],at.r[1]-target[1],at.r[2]-target[2]])).toBeLessThan(.01);
  expect(len(cross(r,v!))).toBeGreaterThan(0);
 });
});

describe('tangible quick-design tradeoffs',()=>{
 test('ambition never buys budget and science hardware consumes real mass, power and cost',()=>{
  const light=quickDesignBrief({...defaultQuickDesign(),kit:'LIGHT'}),science=quickDesignBrief({...defaultQuickDesign(),kit:'SCIENCE'});
  expect(science.budgets.cost.used).toBeGreaterThan(light.budgets.cost.used);
  expect(science.budgets.massKg.used).toBeGreaterThan(light.budgets.massKg.used);
  expect(science.budgets.power!.avgLoadW).toBeGreaterThan(light.budgets.power!.avgLoadW);
  expect(science.design.parts.find(p=>p.partId==='CAM_EO')!.qty).toBe(2);
  expect(science.budgets.cost.limit).toBe(light.budgets.cost.limit);
  expect(quickDesignBrief({...light.config,ambition:'AMBITIOUS'}).budgets.cost.limit).toBe(light.budgets.cost.limit);
 });
 test('Expert SmallSat thermal hardware is charged and actually changes heat rejection',()=>{
  const brief=quickDesignBrief(defaultQuickDesign('RAISE_YOUR_ORBIT','EXPERT')),s=flight(createSim(brief.design,17));
  expect(brief.design.parts.some(p=>p.partId==='SS_RADIATOR')).toBe(true);
  expect(s.extraRadiatorM2).toBe(.05);expect(brief.budgets.technical!.thermalHotEquilibriumK).toBeLessThan(330);
  expect(s.socWh).toBe(s.capacityWh);
 });
 test('a lunar SOI stop leaves insertion unarmed until a fresh commitment',()=>{
  const config=defaultQuickDesign('EARTH_TO_MOON'),proof=certifyQuickDesign(config);let game=createTurnGame(config),checked=false;
  for(const plan of proof.witness){
   game=commit(game,plan).state;
   if(game.receipts.at(-1)!.events.some(e=>e.kind==='SOI_ENTRY')){
    checked=true;expect(flight(game.sim).traj.burns).toEqual([]);
    expect(telemetry(game.sim).evidence.find(e=>e.kind==='BOUND_ORBIT')!.state).not.toBe('MET');
    expect(turnDecision(game).plans.some(p=>p.kind==='MANEUVER')).toBe(true);break;
   }
  }
  expect(checked).toBe(true);
 },180000);
});

test('an imported Mars initial state starts at that epoch and conic, not on a fictional Earth departure',()=>{
 const source=quickDesignBrief(defaultQuickDesign('RED_RELAY')).design.orbit!;
 const initialOrbit={...source,epochUTC:'2026-11-14T00:00:00.123Z',trueAnomalyDeg:73,raanDeg:15,argPeriapsisDeg:20};
 const config={...defaultQuickDesign('RED_RELAY'),initialOrbit},brief=quickDesignBrief(config);
 expect(brief.blockers).toEqual([]);
 const state=createSim(brief.design,config.seed),s=flight(state),t=telemetry(state);
 expect(s.t).toBe(0);expect(s.arrivalT).toBe(0);expect(s.cruise).toBe(false);expect(s.capturePending).toBe(false);expect(s.captured).toBe(true);
 expect(s.traj.conic!.t0).toBe(0);expect(s.traj.conic!.body).toBe('MARS');
 expect(t.storedMB).toBe(0);expect(t.downlinkedMB).toBe(0);expect(s.propellantKg).toBe(0);
 expect(s.epochUTC).toBe(initialOrbit.epochUTC);expect(brief.budgets.deltaV!.requiredKms).toBe(0);
 expect(t.flight!.view.central.epochUTC).toBe(initialOrbit.epochUTC);
 const expected=propagate(elementsForOrbit(initialOrbit),CONSTANTS.MARS.mu.v,0),actual=t.flight!.view.central;
 expect(len([actual.rKm[0]-expected.position[0],actual.rKm[1]-expected.position[1],actual.rKm[2]-expected.position[2]])).toBeLessThan(1e-7);
 expect(len([actual.vKms[0]-expected.velocity[0],actual.vKms[1]-expected.velocity[1],actual.vKms[2]-expected.velocity[2]])).toBeLessThan(1e-10);
 expect(t.evidence.every(e=>e.state!=='MET')).toBe(true);
 expect(certifyQuickDesign(config).outcome).toBe('SUCCESS');
},180000);

test('each non-data ambition band changes an actual physical goal without buying allowance',()=>{
 for(const missionId of ['UP_AND_BACK','LEAVE_ORBIT_SAFELY','MEET_THE_MOON'] as const){
  const short=quickDesignBrief({...defaultQuickDesign(missionId),ambition:'SHORT'}),standard=quickDesignBrief(defaultQuickDesign(missionId)),ambitious=quickDesignBrief({...defaultQuickDesign(missionId),ambition:'AMBITIOUS'});
  expect(short.design.definition.objectives[0].spec).not.toEqual(standard.design.definition.objectives[0].spec);
  expect(ambitious.design.definition.objectives[0].spec).not.toEqual(standard.design.definition.objectives[0].spec);
  expect(short.budgets.cost.limit).toBe(ambitious.budgets.cost.limit);
  expect(short.target[0].target).not.toBe(ambitious.target[0].target);expect(short.target[0].unit).toBe('km');
 }
});

test('equivalent hardware labels are deduplicated without silently changing the selected kit',()=>{
 expect(quickKitOptions(defaultQuickDesign('UP_AND_BACK','EXPERT'))).toEqual(['ENDURANCE']);
 expect(quickKitOptions({...defaultQuickDesign('MEET_THE_MOON','EXPERT'),kit:'SCIENCE'})).toEqual(['SCIENCE']);
 const crew=quickKitOptions({...defaultQuickDesign('CREW_PATHFINDER'),kit:'SCIENCE'});
 expect(crew).toEqual(['SCIENCE','ENDURANCE']);
 expect(quickKitOptions(defaultQuickDesign('FIRST_SIGNAL'))).toHaveLength(3);
});
