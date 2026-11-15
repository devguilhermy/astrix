import { playTone } from './tones';
export type CueId='part'|'refusal'|'signoff'|'passStart'|'passEnd'|'decision'|'storm'|'failure'|'success';
let settings={sound:false,uiVolume:.3,alertVolume:.4};
const lastPlayed=new Map<string,number>();
export function configureAudio(next:typeof settings):void{settings=next;}
export function resetAudioGate():void{lastPlayed.clear();}
export function playCue(id:CueId):void{if(!settings.sound)return;const now=performance.now(),alert=['decision','storm','failure'].includes(id),gap=alert?4000:80;if(now-(lastPlayed.get(id)??-Infinity)<gap)return;lastPlayed.set(id,now);const volume=(alert?settings.alertVolume:settings.uiVolume)*.13;switch(id){case'part':playTone(440,660,.08,'sine',volume);break;case'refusal':playTone(180,180,.07,'square',volume);playTone(140,140,.07,'square',volume,.1);break;case'signoff':playTone(523,523,.14,'sine',volume);playTone(784,784,.18,'sine',volume,.12);break;case'passStart':playTone(300,700,.25,'triangle',volume);break;case'passEnd':playTone(700,300,.25,'triangle',volume);break;case'decision':for(let i=0;i<3;i++)playTone(500,600,.1,'sine',volume,i*.17);break;case'storm':playTone(100,220,.8,'triangle',volume);break;case'failure':playTone(400,90,.7,'sawtooth',volume);break;case'success':[523,659,784].forEach((f,i)=>playTone(f,f,.3,'sine',volume,i*.15));}}
