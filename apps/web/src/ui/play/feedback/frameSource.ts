import type { BodyId } from '@astrix/core';

/**
 * Archive map per central body. Files are tried in order; the next one is used only
 * when the previous one fails to load. The packed day/night Earth file is never used:
 * its alpha channel holds night lights and cannot be read through a 2D canvas.
 */
export interface FrameSource {
  files: readonly string[];
  /** False for the Sun, which is drawn at full brightness with no day/night shading. */
  shaded: boolean;
  /** Copy key (without the `fb.` prefix) of the permanent simulated-frame caption. */
  captionKey: string;
}

export const FRAME_SOURCES: Readonly<Record<BodyId, FrameSource>> = {
  EARTH: { files: ['earth-blue-marble-2048.jpg', 'earth-blue-marble-1024.png'], shaded: true, captionKey: 'caption.EARTH' },
  MOON: { files: ['moon-lro-2048.jpg'], shaded: true, captionKey: 'caption.MOON' },
  MARS: { files: ['mars-viking-1024.jpg'], shaded: true, captionKey: 'caption.MARS' },
  SUN: { files: ['sun-stereo-sdo-304-1024.jpg'], shaded: false, captionKey: 'caption.SUN' },
};

/** Bundled texture URL under the deployment base path, as the scene textures are fetched. */
export function frameUrl(file: string): string {
  return `${import.meta.env?.BASE_URL ?? './'}textures/${file}`;
}
