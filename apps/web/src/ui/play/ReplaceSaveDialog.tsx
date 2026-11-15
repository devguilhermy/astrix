import { Modal } from '../primitives';
import { RefreshCw, X } from 'lucide-react';
import { usePlayCopy } from './copy';

export function ReplaceSaveDialog({busy,onCancel,onConfirm}:{busy:boolean;onCancel:()=>void;onConfirm:()=>void}) {
  const c=usePlayCopy();
  return <Modal title={c('replaceTitle')} onClose={onCancel} className="play-confirmation"><p>{c('replaceSave')}</p><div className="play-confirmation-actions"><button className="button" onClick={onCancel}><X size={17} aria-hidden="true"/>{c('cancel')}</button><button className="button primary" onClick={onConfirm} disabled={busy}><RefreshCw size={17} aria-hidden="true"/>{c('confirmReplace')}</button></div></Modal>;
}
