import { beforeEach, expect, test } from 'bun:test';
import { listParts } from '@astrix/core';
import { getSessionState, useMission } from '../../store';
import { english, portuguese } from '../../i18n/resources';
import { CURRICULUM_LIMIT, CURRICULUM_TOURS, MAX_TOUR_CARDS, conceptIdsFor, stepsForTour, targetsForStep, tours, type TourId } from './tours';
import { useTourStore } from './tourStore';

beforeEach(()=>{useMission.getState().resetMission();useMission.getState().setTeam(1);useMission.getState().startMission('FIRST_LIGHT','ASPIRING');});

test('the automatic curriculum is exactly 3 + 5 + 2 + 3 + 2 concepts, numbered 1 to 15',()=>{
 expect(CURRICULUM_TOURS.map(id=>tours[id].length)).toEqual([3,5,2,3,2]);
 const numbers=CURRICULUM_TOURS.flatMap(id=>tours[id].map(step=>step.concept));
 expect(numbers).toEqual(Array.from({length:CURRICULUM_LIMIT},(_,i)=>i+1));
 expect(tours.choice.length).toBe(1);expect(tours.choice[0]!.concept).toBeNull();
});
test('content, hardware and presentation can never inflate any rendered tour',()=>{
 const s=useMission.getState();
 for(const part of listParts(s.design!.busId))useMission.getState().addPart(part.id);
 useMission.getState().setSettings({presentation:'DETAILED'});
 const state=useMission.getState();
 for(const id of Object.keys(tours) as TourId[])expect(stepsForTour(id,state).length).toBeLessThanOrEqual(MAX_TOUR_CARDS);
 expect(CURRICULUM_TOURS.reduce((sum,id)=>sum+stepsForTour(id,state).length,0)).toBeLessThanOrEqual(CURRICULUM_LIMIT);
});
test('every card has a stable unique id, bilingual copy and at least one anchor',()=>{
 const ids=Object.values(tours).flat().map(step=>step.id);
 expect(new Set(ids).size).toBe(ids.length);
 for(const step of Object.values(tours).flat()){
  for(const part of ['title','body'])for(const copy of [english,portuguese])expect(copy[`tour.card.${step.id}.${part}`]?.trim().length,`${step.id}.${part}`).toBeGreaterThan(0);
  expect(targetsForStep(step,true).length).toBeGreaterThan(0);
 }
 for(const key of ['progress','concept','skipIntro','close','offerLabel','sharedClock','pauseTeam','teamPaused'])for(const copy of [english,portuguese])expect(copy[`tour.${key}`]).toBeTruthy();
});
test('tour start, move and end never mutate the authoritative session',()=>{
 const before=getSessionState();
 useTourStore.getState().start('build');useTourStore.getState().move(2,conceptIdsFor('build').slice(0,2));useTourStore.getState().end(true,conceptIdsFor('build'));
 expect(getSessionState()).toBe(before);
});
