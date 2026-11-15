import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type JSX, type RefObject, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ChevronsDown, ChevronsUp, CircleHelp, Gamepad2, LocateFixed, LogOut, Minus, Move, Navigation, OctagonPause, Plus, Rocket, RotateCcw, RotateCw, ScanEye } from 'lucide-react';
import { SPEED_TIER_COUNT, exploreControls, type HoldControl } from './controls';
import { speedLimitFor } from './flightMath';
import { isHoldingClear, solarRadiusUnits, surfaceDistance } from './telemetry';
import type { ExploreBody, ExploreTelemetry } from './index';
import './explore.css';

interface HudProps { boarded: boolean; onBoard: () => void; onLeave: () => void; telemetry: ExploreTelemetry | null; bodies: readonly ExploreBody[]; target: string | null; onTarget: (id: string | null) => void; reducedMotion: boolean }

/** Outside <Canvas>, DOM overlay: board / leave button, HUD, on-screen flight controls, help. */
export function ExploreHud({ boarded, onBoard, onLeave, telemetry, bodies, target, onTarget, reducedMotion }: HudProps): JSX.Element {
  const { i18n } = useTranslation();
  const pt = !!i18n.resolvedLanguage?.startsWith('pt');
  const boardButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const wasBoarded = useRef(boarded);
  useEffect(() => {
    if (boarded && !wasBoarded.current) heading.current?.focus();
    if (!boarded && wasBoarded.current) boardButton.current?.focus();
    wasBoarded.current = boarded;
  }, [boarded]);
  if (!boarded) {
    return <div className="explore-hud" data-boarded="false" data-reduced-motion={reducedMotion}>
      <button ref={boardButton} type="button" className="explore-board" onClick={onBoard}>
        <Rocket size={18} aria-hidden="true"/>
        <span>{pt ? 'Embarcar na nave' : 'Board the ship'}</span>
      </button>
    </div>;
  }
  return <BoardedHud heading={heading} pt={pt} onLeave={onLeave} telemetry={telemetry} bodies={bodies} target={target} onTarget={onTarget} reducedMotion={reducedMotion}/>;
}

