import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlightRequest, FlightResponse, FlightResult } from './flight.worker';

export type JobStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';
/** Distributes `Omit` over the request union so callers pass exactly one operation's payload. */
export type FlightCall = FlightRequest extends infer R ? R extends { id: number } ? Omit<R, 'id'> : never : never;
/**
 * One cancellable worker job at a time. A new run, `cancel()`, unmount, or `reset()` terminates the worker and drops any
 * stale response, so a result is only ever shown for the revision that requested it.
 */
export function useFlightJob<T extends FlightResult>() {
  const [status, setStatus] = useState<JobStatus>('idle'), [result, setResult] = useState<T | null>(null), [error, setError] = useState('');
  const worker = useRef<Worker | null>(null), request = useRef(0);
  const stop = useCallback(() => { request.current++; worker.current?.terminate(); worker.current = null; }, []);
  useEffect(() => stop, [stop]);
  const reset = useCallback(() => { stop(); setStatus('idle'); setResult(null); setError(''); }, [stop]);
  const cancel = useCallback(() => { stop(); setStatus('cancelled'); }, [stop]);
  const run = useCallback((call: FlightCall) => {
    stop();
    const id = ++request.current;
    setResult(null); setError(''); setStatus('running');
    try {
      const next = new Worker(new URL('./flight.worker.ts', import.meta.url), { type: 'module' });
      worker.current = next;
      const finish = () => { next.terminate(); if (worker.current === next) worker.current = null; };
      next.onmessage = (event: MessageEvent<FlightResponse>) => {
        if (event.data.id !== request.current) return;
        if ('result' in event.data) { setResult(event.data.result as T); setStatus('done'); } else { setError(event.data.error); setStatus('error'); }
        finish();
      };
      next.onerror = event => { if (id !== request.current) return; setError(event.message); setStatus('error'); finish(); };
      next.postMessage({ ...call, id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error'); }
  }, [stop]);
  return { status, result, error, run, cancel, reset };
}
