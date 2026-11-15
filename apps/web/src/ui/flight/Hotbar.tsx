import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Command } from '@astrix/core';
import { useMission } from '../../store';
import { CommandButton } from '../phases/FlightControls';
import { acceptsFlightKeys, PilotControls } from './PilotControls';
import { usePilot } from './pilotState';

export function Hotbar() {
 const { t } = useTranslation();
 const telemetry = useMission(state => state.telemetry);
 useEffect(() => {
  const keys = (event: KeyboardEvent) => {
   if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || !acceptsFlightKeys(event.target)) return;
   const state = useMission.getState(), current = state.telemetry;
   if (state.activeStage !== 'IMPLEMENT' || !current || current.ended || state.pendingDecisions.length || state.explanation || state.handoff || state.pauseReasons.some(reason => ['home', 'chooser', 'settings', 'tour', 'graphics', 'viewer'].includes(reason))) return;
   const key = event.key.toLowerCase();
   if (key === 'p') {
    event.preventDefault();
    if (state.warp > 10) state.setWarp(10);
    if (useMission.getState().warp <= 10) usePilot.getState().setEnabled(state.warp > 10 || !usePilot.getState().enabled);
    return;
   }
   // Pilot D/S are yaw/pitch; discrete downlink/safe shortcuts resume on exit.
   if (usePilot.getState().enabled && (key === 'd' || key === 's')) return;
   const command: Command | null = key === '1' ? { kind: 'POINT', mode: 'SUN' } : key === '2' ? { kind: 'POINT', mode: 'TARGET' } : key === '3' ? { kind: 'POINT', mode: 'EARTH' } : key === 'd' ? { kind: 'DOWNLINK', on: !current.downlinkRequested } : key === 's' ? { kind: 'SAFE', on: !current.safe } : key === 'g' ? deploymentCommand(current.deployment) : null;
   if (command) { event.preventDefault(); state.command(command); }
  };
  window.addEventListener('keydown', keys);
  return () => { window.removeEventListener('keydown', keys); };
 }, []);
 if (!telemetry) return null;
 const commands: readonly { shortcut: string; key: string; command: Command }[] = [
  { shortcut: '1', key: 'sun', command: { kind: 'POINT', mode: 'SUN' } },
  { shortcut: '2', key: 'target', command: { kind: 'POINT', mode: 'TARGET' } },
  { shortcut: '3', key: 'earth', command: { kind: 'POINT', mode: 'EARTH' } },
  { shortcut: 'D', key: 'downlink', command: { kind: 'DOWNLINK', on: !telemetry.downlinkRequested } },
  { shortcut: 'S', key: 'safe', command: { kind: 'SAFE', on: !telemetry.safe } },
 ];
 const deploy = deploymentCommand(telemetry.deployment);
 return <div className="flight-hotbar" data-cue-target="hotbar" role="group" aria-label={t('flight.deck')}>
  {commands.map(item => <div className="hotbar-item" key={item.key} tabIndex={0} role="group" aria-label={t(`flight.${item.key}`)}><kbd aria-hidden="true">{item.shortcut}</kbd><CommandButton command={item.command} label={t(`flight.${item.key}`)}/></div>)}
  {deploy && <div className="hotbar-item" tabIndex={0} role="group" aria-label={t('flight.deploy')}><kbd aria-hidden="true">G</kbd><CommandButton command={deploy} label={t('flight.deploy')}/></div>}
  <PilotControls/>
 </div>;
}
function deploymentCommand(deployment: { wings: string; antenna: string }): Command | null {
 const system = deployment.wings === 'STOWED' || deployment.wings === 'ANOMALOUS' ? 'WINGS' : deployment.antenna === 'STOWED' || deployment.antenna === 'ANOMALOUS' ? 'ANTENNA' : null;
 if (!system) return null;
 return { kind: (system === 'WINGS' ? deployment.wings : deployment.antenna) === 'ANOMALOUS' ? 'DEPLOY_RETRY' : 'DEPLOY', system };
}
