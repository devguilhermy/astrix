import { expect, test } from 'bun:test';
import { tourNavigation } from './tourNavigation';
import { readTourHistory,saveTourHistory,TOUR_STORAGE_KEY,useTourStore } from './tourStore';
test('back clamps at the first card; next finishes only after the last',()=>{
 expect(tourNavigation(0,5,'back')).toEqual({index:0,finish:false});expect(tourNavigation(3,5,'next')).toEqual({index:4,finish:false});expect(tourNavigation(4,5,'next')).toEqual({index:4,finish:true});expect(tourNavigation(4,5,'back')).toEqual({index:3,finish:false});
});
test('tour persistence is independent per surface and rejects unknown statuses',()=>{
 let stored='';const storage={setItem(key:string,value:string){expect(key).toBe(TOUR_STORAGE_KEY);stored=value;},getItem:()=>stored};saveTourHistory({welcome:'finished',build:'skipped'},storage);expect(readTourHistory(storage)).toEqual({welcome:'finished',build:'skipped'});stored='{"flight":"finished","debrief":"invalid","unknown":"finished"}';expect(readTourHistory(storage)).toEqual({flight:'finished'});stored='broken';expect(readTourHistory(storage)).toEqual({});
});
test('skip and finish close every active card without affecting another tour',()=>{
 useTourStore.setState({history:{welcome:'finished'},active:null,index:0});useTourStore.getState().start('build');useTourStore.getState().move(2);useTourStore.getState().end(false);expect(useTourStore.getState().active).toBeNull();expect(useTourStore.getState().history).toEqual({welcome:'finished',build:'skipped'});useTourStore.getState().start('flight');useTourStore.getState().end(true);expect(useTourStore.getState().history.flight).toBe('finished');expect(useTourStore.getState().index).toBe(0);
});
