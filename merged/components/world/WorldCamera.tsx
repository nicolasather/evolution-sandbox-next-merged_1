'use client';

import { useEffect } from 'react';
import { startCamera, stopCamera } from '@/lib/camera';

/* ============================================================================
   WORLD CAMERA — mounts `lib/camera.ts`'s shared breathe/lean/focus system for
   exactly as long as the sandbox is entered (ref-counted there, so this is
   safe to mount once here and nowhere else). Renders nothing: its only job is
   to start/stop the module that writes the `--cam-*` custom properties
   `app/_camera.css` reads on `#ground`/`#strata`.
   ========================================================================== */
export function WorldCamera({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    startCamera();
    return () => stopCamera();
  }, [active]);
  return null;
}
