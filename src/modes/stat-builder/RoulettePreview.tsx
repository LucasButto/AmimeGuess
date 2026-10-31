'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Entity } from '@/engine/types';
import { previewPool } from './preview';

export const RouletteCandidates = createContext<readonly Entity[]>([]);
export const ROULETTE_IMAGE_SIZE = '15rem';
const images = new Map<string, Promise<boolean>>();

function load(stem: string): Promise<boolean> {
  const cached = images.get(stem);
  if (cached) return cached;
  const promise = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.fetchPriority = 'low';
    image.sizes = ROULETTE_IMAGE_SIZE;
    image.srcset = `/img/${stem}-256.webp 256w, /img/${stem}-512.webp 512w`;
    image.src = `/img/${stem}-512.webp`;
    image.decode().then(() => resolve(true), () => { images.delete(stem); resolve(false); });
  });
  images.set(stem, promise);
  return promise;
}

export function useRouletteImages(active: readonly string[]) {
  const candidates = useContext(RouletteCandidates);
  const selected = useMemo(() => previewPool(candidates, active), [candidates, active]);
  const [ready, setReady] = useState<readonly Entity[]>([]);
  useEffect(() => {
    let cancelled = false;
    // Each successful decode becomes usable immediately; slow/broken images never enter the reel.
    for (const entity of selected) {
      void load(entity.image!).then((ok) => {
        if (ok && !cancelled) setReady((previous) => previous.some((item) => item.id === entity.id) ? previous : [...previous, entity]);
      });
    }
    return () => { cancelled = true; };
  }, [selected]);
  return selected.filter((entity) => ready.some((item) => item.id === entity.id));
}