function BoardedHud({ heading, pt, onLeave, telemetry, bodies, target, onTarget, reducedMotion }: Omit<HudProps, 'boarded' | 'onBoard'> & { heading: RefObject<HTMLHeadingElement | null>; pt: boolean }) {
  const controls = useSyncExternalStore(exploreControls.subscribe, exploreControls.getSnapshot, exploreControls.getSnapshot);
  const helpId = useId();
  const titleId = useId();
  const locale = pt ? 'pt-BR' : 'en';
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 }), [locale]);
  const solar = solarRadiusUnits(bodies);
  const name = (body: ExploreBody | undefined) => body ? body.name[pt ? 'pt' : 'en'] : '';
  const targetBody = bodies.find(body => body.id === target);
  const nearestBody = telemetry?.nearest ? bodies.find(body => body.id === telemetry.nearest!.id) : undefined;
  const targetDistance = telemetry && targetBody ? Math.max(0, surfaceDistance(telemetry.position, targetBody)) : null;
  const holding = !!(telemetry?.nearest && nearestBody && isHoldingClear(telemetry.nearest.distance, nearestBody.radius));
  const solarUnit = (value: number) => `${number.format(value / solar)} R☉`;
  const limit = speedLimitFor(controls.speedTier);
  const announcement = useAnnouncement(pt, controls.autopilot, controls.camera, controls.dragMode, limit / solar, number, targetBody ? name(targetBody) : '', holding && nearestBody ? name(nearestBody) : '');

  return <section className="explore-hud" data-boarded="true" data-pad={controls.pad} data-reduced-motion={reducedMotion} aria-labelledby={titleId}
    onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="explore-panel">
      <div className="explore-panel-head">
        <h2 id={titleId} ref={heading} tabIndex={-1}><Rocket size={16} aria-hidden="true"/>{pt ? 'A bordo da nave' : 'Aboard the ship'}</h2>
        <button type="button" className="explore-leave" onClick={onLeave}><LogOut size={16} aria-hidden="true"/><span>{pt ? 'Sair da nave' : 'Leave ship'}</span></button>
      </div>
      <label className="explore-target">
        <span>{pt ? 'Alvo' : 'Target'}</span>
        <select value={target ?? ''} onChange={event => onTarget(event.target.value || null)}>
          <option value="">{pt ? 'Sem alvo' : 'No target'}</option>
          {bodies.map(body => <option key={body.id} value={body.id}>{name(body)}</option>)}
        </select>
      </label>
      <dl className="explore-readout">
        <div>
          <dt>{pt ? 'Até a superfície do alvo' : 'To target surface'}</dt>
          <dd>{targetDistance === null ? '—' : <>{solarUnit(targetDistance)} <small>{pt ? `${number.format(targetDistance / targetBody!.radius)} raios do alvo` : `${number.format(targetDistance / targetBody!.radius)} target radii`}</small></>}</dd>
        </div>
        <div>
          <dt>{pt ? 'Velocidade' : 'Speed'}</dt>
          <dd>{telemetry ? `${solarUnit(telemetry.speed)}/s` : '—'} <small>{pt ? `limite ${solarUnit(limit)}/s` : `limit ${solarUnit(limit)}/s`}</small></dd>
        </div>
        <div className="explore-readout-wide">
          <dt>{pt ? 'Corpo mais próximo' : 'Nearest body'}</dt>
          <dd>{telemetry?.nearest && nearestBody ? <>{name(nearestBody)} · {solarUnit(Math.max(0, telemetry.nearest.distance))}{holding && <small data-holding="true">{pt ? ' mantendo distância da superfície' : ' holding clear of the surface'}</small>}</> : '—'}</dd>
        </div>
      </dl>
      <div className="explore-tools" role="group" aria-label={pt ? 'Comandos de voo' : 'Flight commands'}>
        <button type="button" aria-pressed={controls.autopilot === 'engaged'} disabled={!targetBody} onClick={() => exploreControls.command('autopilot')}
          title={targetBody ? undefined : pt ? 'Escolha um alvo primeiro' : 'Choose a target first'}>
          <Navigation size={16} aria-hidden="true"/><span>{pt ? 'Piloto automático' : 'Autopilot'}</span>
        </button>
        <div className="explore-speed" role="group" aria-label={pt ? 'Limite de velocidade' : 'Speed limit'}>
          <button type="button" aria-label={pt ? 'Reduzir limite de velocidade' : 'Lower speed limit'} disabled={controls.speedTier <= 0} onClick={() => exploreControls.command('speedDown')}><Minus size={16} aria-hidden="true"/></button>
          <span className="explore-speed-level" aria-hidden="true">{controls.speedTier + 1}/{SPEED_TIER_COUNT}</span>
          <button type="button" aria-label={pt ? 'Aumentar limite de velocidade' : 'Raise speed limit'} disabled={controls.speedTier >= SPEED_TIER_COUNT - 1} onClick={() => exploreControls.command('speedUp')}><Plus size={16} aria-hidden="true"/></button>
        </div>
        <button type="button" aria-pressed={controls.camera === 'cockpit'} onClick={() => exploreControls.command('camera')}>
          <Camera size={16} aria-hidden="true"/><span>{pt ? 'Cabine' : 'Cockpit'}</span>
        </button>
        <button type="button" aria-pressed={controls.dragMode === 'steer'} onClick={() => exploreControls.command('dragMode')}>
          <Move size={16} aria-hidden="true"/><span>{pt ? 'Arrastar pilota' : 'Drag steers'}</span>
        </button>
        <button type="button" onClick={() => exploreControls.command('recenter')}>
          <LocateFixed size={16} aria-hidden="true"/><span>{pt ? 'Centralizar vista' : 'Recenter view'}</span>
        </button>
        <button type="button" aria-pressed={controls.pad} onClick={() => exploreControls.command('pad')}>
          <Gamepad2 size={16} aria-hidden="true"/><span>{pt ? 'Controles na tela' : 'On-screen controls'}</span>
        </button>
        <button type="button" aria-expanded={controls.help} aria-controls={helpId} onClick={() => exploreControls.command('help')}>
          <CircleHelp size={16} aria-hidden="true"/><span>{pt ? 'Ajuda' : 'Help'}</span>
        </button>
      </div>
      <p className="explore-note">{pt
        ? 'Voo esquemático: tamanhos em escala com o Sol (R☉ = raio solar), distâncias comprimidas, nave ampliada. O tempo da missão não avança.'
        : 'Schematic flight: sizes to scale with the Sun (R☉ = solar radius), distances compressed, ship enlarged. Mission time does not advance.'}</p>
      <p className="explore-announce" role="status" aria-live="polite">{announcement}</p>
    </div>
    <div id={helpId} className="explore-help" hidden={!controls.help}>
      <h3>{pt ? 'Como pilotar' : 'How to fly'}</h3>
      <dl>
        <HelpRow keys="W / S">{pt ? 'acelerar para frente / ré' : 'thrust forward / reverse'}</HelpRow>
        <HelpRow keys="A / D, ← / →">{pt ? 'virar à esquerda / direita' : 'turn left / right'}</HelpRow>
        <HelpRow keys="↑ / ↓">{pt ? 'levantar / baixar o nariz' : 'nose up / down'}</HelpRow>
        <HelpRow keys="Q / E">{pt ? 'girar sobre o eixo' : 'roll'}</HelpRow>
        <HelpRow keys={pt ? 'Espaço' : 'Space'}>{pt ? 'frear' : 'brake'}</HelpRow>
        <HelpRow keys="− / +">{pt ? 'limite de velocidade' : 'speed limit'}</HelpRow>
        <HelpRow keys="P">{pt ? 'piloto automático até o alvo; Esc desliga' : 'autopilot to the target; Esc turns it off'}</HelpRow>
        <HelpRow keys="C">{pt ? 'câmera de perseguição / cabine' : 'chase / cockpit camera'}</HelpRow>
        <HelpRow keys={pt ? 'Arrastar' : 'Drag'}>{pt ? 'olhar ao redor; L faz o arraste pilotar' : 'look around; L makes dragging steer'}</HelpRow>
        <HelpRow keys="R">{pt ? 'centralizar a vista' : 'recenter the view'}</HelpRow>
        <HelpRow keys="H">{pt ? 'esta ajuda' : 'this help'}</HelpRow>
      </dl>
      <p>{pt
        ? 'No toque: use o direcional para virar e segure os botões para acelerar, dar ré, frear e girar. A nave desacelera perto dos corpos e nunca entra neles.'
        : 'On touch: use the pad to turn and hold the buttons to thrust, reverse, brake and roll. The ship slows near bodies and never enters them.'}</p>
    </div>
    {controls.pad && <div className="explore-pad" role="group" aria-label={pt ? 'Controles de voo na tela' : 'On-screen flight controls'}>
      <SteerPad label={pt ? 'Direção' : 'Steer'}/>
      <div className="explore-pad-buttons">
        <HoldButton control="rollLeft" label={pt ? 'Girar à esquerda' : 'Roll left'}><RotateCcw size={20} aria-hidden="true"/></HoldButton>
        <HoldButton control="thrust" label={pt ? 'Acelerar' : 'Thrust'} primary><ChevronsUp size={22} aria-hidden="true"/></HoldButton>
        <HoldButton control="rollRight" label={pt ? 'Girar à direita' : 'Roll right'}><RotateCw size={20} aria-hidden="true"/></HoldButton>
        <HoldButton control="brake" label={pt ? 'Frear' : 'Brake'}><OctagonPause size={20} aria-hidden="true"/></HoldButton>
        <HoldButton control="reverse" label={pt ? 'Ré' : 'Reverse'}><ChevronsDown size={22} aria-hidden="true"/></HoldButton>
        <button type="button" className="explore-pad-look" aria-pressed={controls.dragMode === 'steer'} onClick={() => exploreControls.command('dragMode')}>
          <ScanEye size={20} aria-hidden="true"/><span>{controls.dragMode === 'steer' ? pt ? 'Arraste pilota' : 'Drag steers' : pt ? 'Arraste olha' : 'Drag looks'}</span>
        </button>
      </div>
    </div>}
  </section>;
}

