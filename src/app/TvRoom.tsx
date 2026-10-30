'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { TitleWords } from '@/components/TitleWords';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { useSolvedToday } from '@/components/useSolvedToday';
import { es } from '@/i18n/es';
import { ChannelEmblem } from './ChannelEmblem';
import styles from './TvRoom.module.scss';

export interface Channel {
  slug: string;
  name: string;
  /** Los modos que se pueden jugar (los ocultos por falta de contenido no cuentan). */
  modes: readonly string[];
}

/** El progreso de hoy de un canal, con el nombre accesible del enlace; `null` mientras se lee el almacenamiento. */
function useChannelProgress(channel: Channel) {
  const solved = useSolvedToday(channel.slug, channel.modes);
  const count = solved === null ? 0 : solved.size;
  const done = solved !== null && channel.modes.length > 0 && count === channel.modes.length;
  const label = solved === null ? es.home.cardLoading(channel.name) : es.home.cardLabel(channel.name, count, channel.modes.length);
  return { solved, count, done, label };
}

interface ScreenProps {
  channel: Channel;
  number: number;
  onNavigate: (event: { preventDefault: () => void }, slug: string) => void;
}

/** La pantalla: la apertura del canal. Es un enlace a la franquicia. */
function TvScreen({ channel, number, onNavigate }: ScreenProps) {
  const { solved, count, done, label } = useChannelProgress(channel);
  return (
    // `data-franchise` le da a la pantalla las variables de su tema (ver `themeCss` con alcance de franquicia).
    <Link className={styles.screen} href={`/${channel.slug}`} data-franchise={channel.slug} data-tv-screen data-progress-ready={solved !== null}
      aria-label={label} onNavigate={(event) => onNavigate(event, channel.slug)}>
      <span className={styles.picture} aria-hidden="true">
        <span className={styles.onomatopoeia}>{es.home.onomatopoeia[channel.slug]}</span>
        <ChannelEmblem slug={channel.slug} />
        <span className={styles.channelName}>{channel.slug === 'dragon-ball' ? <TitleWords text={channel.name} /> : channel.name}</span>
        <span className={styles.channelCount} data-done={done}>
          {solved === null ? es.home.loading : es.home.progress(count, channel.modes.length)}
        </span>
        {done && <span className={styles.seal}>{es.home.complete}</span>}
        <span className={styles.osd}>{es.home.channelNumber(number)}</span>
      </span>
    </Link>
  );
}

interface RemoteButtonProps {
  channel: Channel;
  active: boolean;
  onTune: () => void;
  onNavigate: (event: { preventDefault: () => void }, slug: string) => void;
}

/** Un botón del control remoto: siempre a la vista, con el nombre de la franquicia y su progreso. */
function RemoteButton({ channel, active, onTune, onNavigate }: RemoteButtonProps) {
  const { solved, count, done, label } = useChannelProgress(channel);
  return (
    <Link className={styles.key} href={`/${channel.slug}`} data-franchise={channel.slug} data-active={active} data-done={done}
      data-remote-key aria-label={label} onMouseEnter={onTune} onFocus={onTune} onNavigate={(event) => onNavigate(event, channel.slug)}>
      <span className={styles.keyName} aria-hidden="true">{channel.name}</span>
      <span className={styles.keyCount} aria-hidden="true">{solved === null ? es.home.loadingShort : es.home.progressShort(count, channel.modes.length)}</span>
    </Link>
  );
}

/**
 * La habitación: un televisor de tubo con un canal por franquicia y, debajo, un control remoto con los cuatro canales
 * siempre a la vista. Se arranca siempre en el canal 1; no se guarda nada.
 */
