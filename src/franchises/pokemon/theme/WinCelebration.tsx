'use client';

import { useEffect, useState } from 'react';
import { loadFranchiseData } from '@/franchises/data';
import { es } from '@/i18n/es';
import type { WinCelebrationProps } from '../../types';
import styles from './WinCelebration.module.scss';

/** Las seis estadísticas base, en el orden de la Pokédex (claves de `Entity.attrs`). */
const STATS = ['ps', 'ataque', 'defensa', 'ataqueEspecial', 'defensaEspecial', 'velocidad'] as const;
type StatKey = (typeof STATS)[number];

/** El valor más alto que puede tener una estadística base: la barra llena. */
const STAT_MAX = 255;

/** Nivel de la barra, como en la Pokédex: baja, media o alta. */
function levelOf(value: number): 'low' | 'mid' | 'high' {
  return value < 60 ? 'low' : value < 90 ? 'mid' : 'high';
}

/**
 * Festejo de Pokémon al ganar (slot `WinCelebration`). Sobre la imagen (`media`): un destello pixel corto
 * alrededor del Pokémon, quieto con movimiento reducido. Debajo del resumen (`details`): sus seis
 * estadísticas base como barras horizontales, estilo Pokédex. Las estadísticas salen de los datos de la
 * franquicia (la respuesta se reconoce por su imagen).
 */
export function PokemonWinCelebration({ part, imageStem }: WinCelebrationProps) {
  if (part === 'media') return <span className={styles.sparkle} aria-hidden="true" />;
  return imageStem ? <BaseStats imageStem={imageStem} /> : null;
}

function BaseStats({ imageStem }: { imageStem: string }) {
  const [stats, setStats] = useState<Array<{ key: StatKey; value: number }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadFranchiseData('pokemon').then((data) => {
      const entity = data?.entities.find((candidate) => candidate.image === imageStem);
      if (cancelled || !entity) return;
      const values = STATS.flatMap((key) => {
        const value = entity.attrs[key];
        return typeof value === 'number' ? [{ key, value }] : [];
      });
      if (values.length === STATS.length) setStats(values);
    });
    return () => {
      cancelled = true;
    };
  }, [imageStem]);

  if (stats === null) return null;
  return (
    <section className={styles.stats} aria-label={es.pokemonSkin.statsTitle}>
      <h3 className={styles.statsTitle}>{es.pokemonSkin.statsTitle}</h3>
      <dl className={styles.list}>
        {stats.map(({ key, value }) => (
          <div key={key} className={styles.row}>
            <dt className={styles.label}>{es.pokemonSkin.stats[key]}</dt>
            <dd className={styles.value}>
              <span className={styles.number}>{value}</span>
              {/* La barra es proporcional al valor (decorativa: el número ya está escrito). */}
              <span className={styles.bar} aria-hidden="true" data-level={levelOf(value)}>
                <span className={styles.fill} style={{ transform: `scaleX(${Math.min(1, value / STAT_MAX)})` }} />
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