function HelpRow({ keys, children }: { keys: string; children: ReactNode }) {
  return <div><dt><kbd>{keys}</kbd></dt><dd>{children}</dd></div>;
}

/** Press-and-hold flight button for pointer and keyboard (Space or Enter held on the focused button). */
function HoldButton({ control, label, primary = false, children }: { control: HoldControl; label: string; primary?: boolean; children: ReactNode }) {
  const id = useId();
  const [pressed, setPressed] = useState(false);
  const pointerSource = `pad:${id}`, keySource = `button:${id}`;
  useEffect(() => () => { exploreControls.release(pointerSource); exploreControls.release(keySource); }, [pointerSource, keySource]);
  const start = (source: string) => { exploreControls.press(source, control); setPressed(true); };
  const stop = (source: string) => { exploreControls.release(source); setPressed(false); };
  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start(pointerSource);
  };
  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); start(keySource); }
  };
  const keyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop(keySource); }
  };
  return <button type="button" className="explore-hold" data-primary={primary} data-pressed={pressed} aria-label={label}
    onPointerDown={pointerDown} onPointerUp={() => stop(pointerSource)} onPointerCancel={() => stop(pointerSource)} onLostPointerCapture={() => stop(pointerSource)}
    onKeyDown={keyDown} onKeyUp={keyUp} onBlur={() => { stop(keySource); }} onContextMenu={event => event.preventDefault()}>
    {children}
  </button>;
}

