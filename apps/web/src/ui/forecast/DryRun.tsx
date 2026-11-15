import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MissionForecast } from '@astrix/core';
import { DAY } from '@astrix/core/physics';
import { useMission } from '../../store';
import { missionDurationDays, progressMetric } from '../missions/definitionView';
import { EvidenceList } from '../missions/EvidenceList';
import './forecast.css';

type ForecastSample = MissionForecast['samples'][number];
type Status = 'idle' | 'running' | 'cancelled' | 'done' | 'error';

function ForecastChart({ samples, field, label }: {
  samples: readonly ForecastSample[];
  field: 'socWh' | 'storedMB' | 'downlinkedMB';
  label: string;
}) {
  const max = Math.max(1, ...samples.map(sample => sample[field]));
  const first = samples[0]?.t ?? 0;
  const duration = Math.max(1, (samples.at(-1)?.t ?? first) - first);
  const points = samples.map(sample => `${4 + (sample.t - first) / duration * 292},${66 - sample[field] / max * 58}`).join(' ');
  return <figure className="forecast-chart">
    <figcaption>{label}</figcaption>
    <svg viewBox="0 0 300 76" role="img" aria-label={label}>
      <title>{label}</title>
      <path d="M4 4 V66 H296" fill="none" stroke="currentColor" opacity=".25"/>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
    <span className="number">{new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(samples.at(-1)?.[field] ?? 0)}</span>
  </figure>;
}

/** Read-only device-local forecast. Terminating the worker cancels all simulation work. */
export function DryRun() {
  const design = useMission(state => state.design);
  const definition = useMission(state => state.definition);
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<MissionForecast | null>(null);
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    worker.current?.terminate();
    worker.current = null;
    setStatus('idle');
    setResult(null);
    setError('');
    return () => {
      request.current++;
      worker.current?.terminate();
      worker.current = null;
    };
  }, [design]);
  if (!design) return null;
  const metric = progressMetric(definition);
  const format = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(value);
  const run = () => {
    const id = ++request.current;
    worker.current?.terminate();
    setResult(null);
    setError('');
    setStatus('running');
    try {
      const next = new Worker(new URL('./forecast.worker.ts', import.meta.url), { type: 'module' });
      worker.current = next;
      next.onmessage = (event: MessageEvent<{ id: number; result?: MissionForecast; error?: string }>) => {
        if (event.data.id !== request.current) return;
        if (event.data.result) {
          setResult(event.data.result);
          setStatus('done');
        } else {
          setError(event.data.error ?? 'No forecast result');
          setStatus('error');
        }
        next.terminate();
        if (worker.current === next) worker.current = null;
      };
      next.onerror = event => {
        if (id !== request.current) return;
        setError(event.message);
        setStatus('error');
        next.terminate();
        if (worker.current === next) worker.current = null;
      };
      next.postMessage({ id, design, definition, horizonSec: missionDurationDays(definition) * DAY });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('error');
    }
  };
  const cancel = () => {
    request.current++;
    worker.current?.terminate();
    worker.current = null;
    setStatus('cancelled');
  };
  return <section className="dry-run" data-cue-target="dry-run" aria-labelledby="forecast-title" aria-busy={status === 'running'}>
    <h3 id="forecast-title">{t('forecast.title')}</h3>
    <p>{t('forecast.intro')}</p>
    <button className="button" onClick={status === 'running' ? cancel : run}>
      {t(status === 'running' ? 'forecast.cancel' : 'forecast.run')}
    </button>
    <div role="status" aria-live="polite">
      {status === 'running' && <p>{t('forecast.running')}</p>}
      {status === 'cancelled' && <p>{t('forecast.cancelled')}</p>}
      {status === 'error' && <><p>{t('forecast.failed')}</p><details><summary>{t('forecast.errorDetails')}</summary><pre>{error}</pre></details></>}
      {result && <>
        {metric && <p className="forecast-verdict">{t('forecast.verdict', {
          value: format(result.objectiveValue), target: format(result.objectiveTarget),
          unit: t(metric === 'DOWNLINK_MB' ? 'forecast.mb' : 'forecast.hours'),
        })} · {t(`forecast.${result.outcome}`)}</p>}
        {!metric && <p className="forecast-verdict">{t(`forecast.${result.outcome}`)}</p>}
        <EvidenceList evidence={result.evidence} label={t('forecast.evidence')} predicted/>
      </>}
    </div>
    {result && <>
      <div className="forecast-charts">
        <ForecastChart samples={result.samples} field="socWh" label={t('forecast.battery')}/>
        <ForecastChart samples={result.samples} field="storedMB" label={t('forecast.storage')}/>
        <ForecastChart samples={result.samples} field="downlinkedMB" label={t('forecast.delivered')}/>
      </div>
      <details className="forecast-samples"><summary>{t('forecast.samples')}</summary>
        <table><thead><tr><th>{t('forecast.day')}</th><th>{t('forecast.battery')}</th><th>{t('forecast.storage')}</th><th>{t('forecast.delivered')}</th></tr></thead>
          <tbody>{result.samples.map((sample, index) => <tr key={`${sample.t}-${index}`}>
            <td>{format((sample.t - (result.samples[0]?.t ?? 0)) / DAY)}</td><td>{format(sample.socWh)}</td><td>{format(sample.storedMB)}</td><td>{format(sample.downlinkedMB)}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </>}
    <details><summary>{t('forecast.policyTitle')}</summary><p>{t('forecast.policy')}</p><p>{t('forecast.limits')}</p></details>
  </section>;
}
