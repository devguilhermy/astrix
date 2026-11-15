import { useCallback, useState, useSyncExternalStore } from 'react';
import { createSession, reduceSession, type IntentEnvelope, type IntentResult, type SessionIntent, type SessionState } from '@astrix/session';
import { roomClient, requestId } from '../../multiplayer/client';
import { useRoomSession } from '../../multiplayer/session';

let local=createSession();
const listeners=new Set<()=>void>();
const localSnapshot=()=>local;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
/** Local and LAN intents share the session reducer. No browser clock advances gameplay. */
export function useTurnAuthority(remote:boolean) {
  const state=useSyncExternalStore(subscribe,localSnapshot,localSnapshot),room=useRoomSession();
  const [lastResult,setLastResult]=useState<IntentResult|null>(null),[pendingId,setPendingId]=useState<string|null>(null);
  const dispatch=useCallback((intent:SessionIntent):IntentResult|null=>{
    if(remote){
      const me=room.snapshot?.roster.find(player=>player.id===room.identity?.playerId);
      const id=roomClient().intent(intent,{playerId:room.identity?.playerId??'host',isHost:room.identity?.host??false,role:room.snapshot?.participantMode==='SOLO'?'ALL':me?.roles[0]??'SCIENCE'});
      setPendingId(id);return null;
    }
    const envelope:IntentEnvelope={id:requestId(),epoch:local.epoch,attemptId:local.attemptId,rosterRevision:local.rosterRevision,intent};
    const transition=reduceSession(local,envelope,{playerId:local.roster[0].id,isHost:true,role:'ALL'});
    local=transition.state;setLastResult(transition.result);
    for(const listener of listeners)listener();
    return transition.result;
  },[remote,room.snapshot,room.identity]);
  const outcome=pendingId?room.outcomes[pendingId]:undefined;
  return {
    state:remote?room.snapshot:state,game:remote?room.snapshot?.game??null:state.game,dispatch,
    host:!remote||!!room.identity?.host,connected:!remote||room.status==='connected',
    pending:remote&&outcome==='pending',unknown:remote&&outcome==='unknown',
    result:remote?(outcome&&typeof outcome==='object'?outcome:null):lastResult,
    localState:state as SessionState,
  };
}
