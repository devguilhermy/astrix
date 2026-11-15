import { expect, test } from 'bun:test';
import { tourNavigation } from './tourNavigation';
import { TOUR_CONCEPTS_KEY, TOUR_STORAGE_KEY, readTourHistory, readTourPersistence, saveTourHistory, saveTourPersistence, useTourStore } from './tourStore';
import { conceptIdsFor } from './tours';

const memory=(initial:Record<string,string>={})=>{const data={...initial};return {data,getItem:(key:string)=>data[key]??null,setItem:(key:string,value:string)=>{data[key]=value;}};};
test('back clamps at the first card; next finishes only after the last',()=>{
 expect(tourNavigation(0,5,'back')).toEqual({index:0,finish:false});expect(tourNavigation(3,5,'next')).toEqual({index:4,finish:false});expect(tourNavigation(4,5,'next')).toEqual({index:4,finish:true});expect(tourNavigation(4,5,'back')).toEqual({index:3,finish:false});
});
test('v2 per-surface history is independent and rejects unknown statuses',()=>{
 const storage=memory();saveTourHistory({welcome:'finished',build:'skipped'},storage);expect(storage.data[TOUR_STORAGE_KEY]).toBeTruthy();expect(readTourHistory(storage)).toEqual({welcome:'finished',build:'skipped'});
 expect(readTourHistory(memory({[TOUR_STORAGE_KEY]:'{"flight":"finished","debrief":"invalid","unknown":"finished"}'}))).toEqual({flight:'finished'});
 expect(readTourHistory(memory({[TOUR_STORAGE_KEY]:'broken'}))).toEqual({});
});
test('migration from v2 keeps an earlier opt-out and completed chapters',()=>{
 const skipped=readTourPersistence(memory({[TOUR_STORAGE_KEY]:'{"welcome":"finished","build":"skipped"}'}));
 expect(skipped.curriculumSkipped).toBe(true);expect(skipped.concepts.mission).toBe('seen');expect(skipped.concepts.hardware).toBe('dismissed');
 const finished=readTourPersistence(memory({[TOUR_STORAGE_KEY]:'{"welcome":"finished"}'}));
 expect(finished.curriculumSkipped).toBe(false);expect(finished.history).toEqual({welcome:'finished'});
 const storage=memory();saveTourPersistence({history:{},concepts:{mission:'seen'},curriculumSkipped:true},storage);
 expect(readTourPersistence(storage)).toEqual({history:{},concepts:{mission:'seen'},curriculumSkipped:true});expect(storage.data[TOUR_CONCEPTS_KEY]).toContain('"version":3');
});
test('skipping an automatic card suppresses the remaining curriculum; replay and finish leave it alone',()=>{
 useTourStore.setState({active:null,index:0,history:{},concepts:{},curriculumSkipped:false,origin:'auto'});
 useTourStore.getState().start('welcome');useTourStore.getState().end(false);
 let state=useTourStore.getState();
 expect(state.active).toBeNull();expect(state.curriculumSkipped).toBe(true);
 for(const id of ['welcome','build','launch','flight','debrief'] as const)expect(state.history[id]).toBe('skipped');
 // Explicit help replay of an already skipped chapter does not rewrite its status and can still finish.
 useTourStore.getState().start('build','help');useTourStore.getState().end(true,conceptIdsFor('build'));
 state=useTourStore.getState();expect(state.history.build).toBe('skipped');expect(state.curriculumSkipped).toBe(true);
 useTourStore.setState({active:null,index:0,history:{},concepts:{},curriculumSkipped:false,origin:'auto'});
 useTourStore.getState().start('flight');useTourStore.getState().end(true,conceptIdsFor('flight'));
 state=useTourStore.getState();expect(state.history.flight).toBe('finished');expect(state.curriculumSkipped).toBe(false);expect(state.concepts.systems).toBe('seen');
 useTourStore.getState().start('choice','help');useTourStore.getState().end(false);
 expect(useTourStore.getState().curriculumSkipped).toBe(false);
});
test('declining the expert offer retires further offers without finishing anything',()=>{
 useTourStore.setState({active:null,index:0,history:{},concepts:{},curriculumSkipped:false,origin:'auto'});
 useTourStore.getState().declineOffers();
 expect(useTourStore.getState().curriculumSkipped).toBe(true);expect(useTourStore.getState().history.welcome).toBe('offered');
});
