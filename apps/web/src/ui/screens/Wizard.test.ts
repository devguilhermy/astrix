import { expect, test } from 'bun:test';
import { readDraft,emptyDraft,saveDraft,swapDraftRole,moveDraftRole,type SetupDraft } from './Wizard';
test('invalid persisted selections cannot become a mission attempt',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({version:1,level:'ENGINEER',mission:'UNKNOWN',players:9,assignments:{SCIENCE:9}})}});
 try{const draft=readDraft('draft');expect(draft?.level).toBe('ASPIRING');expect(draft?.mission).toBeNull();expect(draft?.players).toBe(1);expect(draft?.assignments.SCIENCE).toBe(0);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('single-screen setup starts with Aspiring and requires an explicit mission choice',()=>{expect(emptyDraft.level).toBe('ASPIRING');expect(emptyDraft.mission).toBeNull();expect(emptyDraft.players).toBe(1);});
test('mission, level and hot-seat assignments survive device-local draft persistence',()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let stored='';Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}}});try{const draft={...emptyDraft,mission:'FIRST_LIGHT' as const,level:'EXPERT' as const,players:2,assignments:{SCIENCE:0,SPACECRAFT:1,LAUNCH_ORBIT:0,GROUND_COMMS:1}};saveDraft('draft',draft);expect(readDraft('draft')).toEqual(draft);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}});

test('player-column role changes swap owners without losing or duplicating a responsibility',()=>{
 for(const players of [2,3,4]) {
  const draft:SetupDraft={...emptyDraft,players,assignments:{SCIENCE:0,SPACECRAFT:1,LAUNCH_ORBIT:2%players,GROUND_COMMS:3%players}};
  const before=JSON.stringify(draft),next=swapDraftRole(draft,0,'SCIENCE','SPACECRAFT');
  expect(next.assignments.SCIENCE).toBe(1);expect(next.assignments.SPACECRAFT).toBe(0);
  expect(Object.keys(next.assignments).sort()).toEqual(['GROUND_COMMS','LAUNCH_ORBIT','SCIENCE','SPACECRAFT']);
  for(let player=0;player<players;player++)expect(Object.values(next.assignments).filter(owner=>owner===player).length).toBe(Object.values(draft.assignments).filter(owner=>owner===player).length);
  expect(JSON.stringify(draft)).toBe(before);
 }
});
test('additional responsibility preserves the existing multi-role and empty-player configurations',()=>{
 const draft:SetupDraft={...emptyDraft,players:4,assignments:{SCIENCE:0,SPACECRAFT:1,LAUNCH_ORBIT:2,GROUND_COMMS:3}};
 const next=moveDraftRole(draft,'SPACECRAFT',0);
 expect(next.assignments).toEqual({SCIENCE:0,SPACECRAFT:0,LAUNCH_ORBIT:2,GROUND_COMMS:3});
 expect(new Set(Object.keys(next.assignments)).size).toBe(4);
 expect(draft.assignments.SPACECRAFT).toBe(1);
 expect(moveDraftRole(next,'SPACECRAFT',0)).toBe(next);
 expect(swapDraftRole(next,0,'SCIENCE','SPACECRAFT')).toBe(next);
});