/** Analog steering pad: drag the knob; right turns right, up raises the nose. Keyboard users have the arrow keys. */
function SteerPad({ label }: { label: string }) {
  const pad = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState<readonly [number, number]>([0, 0]);
  useEffect(() => () => exploreControls.setStick(0, 0), []);
  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = pad.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const radius = rect.width / 2;
    let x = (event.clientX - rect.left - radius) / radius, y = -(event.clientY - rect.top - radius) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    setKnob([x, y]);
    exploreControls.setStick(x, y);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current) return;
    pointer.current = null;
    setKnob([0, 0]);
    exploreControls.setStick(0, 0);
  };
  return <div className="explore-steer">
    <div ref={pad} className="explore-stick" aria-hidden="true" data-active={knob[0] !== 0 || knob[1] !== 0}
      onPointerDown={event => {
        if (pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={event => { if (event.pointerId === pointer.current) update(event); }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onContextMenu={event => event.preventDefault()}>
      <span className="explore-stick-knob" style={{ '--explore-x': knob[0], '--explore-y': knob[1] } as CSSProperties}/>
    </div>
    <span className="explore-steer-label" aria-hidden="true">{label}</span>
  </div>;
}

/** Polite announcements for discrete flight events; numbers that change every frame are never announced. */
function useAnnouncement(pt: boolean, autopilot: string, camera: string, dragMode: string, limitSolar: number, number: Intl.NumberFormat, targetName: string, holdingName: string): string {
  const [message, setMessage] = useState(pt ? 'A bordo. Use as teclas, o arraste ou os controles na tela para voar.' : 'Aboard. Fly with the keys, by dragging or with the on-screen controls.');
  const previous = useRef({ autopilot, camera, dragMode, limitSolar, holdingName });
  useEffect(() => {
    const before = previous.current;
    previous.current = { autopilot, camera, dragMode, limitSolar, holdingName };
    if (autopilot !== before.autopilot) {
      if (autopilot === 'engaged') setMessage(pt ? `Piloto automático: voando até ${targetName}.` : `Autopilot: flying to ${targetName}.`);
      else if (autopilot === 'arrived') setMessage(pt ? `Chegada perto de ${targetName}. Piloto automático desligado.` : `Arrived near ${targetName}. Autopilot off.`);
      else setMessage(pt ? 'Piloto automático desligado. Controle manual.' : 'Autopilot off. Manual control.');
    } else if (camera !== before.camera) setMessage(camera === 'cockpit' ? pt ? 'Vista da cabine.' : 'Cockpit view.' : pt ? 'Vista de perseguição.' : 'Chase view.');
    else if (dragMode !== before.dragMode) setMessage(dragMode === 'steer' ? pt ? 'Arrastar agora pilota a nave.' : 'Dragging now steers the ship.' : pt ? 'Arrastar agora olha ao redor.' : 'Dragging now looks around.');
    else if (limitSolar !== before.limitSolar) setMessage(pt ? `Limite de velocidade ${number.format(limitSolar)} R☉/s.` : `Speed limit ${number.format(limitSolar)} R☉/s.`);
    else if (holdingName && holdingName !== before.holdingName) setMessage(pt ? `Mantendo distância da superfície: ${holdingName}.` : `Holding clear of ${holdingName}.`);
  }, [pt, autopilot, camera, dragMode, limitSolar, holdingName, targetName, number]);
  return message;
}
