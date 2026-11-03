'use client';

import { TabPage } from '@/components/tabbar/TabPage';
import { useSiteStats } from '@/components/useSiteProgress';
import { es } from '@/i18n/es';
import styles from './GlobalStats.module.scss';

interface GlobalStatsProps {
  franchises: ReadonlyArray<{ slug: string; name: string; modes: readonly string[] }>;
}

/** La racha de todo el sitio (días seguidos con algún reto ganado) y las partidas jugadas y ganadas, en total y por franquicia. */
export function GlobalStats({ franchises }: GlobalStatsProps) {
  const stats = useSiteStats(franchises.map(({ slug, modes }) => ({ slug, modes })));
  const { globalStats: text } = es;
  const played = stats?.totals.played ?? 0;
  const won = stats?.totals.won ?? 0;

  return (
    <TabPage tab="stats" title={text.title} lead={stats === null ? text.loading : played === 0 ? text.empty : undefined}>
      {stats !== null && (
        <>
          <section className={styles.streak} aria-labelledby="racha-global">
            <h2 id="racha-global" className={styles.streakLabel}>{text.streak}</h2>
            <p className={styles.streakValue}>{text.days(stats.streak)}</p>
            <p className={styles.streakHint}>{text.streakHint}</p>
            <p className={styles.streakBest}>{text.bestStreak}: {text.days(stats.bestStreak)}</p>
          </section>

          <dl className={styles.totals}>
            <div className={styles.total}>
              <dt>{text.played}</dt>
              <dd>{played}</dd>
            </div>
            <div className={styles.total}>
              <dt>{text.won}</dt>
              <dd>{won}</dd>
            </div>
            <div className={styles.total}>
              <dt>{text.winRate}</dt>
              <dd>{text.rate(won, played)}</dd>
            </div>
          </dl>

          <section aria-labelledby="por-franquicia">
            <h2 id="por-franquicia" className={styles.sectionTitle}>{text.byFranchise}</h2>
            <ul className={styles.franchises}>
              {stats.totals.franchises.map((franchise) => (
                <li key={franchise.slug} className={styles.franchise}>
                  <strong>{franchises.find((candidate) => candidate.slug === franchise.slug)?.name ?? franchise.slug}</strong>
                  <span>{text.franchiseLine(franchise.won, franchise.played)}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className={styles.note}>{text.note}</p>
        </>
      )}
    </TabPage>
  );
}
