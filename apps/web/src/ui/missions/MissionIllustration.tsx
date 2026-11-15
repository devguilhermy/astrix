import { useId } from 'react';
import './missionIllustration.css';

/** Decorative mission diagrams, restored from the original landing; not flight telemetry. */
export function MissionIllustration({mission}:{mission:string}) {
 const id=useId(), mars=mission==='RED_RELAY', moon=mission==='EARTH_TO_MOON'||mission==='MEET_THE_MOON', storm=mission==='STORM_WATCH', crew=mission==='CREW_PATHFINDER';
 const ascent=mission==='UP_AND_BACK'||mission==='STAY_IN_ORBIT', maneuver=mission==='RAISE_YOUR_ORBIT'||mission==='LEAVE_ORBIT_SAFELY'||mission==='PAST_EARTH';
 const surface=mars?'#bd765d':moon?'#8d969e':'#397c98',accent='#79caff';
 return <svg className="mission-illustration" viewBox="0 0 460 260" aria-hidden="true" focusable="false">
  <defs><radialGradient id={`${id}-planet`} cx="32%" cy="24%"><stop stopColor={surface}/><stop offset="1" stopColor="#0a1726"/></radialGradient><linearGradient id={`${id}-sweep`}><stop stopColor={accent} stopOpacity=".12"/><stop offset="1" stopColor={accent} stopOpacity=".85"/></linearGradient></defs>
  <g fill="none"><circle cx="229" cy="130" r="104" stroke="#607b8f" strokeOpacity=".25"/><ellipse cx="229" cy="130" rx="187" ry="66" transform="rotate(-24 229 130)" stroke={`url(#${id}-sweep)`} strokeWidth="1.5"/>{maneuver&&<ellipse cx="229" cy="130" rx="145" ry="104" transform="rotate(-24 229 130)" stroke="#ffa44c" strokeDasharray="5 7"/>}</g>
  <circle cx="229" cy="130" r="66" fill={`url(#${id}-planet)`} stroke={accent} strokeOpacity=".4"/>
  <g fill="none" stroke={accent} strokeOpacity=".24"><ellipse cx="229" cy="130" rx="66" ry="24"/><ellipse cx="229" cy="130" rx="28" ry="66"/><path d="M166 112h126M166 148h126"/></g>
  {ascent?<g transform="translate(324 62) rotate(30)" stroke={accent} strokeWidth="2" fill="#142d40"><path d="M-10 20V-12L0-29 10-12v32Z"/><path d="m-10 4-9 16h9m20-16 9 16H10"/><path d="m-6 24 6 22 6-22" fill="#ff9d37" stroke="#ffc27b"/></g>:<g transform="translate(333 64) rotate(-24)" stroke={accent} strokeWidth="2" strokeLinejoin="round"><path d="M-18-10h36v20h-36z" fill="#0d2131"/><path d="M-24-4h-30v9h30m48-9h30v9H24" fill="#142d40"/><path d="M-14 0h28M0-10v20" fill="none"/><circle cx="0" cy="0" r="2.5" fill="#ffad52"/></g>}
  {moon&&<><circle cx="83" cy="64" r="21" fill="#b4bec8"/><circle cx="77" cy="59" r="6" fill="#8995a2"/><path d="M98 80Q173 14 310 53" stroke="#ffad52" strokeDasharray="5 6" fill="none"/></>}
  {storm&&<g stroke="#ffb45e" strokeWidth="2" fill="none"><path d="m63 57 17 8-17 8m19-8h32m-17 20 15 6-15 6"/></g>}
  {crew&&<g transform="translate(125 201)" fill="none" stroke="#ffb45e" strokeWidth="2"><path d="M-9 12 0-14 9 12ZM-11 12h22"/></g>}
  <g fill={accent}><circle cx="54" cy="137" r="2"/><circle cx="392" cy="196" r="2"/><circle cx="106" cy="235" r="2"/><circle cx="389" cy="39" r="2"/></g>
 </svg>;
}
