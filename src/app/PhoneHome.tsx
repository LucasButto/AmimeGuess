import Link from 'next/link';
import type { CSSProperties } from 'react';
import { es } from '@/i18n/es';
import { channelProgress, type Channel, type Progress } from './channels';
import { versusEnabled } from '@/components/versus/enabled';
import styles from './PhoneHome.module.scss';

/** Teléfono, arriba del televisor: la racha de todo el sitio (lleva a Estadísticas) y cuánto se resolvió hoy. */
export function PhoneTop({ streak, solved, total, ready }: { streak: number; solved: number; total: number; ready: boolean }) {
  return (
    <div className={styles.top} data-ready={ready}>
      <Link className={styles.streak} href="/estadisticas" aria-label={es.home.streakLabel(streak)} data-streak>
        {es.home.streak(streak)}
      </Link>
      <p className={styles.today}>{es.home.todaySummary(solved, total)}</p>
    </div>
  );
}

/** Teléfono, debajo del televisor: un punto por canal; el del canal que se ve está lleno. */
export function PhoneDots({ channels, index }: { channels: readonly Channel[]; index: number }) {
  return (
    <div className={styles.dots} aria-hidden="true">
      {channels.map((channel, position) => <span key={channel.slug} className={styles.dot} data-active={position === index} />)}
    </div>
  );
}

/** Una tarjeta de franquicia con su barra de progreso de hoy (o "Próximamente", sin enlace). */
function FranchiseCard({ channel, progress }: { channel: Channel; progress: Progress }) {
  const { solved, count, done, label } = channelProgress(channel, progress);
  if (channel.comingSoon) {
    return (
      <li className={styles.cardItem}>
        <span className={styles.card} data-soon data-franchise={channel.slug} data-franchise-card role="img" aria-label={es.home.comingSoonLabel(channel.name)}>
          <span className={styles.cardName} aria-hidden="true">{channel.name}</span>
          <span className={styles.cardCount} aria-hidden="true">{es.home.comingSoon}</span>
        </span>
      </li>
    );
  }
  const total = channel.modes.length;
  return (
    <li className={styles.cardItem}>
      {/* `data-franchise` le da a la tarjeta la fuente y los colores de su tema. */}
      <Link className={styles.card} href={`/${channel.slug}`} data-franchise={channel.slug} data-franchise-card data-done={done} aria-label={label}>
        <span className={styles.cardName} aria-hidden="true">{channel.name}</span>
        <span className={styles.cardCount} aria-hidden="true">{solved === null ? es.home.loadingShort : es.home.cardCount(count, total)}</span>
        <span className={styles.cardBar} aria-hidden="true">
          <span className={styles.cardFill} style={{ '--progress': total === 0 ? 0 : count / total } as CSSProperties} />
        </span>
      </Link>
    </li>
  );
}

interface PhoneFeedProps {
  channels: readonly Channel[];
  progress: Progress;
  /** El próximo reto pendiente (`null` mientras no se leyó el progreso, `'done'` si no queda ninguno). */
  next: { channel: Channel; mode: string } | 'done' | null;
}

/** Teléfono, en lugar del control remoto: "Seguí jugando" (el próximo reto pendiente) y una tarjeta por franquicia. */
export function PhoneFeed({ channels, progress, next }: PhoneFeedProps) {
  // Versus: solo con la variable `NEXT_PUBLIC_VERSUS_URL`.
  const versusCard = versusEnabled() && (
    <Link className={styles.versusCard} href="/versus" data-versus aria-label={es.versus.entry.label}>
      <span className={styles.versusText} aria-hidden="true">
        <strong>{es.versus.entry.name}</strong>
        <span>{es.versus.entry.tagline}</span>
      </span>
      <span className={styles.versusGo} aria-hidden="true">{es.versus.entry.create}</span>
    </Link>
  );
  const modeName = next === null || next === 'done' ? '' : next.channel.modeNames[next.mode] ?? next.mode;
  return (
    <div className={styles.feed}>
      {versusCard}
      {next === 'done' ? (
        <p className={styles.allDone}>{es.home.continueAllDone}</p>
      ) : next === null ? (
        // Antes de leer el progreso se reserva el lugar, invisible: la pantalla no salta al conocerlo.
        <span className={styles.continue} data-ready="false" aria-hidden="true">
          <span className={styles.continueText}>
            <strong className={styles.continueTitle}>{es.home.continueTitle}</strong>
            <span className={styles.continueLine}>…</span>
          </span>
          <span className={styles.continuePlay}>{es.home.continuePlay}</span>
        </span>
      ) : (
        <Link className={styles.continue} href={`/${next.channel.slug}/${next.mode}`} data-franchise={next.channel.slug} data-continue data-ready="true"
          aria-label={es.home.continueLabel(next.channel.name, modeName)}>
          <span className={styles.continueText} aria-hidden="true">
            <strong className={styles.continueTitle}>{es.home.continueTitle}</strong>
            <span className={styles.continueLine}>{`${next.channel.name} · ${modeName}`}</span>
          </span>
          <span className={styles.continuePlay} aria-hidden="true">{es.home.continuePlay}</span>
        </Link>
      )}
      <ul className={styles.cards} aria-label={es.home.cardsLabel}>
        {channels.map((channel) => <FranchiseCard key={channel.slug} channel={channel} progress={progress} />)}
      </ul>
    </div>
  );
}
