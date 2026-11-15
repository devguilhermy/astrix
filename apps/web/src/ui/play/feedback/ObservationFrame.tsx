import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BodyId, TurnGameState } from '@astrix/core';
import type { TurnMoment } from '../turnMoments';
import { useFeedbackCopy } from './copy';
import { FRAME_SOURCES, frameUrl } from './frameSource';
import { frameBrightness, frameLight, frameWindow, sliceRects, type FrameWindow } from './frameWindow';
import { formatCoordinates, formatElapsed } from './format';
import './feedback.css';

const SIZES = { card: [640, 400], thumb: [192, 120] } as const;
const maps = new Map<BodyId, Promise<HTMLImageElement | null>>();

/** Loads the body's archive map once per page, trying each file in order; a total failure is retried on the next mount. */
function archiveMap(body: BodyId): Promise<HTMLImageElement | null> {
  let pending = maps.get(body);
  if (!pending) {
    pending = (async () => {
      for (const file of FRAME_SOURCES[body].files) {
        const { promise, resolve } = Promise.withResolvers<HTMLImageElement | null>(), candidate = new Image();
        candidate.decoding = 'async';
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => resolve(null);
        candidate.src = frameUrl(file);
        const image = await promise;
        if (image) return image;
      }
      return null;
    })();
    maps.set(body, pending);
    void pending.then(image => { if (!image) maps.delete(body); });
  }
  return pending;
}

function draw(canvas: HTMLCanvasElement, image: HTMLImageElement, window: FrameWindow, dim: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width, height = canvas.height;
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);
  for (const rect of sliceRects(window, image.naturalWidth, image.naturalHeight, width, height)) context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, Math.floor(rect.dx), rect.dy, Math.ceil(rect.dw), rect.dh);
  if (dim > 0) { context.fillStyle = `rgba(0,0,0,${dim})`; context.fillRect(0, 0, width, height); }
  const margin = width * .045, arm = width * .07;
  context.strokeStyle = '#ffb164';
  context.lineWidth = Math.max(2, width / 240);
  context.beginPath();
  for (const [x, y, dx, dy] of [[margin, margin, 1, 1], [width - margin, margin, -1, 1], [margin, height - margin, 1, -1], [width - margin, height - margin, -1, -1]] as const) {
    context.moveTo(x, y + dy * arm); context.lineTo(x, y); context.lineTo(x + dx * arm, y);
  }
  const cx = width / 2, cy = height / 2, reticle = width * .025;
  context.moveTo(cx - reticle, cy); context.lineTo(cx - reticle / 3, cy); context.moveTo(cx + reticle / 3, cy); context.lineTo(cx + reticle, cy);
  context.moveTo(cx, cy - reticle); context.lineTo(cx, cy - reticle / 3); context.moveTo(cx, cy + reticle / 3); context.lineTo(cx, cy + reticle);
  context.stroke();
}

/**
 * A simulated frame cut from a bundled NASA archive map around the ground point under
 * the spacecraft at the middle of the turn. Drawn on a 2D canvas, so it works when
 * the 3D view has failed. Never presented as a new observation.
 */
export function ObservationFrame({ game, moment, size = 'card' }: { game: TurnGameState; moment: TurnMoment; size?: 'card' | 'thumb' }) {
  const fc = useFeedbackCopy(), { i18n } = useTranslation(), locale = i18n.resolvedLanguage;
  const canvas = useRef<HTMLCanvasElement>(null), [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const frame = moment.frame, body = moment.body, source = FRAME_SOURCES[body];
  const brightness = source.shaded && frame ? frameBrightness(frame.sunElevationDeg) : 1;
  useEffect(() => {
    if (!frame) return;
    let live = true;
    setStatus('loading');
    void archiveMap(body).then(image => {
      if (!live) return;
      if (!image || !canvas.current) { setStatus('missing'); return; }
      draw(canvas.current, image, frameWindow(frame, image.naturalWidth), 1 - brightness);
      setStatus('ready');
    });
    return () => { live = false; };
  }, [body, frame?.latDeg, frame?.lonDeg, brightness, size]);
  if (!frame) return null;
  const startedAt = game.receipts.filter(receipt => receipt.revision < moment.index).reduce((sum, receipt) => sum + receipt.elapsedSec, 0);
  const elapsed = `T+${formatElapsed(startedAt + (moment.endSec - moment.startSec) / 2, locale)}`;
  const coordinates = formatCoordinates(frame.latDeg, frame.lonDeg, locale);
  const light = source.shaded ? frameLight(frame.sunElevationDeg) : null;
  const data = `+${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(moment.capturedMB)} MB`;
  const caption = fc(source.captionKey), night = light === 'night' && moment.capturedMB > 0;
  const facts = [elapsed, coordinates, fc('camera', { body: fc(`body.${body}`) }), ...(light ? [fc(`light.${light}`)] : []), data];
  const [width, height] = SIZES[size];
  return <figure className={`fb-frame fb-frame-${size}`} title={size === 'thumb' ? caption : undefined}>
    <div className="fb-frame-view">
      <canvas ref={canvas} className="fb-frame-canvas" width={width} height={height} role="img" aria-label={`${fc('frameTitle')}: ${facts.join(', ')}. ${caption}${night ? ` ${fc('nightNote')}` : ''}`}/>
      {status !== 'ready' && <p className="fb-frame-status" role={status === 'missing' ? 'status' : undefined}>{fc(status === 'missing' ? 'frameUnavailable' : 'frameLoading')}</p>}
      {size === 'card' && <p className="fb-frame-meta" aria-hidden="true">{facts.join(' · ')}</p>}
    </div>
    <figcaption className="fb-frame-caption">{size === 'card' ? caption : fc('captionShort')}{size === 'card' && night && <span className="fb-frame-night"> {fc('nightNote')}</span>}</figcaption>
  </figure>;
}
