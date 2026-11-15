import { expect, test } from 'bun:test';
import { createSession, toPublicSnapshot } from '@astrix/session';
import { useMission } from '../store';
import { bindRoomSink, clearRoom, projectSnapshot, roomSession, updateRoom, readCredential, saveCredential } from './session';
test('newer snapshots replace projection despite sequence gaps; duplicates never regress it',()=>{
 clearRoom();const state=createSession({epoch:'room-epoch',mode:'LAN',hostPlayerId:'host'}),snapshot=toPublicSnapshot({...state,seq:2});
 bindRoomSink(()=>{}, {credential:'fixture-only',host:true,playerId:'host'});
 expect(useMission.getState().remoteMode).toBe(true);expect(projectSnapshot(snapshot)).toBe(true);expect(projectSnapshot({...snapshot,seq:2})).toBe(false);expect(projectSnapshot({...snapshot,seq:1})).toBe(false);expect(projectSnapshot({...snapshot,seq:9})).toBe(true);expect(roomSession().snapshot?.seq).toBe(9);
 useMission.getState().advance(60,true);expect(roomSession().snapshot?.seq).toBe(9);expect(projectSnapshot({...snapshot,epoch:'other',seq:10})).toBe(false);expect(roomSession().status).toBe('ended');clearRoom();
});
test('unavailable session storage preserves memory identity but refresh requires re-pairing',()=>{
 if(typeof sessionStorage!=='undefined')return;
 updateRoom({storageAvailable:true});saveCredential({credential:'fixture-only',host:false});expect(roomSession().identity?.credential).toBe('fixture-only');expect(roomSession().storageAvailable).toBe(false);expect(readCredential()).toBeNull();clearRoom();
});
