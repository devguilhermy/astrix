// Adapted from Void Protocol (© Guilhermy), apps/web/src/components/ui/ApplicationErrorPanel.tsx @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import { useTranslation } from 'react-i18next';
import { AlertIcon } from '../icons';
export function ApplicationErrorPanel({error,renderer=false}:{error?:unknown;renderer?:boolean}){const{t}=useTranslation();return <section className="error-panel" role="alert"><AlertIcon size={24}/><h2>{t(renderer?'ui.webgl_failure.title':'ui.app_error.title')}</h2><p>{t(renderer?'ui.webgl_failure.body':'ui.app_error.body')}</p>{error!=null&&<details><summary>{t('ui.app_error.details')}</summary><pre>{error instanceof Error?error.message:String(error)}</pre></details>}{!renderer&&<button className="button" onClick={()=>window.location.reload()}>{t('ui.app_error.reload')}</button>}</section>;}
