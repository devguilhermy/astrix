import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './recovery.css';

export function NotFound({ onHome }: { onHome(): void }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const title = document.title;
    document.title = `404 — ASTRIX`;
    heading.current?.focus();
    return () => { document.title = title; };
  }, []);
  return <main className="recovery-screen" aria-labelledby="not-found-title">
    <section className="recovery-card not-found-card">
      <span className="startup-kicker">ASTRIX · Mission Studio</span>
      <div className="not-found-orbit" aria-hidden="true"><span>404</span></div>
      <h1 id="not-found-title" ref={heading} tabIndex={-1}>{t('recovery.notFoundTitle')}</h1>
      <p>{t('recovery.notFoundBody')}</p>
      <div className="button-wrap"><button className="button primary" onClick={onHome}>{t('recovery.home')}</button></div>
      <details><summary>{t('recovery.address')}</summary><code>{location.pathname}{location.hash}</code></details>
    </section>
  </main>;
}
