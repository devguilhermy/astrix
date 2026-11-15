import type { TurnPlanKind } from '@astrix/core';
import type { TurnMoment } from '../../ui/play/turnMoments';

const KIND: Readonly<Record<TurnPlanKind, readonly [string, string]>> = {
  LAUNCH: ['Launch', 'Lançar'], MANEUVER: ['Maneuver', 'Manobrar'], COAST: ['Coast', 'Aguardar'], OBSERVE: ['Observe', 'Observar'],
  TRANSMIT: ['Transmit', 'Transmitir'], RECHARGE: ['Recharge', 'Recarregar'], RECOVER: ['Recover', 'Recuperar'], CAPTURE: ['Capture', 'Capturar'],
  RETURN: ['Return', 'Retornar'], FINISH: ['Finish', 'Encerrar'], ABORT: ['Abort', 'Abortar'],
};

export function turnKindLabel(kind: TurnPlanKind, pt: boolean): string {
  return KIND[kind][pt ? 1 : 0];
}

/** "Turn 3: Transmit". */
export function turnName(moment: Pick<TurnMoment, 'index' | 'kind'>, pt: boolean): string {
  return `${pt ? 'Turno' : 'Turn'} ${moment.index}: ${turnKindLabel(moment.kind, pt)}`;
}

/** Transport announcement, "Replaying turn 3: Transmit". */
export function replayingText(moment: Pick<TurnMoment, 'index' | 'kind'>, pt: boolean): string {
  return pt ? `Reproduzindo o turno ${moment.index}: ${turnKindLabel(moment.kind, pt)}` : `Replaying turn ${moment.index}: ${turnKindLabel(moment.kind, pt)}`;
}

/** Text equivalent of the scene feedback for one turn. */
export function turnEventText(moment: TurnMoment, toStation: boolean, pt: boolean, format: Intl.NumberFormat): string {
  const parts = [turnName(moment, pt)];
  if (moment.capturedMB > 0) parts.push(pt ? `Observação: ${format.format(moment.capturedMB)} MB armazenados` : `Observation: ${format.format(moment.capturedMB)} MB stored`);
  if (moment.deliveredMB > 0) parts.push(pt
    ? `Sinal: ${format.format(moment.deliveredMB)} MB devolvidos ${toStation ? 'à estação terrestre' : 'à Terra'}`
    : `Signal: ${format.format(moment.deliveredMB)} MB returned ${toStation ? 'to the ground station' : 'to Earth'}`);
  if (moment.interrupted) parts.push(pt ? 'Interrompido' : 'Interrupted');
  return parts.join(' · ');
}

/** Mission elapsed time as `T+2 d 03:04:05`. */
export function missionClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(total / 86400), hours = Math.floor(total % 86400 / 3600), minutes = Math.floor(total % 3600 / 60), rest = total % 60;
  const clock = [hours, minutes, rest].map(value => String(value).padStart(2, '0')).join(':');
  return `T+${days ? `${days} d ` : ''}${clock}`;
}