export function TvRoom({ channels }: { channels: readonly Channel[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [entering, setEntering] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [noisy, setNoisy] = useState(false);
  const [noiseKey, setNoiseKey] = useState(0);
  // El canal que se ve y el que se pidió por último; la estática corre de a un corte por vez (640 ms, a lo sumo 1,6 por segundo).
  const shown = useRef(0);
  const wanted = useRef(0);
  const busy = useRef(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noiseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (noiseTimer.current !== null) clearTimeout(noiseTimer.current);
    if (swapTimer.current !== null) clearTimeout(swapTimer.current);
    delete document.body.dataset.tvLeaving;
  }, []);
  const current = channels[index];

  function show(target: number) {
    shown.current = target;
    setIndex(target);
    setAnnouncement(es.home.channelChanged(target + 1, channels[target].name));
  }

  // La estática es opaca y el canal cambia recién cuando ya tapa la pantalla (a los 160 ms), siempre al último pedido: si se
  // pasa rápido por varios canales, el corte sigue hasta el final y después, si hace falta, hay otro: nunca se ve la imagen
  // nueva a través de ella ni se corta a mitad.
  function cycle() {
    if (wanted.current === shown.current) return;
    busy.current = true;
    setNoiseKey((key) => key + 1);
    setNoisy(true);
    swapTimer.current = setTimeout(() => show(wanted.current), 160);
    noiseTimer.current = setTimeout(() => {
      setNoisy(false);
      busy.current = false;
      if (wanted.current !== shown.current) cycle();
    }, 640);
  }

  function tune(next: number) {
    const target = (next + channels.length) % channels.length;
    if (target === wanted.current) return;
    wanted.current = target;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show(target);
      return;
    }
    if (!busy.current) cycle();
  }

  function enter(event: { preventDefault: () => void }, slug: string) {
    // Los clics modificados conservan el enlace nativo y no pasan por onNavigate.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    if (timer.current !== null) return;
    setEntering(true);
    document.body.dataset.tvLeaving = 'true';
    timer.current = setTimeout(() => router.push(`/${slug}`), 640);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      tune(wanted.current + 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      tune(wanted.current - 1);
    }
  }

  if (!current) return <p role="status">{es.home.noChannels}</p>;

  return (
    <div className={styles.stage} data-franchise={current.slug} data-tv-room data-channel={index + 1} onKeyDown={handleKeyDown}>
      {/* Va en el <body>: tapa toda la ventana, también el pie. */}
      {entering && createPortal(<span className={styles.fullStatic} data-mode="in" data-tv-full-static aria-hidden="true"><span /></span>, document.body)}
      <section className={styles.set} aria-label={es.home.tvLabel} data-entering={entering}>
        <span className={styles.antenna} data-side="start" aria-hidden="true" />
        <span className={styles.antenna} data-side="end" aria-hidden="true" />
        <div className={styles.cabinet}>
          <div className={styles.bezel} data-noisy={noisy}>
            <TvScreen channel={current} number={index + 1} onNavigate={enter} key={current.slug} />
            <span className={styles.noise} key={noiseKey} aria-hidden="true" data-tv-noise><span className={styles.noiseLayer} /></span>
          </div>
          <h1 className={styles.badge}><span>{es.home.title}</span></h1>
          <div className={styles.panel}>
            <span className={styles.speaker} aria-hidden="true" />
            <span className={styles.knob} aria-hidden="true" />
            <span className={styles.knob} aria-hidden="true" data-small />
            <div className={styles.tuner}>
              <button type="button" className={styles.tune} aria-label={es.home.channelDown} onClick={() => tune(wanted.current - 1)}>◀</button>
              <button type="button" className={styles.tune} aria-label={es.home.channelUp} onClick={() => tune(wanted.current + 1)}>▶</button>
            </div>
          </div>
        </div>
        <span className={styles.stand} aria-hidden="true" />
      </section>
      <div className={styles.floor} style={{ '--channel-count': channels.length, '--mobile-columns': Math.min(2, channels.length) } as CSSProperties}>
        <nav className={styles.remote} aria-label={es.home.remoteLabel}>
          {channels.map((channel, position) => (
            <RemoteButton key={channel.slug} channel={channel} active={position === index} onTune={() => tune(position)} onNavigate={enter} />
          ))}
        </nav>
      </div>
      <VisuallyHidden role="status" aria-live="polite">{announcement}</VisuallyHidden>
    </div>
  );
}
