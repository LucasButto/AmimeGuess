'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { TitleWords } from '@/components/TitleWords';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { useIsPhone } from '@/components/useIsPhone';
import { setPrefs, usePrefs } from '@/components/usePrefs';
import { useSiteProgress, useSiteStats } from '@/components/useSiteProgress';
import { playRecipe } from '@/components/ui/sound';
import type { SoundRecipe } from '@/franchises/types';
import { es } from '@/i18n/es';
import { ChannelEmblem } from './ChannelEmblem';
import { channelProgress, nextPending, type Channel, type Progress } from './channels';
import { PhoneDots, PhoneFeed, PhoneTop } from './PhoneHome';
import styles from './TvRoom.module.scss';

export type { Channel } from './channels';

/** Cuánto hay que arrastrar el dedo (px) para cambiar de canal. */
const SWIPE_PX = 48;

/**
 * Deslizar el dedo sobre la pantalla del televisor cambia de canal: a la izquierda, el siguiente; a la derecha, el anterior.
 * Con Pointer Events y `touch-action: pan-y` (el desplazamiento vertical de la página sigue andando). Cambia en cuanto el dedo
 * pasa el umbral, sin esperar a soltar. Un deslizamiento no cuenta como toque: no abre la franquicia.
 */
function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const gesture = useRef<{ id: number; x: number; y: number; locked: boolean; done: boolean } | null>(null);
  const swiped = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      swiped.current = false;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, locked: false, done: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const g = gesture.current;
      if (g === null || g.id !== event.pointerId || g.done) return;
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      if (!g.locked && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        g.locked = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // El puntero ya terminó: no hay nada que capturar.
        }
      }
      if (g.locked && Math.abs(dx) >= SWIPE_PX) {
        g.done = true;
        swiped.current = true;
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    onPointerUp() {
      gesture.current = null;
    },
    onPointerCancel() {
      gesture.current = null;
    },
    onClick(event: MouseEvent<HTMLElement>) {
      if (!swiped.current) return;
      swiped.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

type SwipeHandlers = ReturnType<typeof useSwipe>;

interface ScreenProps {
  channel: Channel;
  number: number;
  /** Un aviso breve en la pantalla (por ejemplo, "SONIDO SÍ"), como los de un televisor. */
  note: string;
  progress: Progress;
  swipe: SwipeHandlers;
  onNavigate: (event: { preventDefault: () => void }, slug: string) => void;
}

/** La pantalla: la apertura del canal. Es un enlace a la franquicia; un canal "Próximamente" es solo estática. */
function TvScreen({ channel, number, note, progress, swipe, onNavigate }: ScreenProps) {
  const { solved, count, done, label } = channelProgress(channel, progress);
  if (channel.comingSoon) {
    return (
      <div className={styles.screen} data-soon data-franchise={channel.slug} role="img" aria-label={es.home.comingSoonLabel(channel.name)} data-tv-screen {...swipe}>
        <span className={styles.picture} aria-hidden="true">
          <span className={styles.soonStatic} />
          <span className={styles.soonName}>{channel.name}</span>
          <span className={styles.soonLabel}>{es.home.comingSoon}</span>
          {note !== '' && <span className={styles.osdNote}>{note}</span>}
          <span className={styles.osd}>{es.home.channelNumber(number)}</span>
        </span>
      </div>
    );
  }
  return (
    // `data-franchise` le da a la pantalla las variables de su tema (ver `themeCss` con alcance de franquicia).
    <Link className={styles.screen} href={`/${channel.slug}`} data-franchise={channel.slug} data-tv-screen data-progress-ready={solved !== null}
      aria-label={label} onNavigate={(event) => onNavigate(event, channel.slug)} {...swipe}>
      <span className={styles.picture} aria-hidden="true">
        <span className={styles.onomatopoeia}>{es.home.onomatopoeia[channel.slug]}</span>
        <ChannelEmblem slug={channel.slug} />
        <span className={styles.channelName}>{channel.slug === 'dragon-ball' ? <TitleWords text={channel.name} /> : channel.name}</span>
        <span className={styles.channelCount} data-done={done}>
          {solved === null ? es.home.loading : es.home.progress(count, channel.modes.length)}
        </span>
        {done && <span className={styles.seal}>{es.home.complete}</span>}
        {note !== '' && <span className={styles.osdNote}>{note}</span>}
        <span className={styles.osd}>{es.home.channelNumber(number)}</span>
      </span>
    </Link>
  );
}

interface RemoteButtonProps {
  channel: Channel;
  active: boolean;
  progress: Progress;
  onTune: () => void;
  onNavigate: (event: { preventDefault: () => void }, slug: string) => void;
}

/** Un botón del control remoto: siempre a la vista, con el nombre de la franquicia y su progreso. Un canal "Próximamente" no se abre. */
function RemoteButton({ channel, active, progress, onTune, onNavigate }: RemoteButtonProps) {
  const { solved, count, done, label } = channelProgress(channel, progress);
  if (channel.comingSoon) {
    return (
      <span className={styles.key} data-soon data-franchise={channel.slug} data-active={active} data-remote-key role="img" aria-label={es.home.comingSoonLabel(channel.name)}
        onMouseEnter={onTune}>
        <span className={styles.keyName} aria-hidden="true">{channel.name}</span>
        <span className={styles.keyCount} aria-hidden="true">{es.home.comingSoon}</span>
      </span>
    );
  }
  return (
    <Link className={styles.key} href={`/${channel.slug}`} data-franchise={channel.slug} data-active={active} data-done={done}
      data-remote-key aria-label={label} onMouseEnter={onTune} onFocus={onTune} onNavigate={(event) => onNavigate(event, channel.slug)}>
      <span className={styles.keyName} aria-hidden="true">{channel.name}</span>
      <span className={styles.keyCount} aria-hidden="true">{solved === null ? es.home.loadingShort : es.home.progressShort(count, channel.modes.length)}</span>
    </Link>
  );
}

/** La pieza que gira al tocar la perilla grande: un sexto de vuelta por canal. */
const KNOB_TURN_DEG = 60;

/** Un pitido corto al prender los sonidos, para que se note que quedaron prendidos. */
const BLIP: SoundRecipe = { wave: 'square', gain: 0.05, notes: [{ frequency: 660, duration: 60 }, { frequency: 880, duration: 90 }] };

/**
 * La habitación: un televisor de tubo con un canal por franquicia. Escritorio: debajo, un control remoto con los canales siempre
 * a la vista. Teléfono (por debajo de `lg`): la pantalla se desliza con el dedo para cambiar de canal, las perillas son botones
 * (la grande cambia de canal y la chica prende o apaga los sonidos) y, en lugar del control remoto, van "Seguí jugando" y una
 * tarjeta por franquicia con su progreso. Se arranca siempre en el canal 1; no se guarda nada.
 */
export function TvRoom({ channels }: { channels: readonly Channel[] }) {
  const router = useRouter();
  const phone = useIsPhone();
  const prefs = usePrefs();
  const playable = channels.filter((channel) => !channel.comingSoon);
  const progress = useSiteProgress(playable.map(({ slug, modes }) => ({ slug, modes })));
  const stats = useSiteStats(playable.map(({ slug, modes }) => ({ slug, modes })));
  const [index, setIndex] = useState(0);
  const [entering, setEntering] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [noisy, setNoisy] = useState(false);
  const [noiseKey, setNoiseKey] = useState(0);
  const [note, setNote] = useState('');
  const [turns, setTurns] = useState(0);
  // El canal que se ve y el que se pidió por último; la estática corre de a un corte por vez (640 ms, a lo sumo 1,6 por segundo).
  const shown = useRef(0);
  const wanted = useRef(0);
  const busy = useRef(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noiseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (noiseTimer.current !== null) clearTimeout(noiseTimer.current);
    if (swapTimer.current !== null) clearTimeout(swapTimer.current);
    if (noteTimer.current !== null) clearTimeout(noteTimer.current);
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

  const swipe = useSwipe((direction) => tune(wanted.current + direction));

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

  function turnKnob() {
    setTurns((count) => count + 1);
    tune(wanted.current + 1);
  }

  function toggleSound() {
    const on = !prefs.sounds;
    setPrefs({ ...prefs, sounds: on });
    if (on) playRecipe(BLIP);
    setAnnouncement(es.home.soundAnnounce(on));
    setNote(on ? es.home.soundOn : es.home.soundOff);
    if (noteTimer.current !== null) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 1600);
  }

  if (!current) return <p role="status">{es.home.noChannels}</p>;

  const next = nextPending(channels, progress, index);
  const solvedTotal = progress === null ? 0 : [...progress.values()].reduce((sum, today) => sum + today.solved.size, 0);
  const modeTotal = playable.reduce((sum, channel) => sum + channel.modes.length, 0);

  return (
    <div className={styles.stage} data-franchise={current.comingSoon ? undefined : current.slug} data-tv-room data-channel={index + 1} onKeyDown={handleKeyDown}>
      {/* Va en el <body>: tapa toda la ventana, también el pie. */}
      {entering && createPortal(<span className={styles.fullStatic} data-mode="in" data-tv-full-static aria-hidden="true"><span /></span>, document.body)}
      {/* Teléfono: la racha de todo el sitio y cuánto se resolvió hoy. */}
      <PhoneTop streak={stats?.streak ?? 0} solved={solvedTotal} total={modeTotal} ready={stats !== null && progress !== null} />
      <section className={styles.set} aria-label={es.home.tvLabel} data-entering={entering}>
        <span className={styles.antenna} data-side="start" aria-hidden="true" />
        <span className={styles.antenna} data-side="end" aria-hidden="true" />
        <div className={styles.cabinet}>
          <div className={styles.bezel} data-noisy={noisy}>
            <TvScreen channel={current} number={index + 1} note={note} progress={progress} swipe={swipe} onNavigate={enter} key={current.slug} />
            <span className={styles.noise} key={noiseKey} aria-hidden="true" data-tv-noise><span className={styles.noiseLayer} /></span>
          </div>
          <h1 className={styles.badge}><span>{es.home.title}</span></h1>
          <div className={styles.panel}>
            <span className={styles.speaker} aria-hidden="true" />
            {phone ? (
              <>
                <button type="button" className={styles.knobButton} data-knob="channel" aria-label={es.home.knobChannel} onClick={turnKnob}>
                  <span className={styles.knob} aria-hidden="true" style={{ '--turn': `${turns * KNOB_TURN_DEG}deg` } as CSSProperties} />
                </button>
                <button type="button" className={styles.knobButton} data-knob="sound" aria-label={es.home.knobSound} aria-pressed={prefs.sounds} onClick={toggleSound}>
                  <span className={styles.knob} data-small aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <span className={styles.knob} aria-hidden="true" />
                <span className={styles.knob} aria-hidden="true" data-small />
              </>
            )}
            <div className={styles.tuner}>
              <button type="button" className={styles.tune} aria-label={es.home.channelDown} onClick={() => tune(wanted.current - 1)}>◀</button>
              <button type="button" className={styles.tune} aria-label={es.home.channelUp} onClick={() => tune(wanted.current + 1)}>▶</button>
            </div>
          </div>
        </div>
        <span className={styles.stand} aria-hidden="true" />
      </section>
      <PhoneDots channels={channels} index={index} />
      <div className={styles.floor} style={{ '--channel-count': channels.length, '--mobile-columns': Math.min(2, channels.length) } as CSSProperties}>
        <nav className={styles.remote} aria-label={es.home.remoteLabel}>
          {channels.map((channel, position) => (
            <RemoteButton key={channel.slug} channel={channel} active={position === index} progress={progress} onTune={() => tune(position)} onNavigate={enter} />
          ))}
        </nav>
      </div>
      {/* Teléfono: lo que sigue (el próximo reto pendiente) y una tarjeta por franquicia. */}
      <PhoneFeed channels={channels} progress={progress} next={next} />
      <VisuallyHidden role="status" aria-live="polite">{announcement}</VisuallyHidden>
    </div>
  );
}
