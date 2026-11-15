import { useEffect, useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { LinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

interface LoadedTexture { file: string; texture: Texture; bitmap: ImageBitmap }
interface TextureEntry {
 users: number;
 controller: AbortController;
 promise: Promise<LoadedTexture>;
 loaded?: LoadedTexture;
}
const textures = new Map<string, TextureEntry>();

/** Actual shared RGBA allocations, excluding released entries; mipmaps are never generated.
 * HIGH Earth: packed day/night 32 MiB + celestial sky 32 MiB = 64 MiB.
 * LOW Earth: historical day 2 MiB + celestial sky 2 MiB = 4 MiB.
 */
export function getSpaceTextureBytes(): number {
 let bytes = 0;
 for (const entry of textures.values()) {
  if (entry.loaded) bytes += entry.loaded.bitmap.width * entry.loaded.bitmap.height * 4;
 }
 return bytes;
}

function acquireTexture(file: string) {
 let entry = textures.get(file);
 if (!entry) {
  const controller = new AbortController();
  const promise = (async (): Promise<LoadedTexture> => {
   const response = await fetch(`${import.meta.env.BASE_URL}textures/${file}`, { signal: controller.signal });
   if (!response.ok) throw new Error(`Texture unavailable: ${file} (${response.status})`);
   // Night-light luminance occupies the Earth image's alpha channel. Never premultiply
   // that data into its day RGB, including completely dark (alpha-zero) ocean pixels.
   const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'flipY',
   });
   if (controller.signal.aborted) { bitmap.close(); throw new DOMException('Texture released', 'AbortError'); }
   const texture = new Texture(bitmap);
   texture.name = file;
   texture.colorSpace = SRGBColorSpace;
   texture.flipY = false;
   texture.premultiplyAlpha = false;
   texture.wrapS = RepeatWrapping;
   texture.minFilter = LinearFilter;
   texture.magFilter = LinearFilter;
   texture.generateMipmaps = false;
   texture.needsUpdate = true;
   return { file, texture, bitmap };
  })();
  const created: TextureEntry = { users: 0, controller, promise };
  void promise.then(loaded => { created.loaded = loaded; }, () => {});
  textures.set(file, created);
  entry = created;
 }
 entry.users++;
 const current = entry;
 return {
  promise: current.promise,
  release() {
   current.users--;
   if (current.users !== 0) return;
   current.controller.abort();
   current.loaded?.texture.dispose();
   current.loaded?.bitmap.close();
   textures.delete(file);
  },
 };
}
/** Decorative imagery never suspends entry or rejects into the Canvas boundary.
 * A failed high-tier surface falls back to the existing low-tier historical map;
 * exhausted imagery leaves the original procedural sky or plain planet visible.
 */
/** `null` means this component requests no authored image; its caller owns the untextured display. */
export function useSpaceTexture(file: string | null, fallback?: string): LoadedTexture | null {
 const invalidate = useThree(state => state.invalidate);
 const requestKey = `${file}|${fallback ?? ''}`;
 const [result, setResult] = useState<{ key: string; loaded: LoadedTexture } | null>(null);
 // Custom planet/sky uniforms keep stable objects. In demand mode, draw only after
 // React commits the decoded image into those uniforms, not before that commit.
 useLayoutEffect(() => {
  if (result?.key === requestKey) invalidate();
 }, [result, requestKey, invalidate]);
 useEffect(() => {
  let active = true;
  let release: (() => void) | undefined;
  if (file === null) return;
  const load = async () => {
   for (const candidate of fallback && fallback !== file ? [file, fallback] : [file]) {
    if (!active) return;
    const acquired = acquireTexture(candidate);
    release = acquired.release;
    try {
     const loaded = await acquired.promise;
     if (active) setResult({ key: requestKey, loaded });
     return;
    } catch {
     // Cleanup may already have released an aborted request.
     if (!active) return;
     acquired.release();
     release = undefined;
    }
   }
   if (active) {
    window.dispatchEvent(new CustomEvent(file.startsWith('starmap') ? 'astrix-sky-error' : 'astrix-surface-error', { detail: file }));
    invalidate();
   }
  };
  void load();
  return () => { active = false; release?.(); };
 }, [file, fallback, requestKey, invalidate]);
 return result?.key === requestKey ? result.loaded : null;
}
