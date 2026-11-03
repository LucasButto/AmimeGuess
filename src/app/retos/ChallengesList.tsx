'use client';

import Link from 'next/link';
import { ModeStateTag, modeStateText } from '@/components/ModeStateTag';
import { TabPage } from '@/components/tabbar/TabPage';
import { useSiteProgress } from '@/components/useSiteProgress';
import { es } from '@/i18n/es';
import type { PlayableFranchise } from '../playable';
import styles from './ChallengesList.module.scss';

/** Los retos de hoy de todas las franquicias, agrupados por franquicia, cada uno con su estado (completado, fallado o pendiente). */
export function ChallengesList({ groups }: { groups: readonly PlayableFranchise[] }) {
  const progress = useSiteProgress(groups.map(({ slug, modes }) => ({ slug, modes: modes.map((mode) => mode.slug) })));
  const total = groups.reduce((sum, group) => sum + group.modes.length, 0);
  const solvedCount = progress === null ? 0 : [...progress.values()].reduce((sum, today) => sum + today.solved.size, 0);

  return (
    <TabPage tab="challenges" title={es.challenges.title} lead={<span aria-live="polite">{progress === null ? es.challenges.loading : es.challenges.summary(solvedCount, total)}</span>}>
      {groups.length === 0 ? (
        <p className={styles.empty}>{es.challenges.empty}</p>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => {
            const today = progress?.get(group.slug) ?? null;
            const solved = today?.solved.size ?? 0;
            return (
              <section key={group.slug} className={styles.group} data-franchise={group.slug} aria-label={today === null ? group.name : es.challenges.groupLabel(group.name, solved, group.modes.length)}>
                <h2 className={styles.groupTitle}>
                  <span>{group.name}</span>
                  <span className={styles.groupCount} aria-hidden="true">{today === null ? '' : es.challenges.group(solved, group.modes.length)}</span>
                </h2>
                <ul className={styles.rows}>
                  {group.modes.map((mode) => {
                    const state = today === null ? 'unknown' : today.lost.has(mode.slug) ? 'lost' : today.solved.has(mode.slug) ? 'won' : 'pending';
                    const stateText = modeStateText(state);
                    return (
                      <li key={mode.slug}>
                        <Link className={styles.row} href={`/${group.slug}/${mode.slug}`} data-state={state} aria-label={state === 'unknown' ? mode.name : `${mode.name}: ${stateText}`}>
                          <span className={styles.rowName}>{mode.name}</span>
                          {/* Antes de leer las partidas se reserva el lugar con el texto de pendiente, invisible: la lista no salta. */}
                          <ModeStateTag state={state} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </TabPage>
  );
}
