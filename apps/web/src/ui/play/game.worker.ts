import { certifyQuickDesign, previewTurn, restoreTurnGame, type QuickDesignConfig, type TurnGameState } from '@astrix/core';

export type GameJob = {id:number;kind:'certify';config:QuickDesignConfig}|{id:number;kind:'preview';game:TurnGameState;planId:string}|{id:number;kind:'restore';game:unknown};
self.onmessage=(event:MessageEvent<GameJob>)=>{
  const job=event.data;
  try {
    const result=job.kind==='certify'?certifyQuickDesign(job.config):job.kind==='preview'?previewTurn(job.game,job.planId):restoreTurnGame(job.game);
    self.postMessage({id:job.id,result});
  }catch(error){self.postMessage({id:job.id,error:error instanceof Error?error.message:String(error)});}
};
