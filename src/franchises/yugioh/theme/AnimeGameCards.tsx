'use client';

import { useEffect, useState } from 'react';
import type { Entity } from '@/engine/types';
import type { ComparisonMediaProps, RevealListItemProps } from '../../types';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import { AnimeCard } from './AnimeCard';
import { cardNameKey, loadAnimeCards, numericCardValue, type HiddenCardStat } from './animeCards';
import { CardBack } from './CardBack';
import styles from './AnimeGameCards.module.scss';

export function AnimeComparisonMedia({ entity, metric, revealed }: ComparisonMediaProps) {
  const hidden: HiddenCardStat | undefined = !revealed && (metric === 'nivel' || metric === 'atk' || metric === 'def') ? metric : undefined;
  const label = metric === 'nivel' || metric === 'atk' || metric === 'def' ? es.yugiohGames.metrics[metric] : metric;
  return <span className={styles.comparison} data-anime-comparison data-anime-metric={metric}>
    <AnimeCard card={entity} hidden={hidden} />
    <span className={styles.choice} data-anime-choice aria-hidden="true">{es.higherLower.picked}</span>
    {revealed && <VisuallyHidden data-anime-comparison-summary>
      {es.yugiohAnime.comparedValue(label, numericCardValue(entity.attrs[metric]))}
      <span className={styles.lesser} data-anime-comparison-lower>{' '}{es.yugiohAnime.lesser}</span>
    </VisuallyHidden>}
  </span>;
}

export function AnimeChainItem({ text, revealed, position }: RevealListItemProps) {
  const [match, setMatch] = useState<{ text: string; card: Entity } | null>(null);
  useEffect(() => {
    if (!revealed || !text) return;
    let active = true;
    loadAnimeCards().then((index) => {
      const card = index.get(cardNameKey(text));
      if (active && card) setMatch({ text, card });
    }).catch(() => { /* El nombre revelado permanece visible si no se pudo cargar el catálogo. */ });
    return () => { active = false; };
  }, [text, revealed]);
  const card = revealed && match && match.text === text ? match.card : undefined;
  return <span className={styles.chain} data-anime-chain>
    <span className={styles.position} data-anime-chain-position>{es.yugiohAnime.chain(position)}</span>
    <span className={styles.name} aria-hidden={!revealed || card ? true : undefined}>{revealed ? text : es.yugiohAnime.concealed}</span>
    <span className={styles.holder}>
      {card ? <AnimeCard card={card} /> : revealed
        ? <span className={styles.fallback} aria-hidden="true">{es.yugiohAnime.unknown}</span>
        : <span className={styles.back} aria-label={es.yugiohAnime.hiddenCard} role="img"><CardBack /></span>}
    </span>
  </span>;
}
