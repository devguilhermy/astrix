/** Static, decorative mission diagrams; no renderer or simulation state. */
export function HomeIllustration({ mission }: { mission?: string }) {
 const mars = mission === 'RED_RELAY', storm = mission === 'STORM_WATCH', crew = mission === 'CREW_PATHFINDER', moon = mission === 'EARTH_TO_MOON' || mission === 'MEET_THE_MOON';
 const surface = mars ? '#bd765d' : moon ? '#8d969e' : '#397c98', accent = mars ? '#f5a983' : storm ? '#f6bf75' : crew ? '#b6c9fa' : moon ? '#dfe4e8' : '#79e2e9';
 return <svg className="home-orbit-art" viewBox="0 0 460 310" aria-hidden="true" focusable="false">
  <defs><radialGradient id={`planet-${mission ?? 'hero'}`} cx="32%" cy="24%"><stop stopColor={surface}/><stop offset="1" stopColor="#0a1726"/></radialGradient><linearGradient id={`sweep-${mission ?? 'hero'}`}><stop stopColor={accent} stopOpacity=".05"/><stop offset="1" stopColor={accent} stopOpacity=".7"/></linearGradient></defs>
  <g fill="none"><circle cx="229" cy="157" r="112" stroke="#607b8f" strokeOpacity=".18"/><circle cx="229" cy="157" r="132" stroke="#607b8f" strokeOpacity=".12" strokeDasharray="3 9"/><ellipse cx="229" cy="157" rx="187" ry="73" transform="rotate(-24 229 157)" stroke={`url(#sweep-${mission ?? 'hero'})`} strokeWidth="1.5"/><path d="M52 251h66m-33-8v16M352 55h48m-24-8v16" stroke={accent} strokeOpacity=".35"/><path d="M19 28h36M19 28v36M441 282h-36m36 0v-36" stroke="#6c91a4" strokeOpacity=".35"/></g>
  <circle cx="229" cy="157" r="73" fill={`url(#planet-${mission ?? 'hero'})`} stroke={accent} strokeOpacity=".4"/>
  <g fill="none" stroke={accent} strokeOpacity=".24"><ellipse cx="229" cy="157" rx="73" ry="26"/><ellipse cx="229" cy="157" rx="31" ry="73"/><path d="M159 137h140M159 176h140"/></g>
  <g transform="translate(333 91) rotate(-24)" stroke={accent} strokeWidth="2" strokeLinejoin="round"><path d="M-18 -10h36v20h-36z" fill="#0d2131"/><path d="M-24-4h-30v9h30m48-9h30v9H24" fill="#142d40"/><path d="M-14 0h28M0-10v20" fill="none"/><circle cx="0" cy="0" r="2.5" fill={accent}/></g>
  {storm && <g stroke="#ffcf87" strokeWidth="2" opacity=".6"><path d="M79 68l17 8-17 8m19-8h32" fill="none"/><path d="M97 96l15 6-15 6" fill="none"/></g>}
  {crew && <g transform="translate(130 211)" fill="none" stroke="#b6c9fa" strokeWidth="2" opacity=".7"><path d="M-9 12 0-14 9 12Z"/><path d="M-11 12h22"/></g>}
  <g fill={accent}><circle cx="74" cy="118" r="2"/><circle cx="392" cy="196" r="2"/><circle cx="106" cy="235" r="2"/><circle cx="369" cy="49" r="2"/></g>
 </svg>;
}
