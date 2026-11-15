import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Same rule as the play style sheet: the system setting or the in-game preference. */
function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true') return true;
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const update = () => setReduced(prefersReducedMotion());
    const query = typeof matchMedia === 'function' ? matchMedia(QUERY) : null;
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
    query?.addEventListener('change', update);
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
    update();
    return () => { query?.removeEventListener('change', update); observer?.disconnect(); };
  }, []);
  return reduced;
}
