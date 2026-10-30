import type { SyntheticEvent } from 'react';
import type { AutocompleteItem } from '@/components/Autocomplete';
import { pokedexPortraitUrl } from './pokedexPortraitData';
import styles from './PokedexPortrait.module.scss';

function portraitFailed(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  const normal = image.dataset?.normal;
  if (normal && image.getAttribute('src') !== normal) {
    image.src = normal;
    if (image.parentElement) image.parentElement.dataset.emotion = 'normal';
    return;
  }
  image.hidden = true;
  if (image.parentElement) image.parentElement.dataset.fallback = 'true';
}

/** One native img, no per-cell hooks or SVG tree; failed/missing portraits use the shared CSS mask. */
export function PokedexPortrait({ item, tried = false, className = '' }: { item: Pick<AutocompleteItem, 'attrs'>; tried?: boolean; className?: string }) {
  const normal = pokedexPortraitUrl(item);
  const src = pokedexPortraitUrl(item, tried);
  return (
    <span className={`${styles.portrait} ${className}`} data-pmd-portrait="" data-tried={tried} data-emotion={src !== normal ? 'sad' : 'normal'} data-fallback={!src || undefined} aria-hidden="true">
      {src && <img className={styles.image} src={src} data-normal={src !== normal ? normal : undefined} alt="" width={40} height={40}
        loading="lazy" decoding="async" draggable={false} onError={portraitFailed} />}
    </span>
  );
}
