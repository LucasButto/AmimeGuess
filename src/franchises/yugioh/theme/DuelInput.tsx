'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Autocomplete } from '@/components/Autocomplete';
import { es } from '@/i18n/es';
import type { GuessInputProps } from '../../types';
import styles from './DuelInput.module.scss';

export function DuelInput(props: GuessInputProps) {
  const root = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // Colocación antes del primer paint del tablero: la leyenda no cambia de sitio al verse.
    const target = root.current?.closest('[data-game-ready]')?.querySelector('ol:has(> li[data-revealed])')?.parentElement;
    if (target) setList(target);
  }, []);
  return <div ref={root} className={styles.root}>
    {list && createPortal(<p className={styles.chain} data-duel-chain-label>{es.yugiohGames.chain}</p>, list)}
    <Autocomplete {...props} />
  </div>;
}
