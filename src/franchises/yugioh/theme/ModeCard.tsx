'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { es } from '@/i18n/es';
import type { ModeCardProps } from '../../types';
import { EgyptianModeIcon } from './ModeIcon';
import { CardFrame } from './CardFrame';
import { modeCard } from './modeCards';
import styles from './ModeCard.module.scss';

const copy = es.yugiohSkin;

export function DuelModeCard({ slug, name, href, state, label: gridLabel, index }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const card = modeCard(slug);
  const text = Object.hasOwn(copy.modes, slug) ? copy.modes[slug as keyof typeof copy.modes] : copy.fallback;
  const solved = state === 'solved';
  const label = index === 0 ? copy.primaryLabel(gridLabel) : gridLabel;
  const magic = card.frame === 'spell' || card.frame === 'trap';
  const level = magic ? copy.cardClass[card.frame as 'spell' | 'trap'] : card.frame !== 'link' && [0, 1, 2, 3].map((star) => <svg key={star} viewBox="0 0 24 24" focusable="false"><path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z" /></svg>);
  return <Link href={href} className={styles.card} data-card="duel" data-mode={slug} data-primary={index === 0}
    data-state={state} aria-label={label} onClick={(event) => leaveTo(event, href)}>
    <CardFrame frame={card.frame} primary={index === 0} name={name} level={level}
      illustration={<EgyptianModeIcon kind={card.icon} />}
      holo={solved && <span className={styles.holo} data-duel-holo />}
      stamp={solved && <span className={styles.stamp} data-solved-seal aria-hidden="true"><span className={styles.sealGlyph} data-seal-glyph="14" aria-hidden="true" /></span>}
      scales={<><span className={styles.blueScale}>{copy.scaleBlue}</span><span>{copy.pendulumInscription}</span><span className={styles.redScale}>{copy.scaleRed}</span></>}
      copy={<><strong>[{text.type}]</strong><span data-card-description>{text.description}</span></>}
      status={<><span className={styles.smallSeal} data-visible={solved} aria-hidden="true">{solved && <span className={styles.sealGlyph} data-seal-glyph="14" aria-hidden="true" />}</span><span>{state === 'unknown' ? null : solved ? copy.solved : copy.pending}</span></>}
    />
  </Link>;
}
