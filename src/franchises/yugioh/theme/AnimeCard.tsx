import type { CSSProperties } from 'react';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { attributeIcon, numericCardValue, type HiddenCardStat } from './animeCards';
import { classFrame } from './gamePresentation';
import styles from './AnimeCard.module.scss';

export interface AnimeCardProps {
  readonly card: Entity;
  readonly hidden?: HiddenCardStat;
}

/** Archivo del marco (public/theme/yugioh/cartas-anime/) de cada clase de carta. */
const FRAME_FILES: Readonly<Record<string, string>> = {
  normal: 'normal', effect: 'effect', fusion: 'fusion', ritual: 'ritual', synchro: 'syncro',
  xyz: 'xyz', pendulum: 'pendulum', link: 'link', spell: 'magic', trap: 'trap',
};

/**
 * Carta del anime: el marco que aportó el usuario, sin retocar, con la ilustración debajo de su ventana y los datos
 * encima, en el lugar de la plantilla. La métrica oculta nunca se escribe en el DOM ni en su nombre accesible.
 */
export function AnimeCard({ card, hidden }: AnimeCardProps) {
  const frame = classFrame(String(card.attrs.clase ?? ''));
  const spellOrTrap = frame === 'spell' || frame === 'trap';
  const link = frame === 'link';
  const attribute = attributeIcon(card.attrs.atributo);
  const value = (key: HiddenCardStat) => hidden === key ? es.yugiohAnime.hidden : numericCardValue(card.attrs[key]);
  const label = es.yugiohAnime.cardLabel(card.name.es, String(card.attrs.clase ?? es.yugiohAnime.unknown), String(card.attrs.atributo ?? es.yugiohAnime.unknown),
    spellOrTrap ? '' : es.yugiohAnime.statsLabel(value('nivel'), value('atk'), value('def')));
  const level = typeof card.attrs.nivel === 'number' ? Math.min(12, Math.max(0, Math.floor(card.attrs.nivel))) : 0;
  const stat = (key: 'atk' | 'def') => hidden === key ? es.yugiohAnime.unknown : numericCardValue(card.attrs[key]);
  return <span className={styles.card} data-anime-card data-anime-frame={frame} role="img" aria-label={label}>
    <span className={styles.art} data-anime-art aria-hidden="true">
      {card.image && <img src={`/img/${card.image}-512.webp`} srcSet={`/img/${card.image}-256.webp 256w, /img/${card.image}-512.webp 512w`} sizes="(min-width: 48rem) 22rem, 17rem" width={512} height={512} alt="" loading="lazy" decoding="async" draggable={false} data-full-card={card.image.includes('/cards-full/')} />}
    </span>
    <img className={styles.frame} src={`/theme/yugioh/cartas-anime/${FRAME_FILES[frame] ?? 'normal'}.webp`} width={399} height={583} alt="" aria-hidden="true" decoding="async" draggable={false} />
    {!spellOrTrap && <span className={styles.data} aria-hidden="true">
      {!link && (hidden === 'nivel' || level === 0
        ? <span className={styles.question} data-anime-stat="nivel" data-hidden={hidden === 'nivel'}>{es.yugiohAnime.unknown}</span>
        : <img className={styles.level} src={`/theme/yugioh/cartas-anime/niveles/nivel-${String(level).padStart(2, '0')}.webp`} style={{ '--anime-level': level } as CSSProperties} width={53 * level} height={47} alt="" decoding="async" draggable={false} data-anime-stat="nivel" data-level={level} />)}
      {attribute && <img className={styles.attribute} src={attribute} width={128} height={128} alt="" decoding="async" draggable={false} />}
      {(['atk', 'def'] as const).map((key) => (link && key === 'def')
        ? <span className={styles.stat} key={key} data-anime-stat={key} data-slot="rating" data-hidden={false}>{numericCardValue(card.attrs.nivel)}</span>
        : <span className={styles.stat} key={key} data-anime-stat={key} data-slot={key} data-hidden={hidden === key}>{stat(key)}</span>)}
    </span>}
  </span>;
}
