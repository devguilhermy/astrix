// Reproducible numerical investigation, not a human playtest or calibrated probability.
// bun packages/core/scripts/sweepGameplay.ts [--full] [--approach=CAUTIOUS|BALANCED|FAST] [--output=path]
import { certifyQuickDesign, defaultQuickDesign, missionOffers, quickDesignBrief } from '../src';
import type { QuickAmbition, QuickApproach, QuickKit } from '../src';

const full=process.argv.includes('--full');
const approachFilter=process.argv.find(arg=>arg.startsWith('--approach='))?.slice('--approach='.length);
const missionFilter=process.argv.find(arg=>arg.startsWith('--mission='))?.slice('--mission='.length);
const rows=[];
for(const level of ['ASPIRING','EXPERT'] as const) for(const offer of missionOffers(undefined,level)) {
 if(missionFilter&&offer.missionId!==missionFilter)continue;
 for(const kit of (full?['LIGHT','ENDURANCE','SCIENCE']:['ENDURANCE']) as QuickKit[]) for(const ambition of (full?['SHORT','STANDARD','AMBITIOUS']:['STANDARD']) as QuickAmbition[]) for(const approach of (full?['CAUTIOUS','BALANCED','FAST']:['CAUTIOUS','BALANCED']) as QuickApproach[]) {
  if(approachFilter&&approach!==approachFilter)continue;
  const config={...defaultQuickDesign(offer.missionId,level),kit,ambition,approach};
  const started=performance.now();
  try {
   const brief=quickDesignBrief(config),proof=certifyQuickDesign(config);
   const row={config,identity:proof.identity,status:proof.status,outcome:proof.outcome,cost:brief.budgets.cost,mass:brief.budgets.massKg,volume:brief.budgets.volume,energy:brief.budgets.power,propulsion:brief.budgets.deltaV,burns:brief.design.burns,ascent:brief.design.launch,blockers:brief.blockers,reasons:proof.reasons,margins:proof.margins,turns:proof.turns,witness:proof.witness,computationMs:performance.now()-started};
   rows.push(row);console.log(JSON.stringify(row));
  } catch(error) { const row={config,error:String(error),computationMs:performance.now()-started};rows.push(row);console.log(JSON.stringify(row)); }
 }
}
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
if(output)await Bun.write(output,JSON.stringify({kind:'ASTRIX nominal-model numerical sweep; not human usability evidence',full,approachFilter,rows},null,2)+'\n');
