import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertIcon } from '../icons';
import './recovery.css';

type Scope = 'application' | 'layout' | 'panel';
interface Props {
  children: ReactNode;
  scope?: Scope;
  onError?(error: unknown): void;
  onRetry?(): void;
}
interface State { failed: boolean; error?: unknown }

function ErrorSurface({ error, scope, retry }: { error: unknown; scope: Scope; retry(): void }) {
  const { t } = useTranslation();
  const card = <section className="recovery-card error-surface" role="alert">
    <span className="startup-kicker">ASTRIX · {scope === 'application' ? '500' : '!'}</span>
    <h2><AlertIcon size={24}/>{t(`recovery.${scope}Title`)}</h2>
    <p>{t(`recovery.${scope}Body`)}</p>
    <details><summary>{t('recovery.details')}</summary><pre>{error instanceof Error ? error.message : String(error)}</pre></details>
    <div className="button-wrap">
      <button className="button primary" onClick={scope === 'application' ? () => location.reload() : retry}>
        {t(scope === 'application' ? 'recovery.reload' : 'recovery.retry')}
      </button>
      {scope === 'application' && <a className="button" href="./docs/INDEX.md">{t('recovery.docs')}</a>}
    </div>
  </section>;
  return scope === 'application' ? <main className="recovery-screen">{card}</main> : card;
}

/** Local failures do not tear down the persistent Canvas or discard the attempt. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(error: unknown): State { return { failed: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ASTRIX render boundary', error, info.componentStack);
    this.props.onError?.(error);
  }
  retry = () => {
    this.props.onRetry?.();
    this.setState({ failed: false, error: undefined });
  };
  render() {
    return this.state.failed
      ? <ErrorSurface scope={this.props.scope ?? 'panel'} error={this.state.error} retry={this.retry}/>
      : this.props.children;
  }
}
