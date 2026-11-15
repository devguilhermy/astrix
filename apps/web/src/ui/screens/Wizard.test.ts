import { expect, test } from 'bun:test';
import { readDraft,emptyDraft,saveDraft } from './Wizard';
test('invalid persisted selections cannot become a mission attempt',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({version:1,level:'ENGINEER',mission:'UNKNOWN',players:9,assignments:{SCIENCE:9}})}});
 try{const draft=readDraft('draft');expect(draft?.level).toBe('ASPIRING');expect(draft?.mission).toBeNull();expect(draft?.players).toBe(1);expect(draft?.assignments.SCIENCE).toBe(0);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});

test('single-screen setup starts with Aspiring and requires an explicit mission choice',()=>{expect(emptyDraft.level).toBe('ASPIRING');expect(emptyDraft.mission).toBeNull();expect(emptyDraft.players).toBe(1);});
test('mission, level and hot-seat assignments survive device-local draft persistence',()=>{const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let stored='';Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}}});try{const draft={...emptyDraft,mission:'FIRST_LIGHT' as const,level:'EXPERT' as const,players:2,assignments:{SCIENCE:0,SPACECRAFT:1,LAUNCH_ORBIT:0,GROUND_COMMS:1}};saveDraft('draft',draft);expect(readDraft('draft')).toEqual(draft);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}});
