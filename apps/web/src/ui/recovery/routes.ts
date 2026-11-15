import { useCallback, useEffect, useState } from 'react';
import { useMission } from '../../store';

const setupPages: Readonly<Record<string, true>> = { '': true, level: true, mission: true, team: true, preferences: true, review: true };
const stages: Readonly<Record<string, true>> = { need_goals: true, concept: true, requirements: true, design: true, build_verify: true, implement: true, review: true };

/** Hash routes are presentation only; a direct mission link never creates or restores a flight. */
export function isKnownLocation(pathname: string, hash: string, basePath = '/'): boolean {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (pathname !== base && pathname !== `${base}index.html`) return false;
  if (hash === '' || hash === '#' || hash === '#home') return true;
  const route = hash.slice(1).split('/');
  if (route.length > 2) return false;
  if (route[0] === 'setup') return setupPages[route[1] ?? ''] === true;
  return route[0] === 'mission' && stages[route[1] ?? ''] === true;
}

export function useRouteStatus(basePath: string) {
  const [notFound, setNotFound] = useState(() => !isKnownLocation(location.pathname, location.hash, basePath));
  useEffect(() => {
    const update = () => setNotFound(!isKnownLocation(location.pathname, location.hash, basePath));
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, [basePath]);
  useEffect(() => {
    const state = useMission.getState();
    if (notFound) state.pause('route');
    else if (state.pauseReasons.includes('route')) state.clearPauseReason('route');
  }, [notFound]);
  const showHome = useCallback(() => {
    history.replaceState(null, '', `${basePath}#home`);
    setNotFound(false);
  }, [basePath]);
  return { notFound, showHome };
}
