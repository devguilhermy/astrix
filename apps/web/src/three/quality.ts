/// <reference lib="es2024.promise" />
// Adapted from Void Protocol (© Guilhermy), apps/web/src/rendering/quality.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
// Adaptation: ASTRIX profile fields; detection reads the existing context, never creates another.
import { useSyncExternalStore } from 'react';
export type QualityTier='LOW'|'MEDIUM'|'HIGH';
export type QualityOverride='AUTO'|QualityTier;
export interface QualityProfile{dprMax:number;msaa:boolean;orbitSamples:number;labelBudget:number;gridDensity:number}
export const QUALITY_PROFILES:Record<QualityTier,QualityProfile>={LOW:{dprMax:1,msaa:false,orbitSamples:64,labelBudget:8,gridDensity:8},MEDIUM:{dprMax:1.25,msaa:false,orbitSamples:96,labelBudget:16,gridDensity:12},HIGH:{dprMax:1.5,msaa:true,orbitSamples:160,labelBudget:24,gridDensity:18}};
export interface GpuFacts{renderer:string|null;hardwareConcurrency:number;devicePixelRatio:number}
export function classifyStaticTier(facts:GpuFacts):QualityTier{const renderer=facts.renderer??'';if(/NVIDIA|GeForce|GTX|RTX|\bNV\d{2,3}\b|Radeon\s*(RX|R9|HD 7|Pro)|RX\s*(3|4|5)/i.test(renderer))return'HIGH';if(/Intel|UHD|Iris|Graphics|Mali|Adreno|PowerVR/i.test(renderer))return'LOW';return'MEDIUM';}
export function applyFrameProbe(tier:QualityTier,median:number|null):QualityTier{if(median===null||median<=33)return tier;return tier==='HIGH'?'MEDIUM':'LOW';}
export function medianOf(values:readonly number[]):number|null{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=sorted.length>>1;return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
export function readGpuFacts(gl:WebGLRenderingContext|WebGL2RenderingContext):GpuFacts{const ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):null,hardwareConcurrency:navigator.hardwareConcurrency||4,devicePixelRatio:window.devicePixelRatio||1};}
export function measureFrameProbe(durationMs=2000):Promise<number|null>{if(typeof requestAnimationFrame==='undefined')return Promise.resolve(null);const{promise,resolve}=Promise.withResolvers<number|null>();const frames:number[]=[];let last=performance.now();const start=last;const tick=(now:number)=>{frames.push(now-last);last=now;if(now-start<durationMs)requestAnimationFrame(tick);else resolve(medianOf(frames.slice(10)));};requestAnimationFrame(tick);return promise;}
function readOverride():QualityOverride{if(typeof localStorage==='undefined')return'AUTO';try{const v=localStorage.getItem('astrix.quality');return v==='LOW'||v==='MEDIUM'||v==='HIGH'?v:'AUTO';}catch{return'AUTO';}}
let override=readOverride(),detected:QualityTier='MEDIUM',resolved:QualityTier=override==='AUTO'?detected:override,probeStarted=false;
const listeners=new Set<()=>void>();
function emit(){resolved=override==='AUTO'?detected:override;if(typeof document!=='undefined')document.documentElement.dataset.quality=resolved;listeners.forEach(listener=>listener());}
export function getQualityOverride(){return override;}
export function setQualityOverride(next:QualityOverride){override=next;try{if(typeof localStorage!=='undefined')localStorage.setItem('astrix.quality',next);}catch{/* Quality preferences are optional. */}emit();}
export function getQualityTier(){return resolved;}
export function getQualityProfile(){return QUALITY_PROFILES[resolved];}
export function subscribeQuality(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function useQuality(){return useSyncExternalStore(subscribeQuality,getQualityTier,getQualityTier);}
export function useQualityProfile(){return QUALITY_PROFILES[useQuality()];}
export function detectQuality(gl:WebGLRenderingContext|WebGL2RenderingContext){detected=classifyStaticTier(readGpuFacts(gl));emit();}
export function runFrameProbeOnce(){if(probeStarted||override!=='AUTO')return;probeStarted=true;void measureFrameProbe().then(median=>{detected=applyFrameProbe(detected,median);emit();});}
