// Zero-revolution Lambert targeting in km/s. This computes a burn, never a flown outcome.
import { cross, dotv, len, scale, sub } from './conic';
import type { Vec3 } from '../physics';

/** Short/long-way, zero-revolution transfer selected by the departure orbit normal. */
export function lambertVelocity(r1: Vec3,r2: Vec3,seconds: number,mu: number,normal: Vec3): Vec3 | null {
 const a=len(r1),b=len(r2);
 if(![...r1,...r2,seconds,mu].every(Number.isFinite)||!(a>0&&b>0&&seconds>0&&mu>0))return null;
 const cosine=Math.max(-1,Math.min(1,dotv(r1,r2)/(a*b)));
 const sine=(dotv(cross(r1,r2),normal)>=0?1:-1)*Math.sqrt(Math.max(0,1-cosine*cosine));
 const A=sine*Math.sqrt(a*b/(1-cosine));
 if(!Number.isFinite(A)||Math.abs(A)<1e-8)return null;
 const evaluate=(z:number):{time:number;y:number}|null=>{
  let C:number,S:number;
  if(z>1e-7){const q=Math.sqrt(z);C=(1-Math.cos(q))/z;S=(q-Math.sin(q))/(q*q*q);}
  else if(z< -1e-7){const q=Math.sqrt(-z);C=(Math.cosh(q)-1)/(-z);S=(Math.sinh(q)-q)/(q*q*q);}
  else {C=.5-z/24+z*z/720;S=1/6-z/120+z*z/5040;}
  if(!(C>0))return null;
  const y=a+b+A*(z*S-1)/Math.sqrt(C);
  if(y<0)return null;
  const time=(Math.pow(y/C,1.5)*S+A*Math.sqrt(y))/Math.sqrt(mu);
  return Number.isFinite(time)?{time,y}:null;
 };
 // The zero-revolution branch lies below 4*pi². Invalid negative-y values lie below its physical time domain.
 let lo=-4*Math.PI*Math.PI,hi=4*Math.PI*Math.PI-1e-7,value:{time:number;y:number}|null=null;
 for(let n=0;n<100;n++){
  const z=(lo+hi)/2;value=evaluate(z);
  if(!value||value.time<seconds)lo=z;else hi=z;
 }
 value=evaluate((lo+hi)/2);
 if(!value||Math.abs(value.time-seconds)>Math.max(.001,seconds*1e-8))return null;
 const f=1-value.y/a,g=A*Math.sqrt(value.y/mu);
 return Math.abs(g)>1e-9?scale(sub(r2,scale(r1,f)),1/g):null;
}
