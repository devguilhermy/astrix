import { createContext, useContext, type ComponentProps, type RefObject } from 'react';
import { Html } from '@react-three/drei';

/**
 * Stable DOM host for every in-scene label.
 *
 * drei's `Html` creates a React root in an element of its own and re-creates that root whenever its
 * target element changes. Without an explicit `portal` the target is `events.connected`, which is
 * only known after the Canvas has connected its events, so labels mounted in the first frame switch
 * target once. The old root is then unmounted while React is still rendering, which React defers;
 * the new root clears the shared element first, and the deferred unmount fails with
 * "Failed to execute 'removeChild' on 'Node'". A host that exists before the Canvas mounts keeps
 * the target constant, so the root is created exactly once per label.
 */
export const ScenePortalContext = createContext<RefObject<HTMLElement> | undefined>(undefined);

/** `Html` from drei, rendered into the scene's stable label host when one is provided. */
export function SceneHtml(props: ComponentProps<typeof Html>) {
  const portal = useContext(ScenePortalContext);
  return <Html portal={portal} {...props}/>;
}
