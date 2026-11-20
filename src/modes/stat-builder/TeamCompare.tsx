import { ContentImage } from '@/components/ContentImage';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { totalOf, type Assignment } from './logic';
import type { StatBuilderConfig } from './types';
import styles from './TeamCompare.module.scss';

interface TeamProps {
  title: string;
  stats: StatBuilderConfig['stats'];
  pool: readonly Entity[];
  build: readonly Assignment[];
  /** El mejor equipo: resalta los lugares donde cambia respecto de este (el que armó la persona). */
  against?: readonly Assignment[];
}

/** Un equipo: cada estadística con el Pokémon que la ocupa (su imagen), el valor que tiene ahí y el total. */
function Team({ title, stats, pool, build, against }: TeamProps) {
  return (
    <article className={styles.team} data-best={against ? '' : undefined} aria-label={title}>
      <header className={styles.teamHeader}>
        <h3 className={styles.teamTitle}>{title}</h3>
        <span className={styles.teamTotal}>{es.statBuilder.teamTotal(totalOf(build, pool))}</span>
      </header>
      <ul className={styles.members}>
        {stats.map((stat) => {
          const entry = build.find((item) => item.key === stat.key);
          const entity = pool.find((item) => item.id === entry?.entityId);
          if (!entry || !entity) return null;
          const changed = against !== undefined && against.find((item) => item.key === stat.key)?.entityId !== entry.entityId;
          return (
            <li key={stat.key} className={styles.member} data-changed={changed || undefined}>
              {entity.image ? <ContentImage stem={entity.image} alt="" sizes="2.75rem" className={styles.memberImage} /> : <span className={styles.memberImage} aria-hidden="true" />}
              <span className={styles.memberStat}>{stat.label}</span>
              <strong className={styles.memberValue}>{Number(entity.attrs[stat.key])}</strong>
              <VisuallyHidden>{entity.name.es}</VisuallyHidden>
              <span className={styles.memberName} aria-hidden="true">{entity.name.es}</span>
              {changed && <VisuallyHidden>{es.statBuilder.moved}</VisuallyHidden>}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

interface TeamCompareProps {
  stats: StatBuilderConfig['stats'];
  pool: readonly Entity[];
  /** La combinación que armó la persona. */
  build: readonly Assignment[];
  /** La mejor combinación posible con esos mismos Pokémon (`bestBuild`). */
  optimal: readonly Assignment[];
}

/**
 * "Mejor combinación posible": los dos equipos lado a lado, el de la persona y el mejor que se podía armar con los mismos Pokémon.
 * Si la persona ya armó la mejor, no hay nada que comparar: se muestra solo su elección, con cada Pokémon en su lugar.
 */
export function TeamCompare({ stats, pool, build, optimal }: TeamCompareProps) {
  if (totalOf(optimal, pool) === totalOf(build, pool)) {
    return (
      <section className={styles.root} aria-label={es.statBuilder.pickedBestTitle}>
        <h2 className={styles.title}>{es.statBuilder.pickedBestTitle}</h2>
        <p className={styles.summary}>{es.statBuilder.pickedBestSummary(totalOf(build, pool))}</p>
        <div className={styles.teams} data-single="">
          <Team title={es.statBuilder.yourPick} stats={stats} pool={pool} build={build} against={build} />
        </div>
      </section>
    );
  }
  return (
    <section className={styles.root} aria-label={es.statBuilder.bestTitle}>
      <h2 className={styles.title}>{es.statBuilder.bestTitle}</h2>
      <p className={styles.summary}>{es.statBuilder.bestSummary(totalOf(optimal, pool), totalOf(build, pool))}</p>
      <div className={styles.teams}>
        <Team title={es.statBuilder.yourTeam} stats={stats} pool={pool} build={build} />
        <Team title={es.statBuilder.bestTeam} stats={stats} pool={pool} build={optimal} against={build} />
      </div>
    </section>
  );
}
