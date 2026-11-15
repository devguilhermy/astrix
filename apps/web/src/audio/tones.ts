// Adapted from Void Protocol (© Guilhermy), apps/web/src/utils/soundManager.ts (context/master gain and playTone only) @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
let audioContext:AudioContext|null=null;
let masterGain:GainNode|null=null;
let unlocked=false;
export function unlockAudio():void{unlocked=true;if(typeof window==='undefined'||!window.AudioContext)return;if(!audioContext){audioContext=new AudioContext();masterGain=audioContext.createGain();masterGain.connect(audioContext.destination);}if(audioContext.state==='suspended')void audioContext.resume();}
export function playTone(freqStart:number,freqEnd:number,duration:number,type:OscillatorType,volume:number,delay=0):void{if(!unlocked||!audioContext||!masterGain)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime+delay;oscillator.type=type;oscillator.frequency.setValueAtTime(freqStart,at);if(freqEnd!==freqStart)oscillator.frequency.linearRampToValueAtTime(freqEnd,at+duration);gain.gain.setValueAtTime(Math.max(.001,volume),at);gain.gain.exponentialRampToValueAtTime(.001,at+duration);oscillator.connect(gain);gain.connect(masterGain);oscillator.start(at);oscillator.stop(at+duration);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
