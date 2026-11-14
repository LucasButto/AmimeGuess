'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FinishReport, VersusProgress } from '@/components/game-shell/types';
import { isRoomCode } from '@/versus/code';
import { buildFinish, gameHref } from './roomState';
import { readCredentials, readTimes, writeTimes } from './storage';
import { resetVersusStore, setVersusStore, type RoomHandle } from './store';
import { useVersusRoom } from './useVersusRoom';
import type { VersusGame } from './VersusGameContext';

/**
 * El proveedor de la sala de versus (docs/versus/02-arquitectura.md, "VersusProvider"). Vive en el layout raíz, pero se carga
 * con import dinámico solo cuando la URL trae `v=` o es del versus (ver `VersusMount`): para el resto de las visitas no agrega
 * código ni conexiones. Mantiene UN solo WebSocket por sala mientras se navega entre la sala de espera y las partidas, y le
 * publica al resto (por `store.ts`) la conexión y la partida de versus de la página actual.
 */
export default function VersusRuntime() {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = (params.get('v') ?? (pathname === '/versus/sala' ? params.get('c') : null))?.trim().toUpperCase() ?? null;
  const code = raw && isRoomCode(raw) ? raw : null;

  useEffect(() => {
    if (!code) resetVersusStore();
  }, [code]);

  if (!code) return null;
  return <RoomRuntime key={code} code={code} wantsGame={params.has('v')} index={Number(params.get('p'))} pathname={pathname} />;
}

function RoomRuntime({ code, wantsGame, index, pathname }: { code: string; wantsGame: boolean; index: number; pathname: string }) {
  const router = useRouter();
  const [credentials] = useState(() => readCredentials(code));
  const [name, setName] = useState<string | null>(null);
  const [spectate, setSpectate] = useState(false);
  const connection = useVersusRoom({ code, credentials, name, spectate });
  const { snapshot, send, serverNow } = connection;
  const [finishedMs, setFinishedMs] = useState<Record<number, number>>(() => readTimes(code));

  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  });

  const salaHref = `/versus/sala?c=${code}`;

  const handle = useMemo<RoomHandle>(() => ({ code, connection, join: setName, spectate: () => setSpectate(true) }), [code, connection]);

  // Al entrar a una partida (o recargar en ella), se va a la que le toca: no se puede adelantarse ni volver atrás. Una sola vez
  // por partida: al terminar la propia, el resumen se queda hasta pasar a la siguiente.
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (!wantsGame || !snapshot) return;
    const playing = snapshot.phase === 'playing' || snapshot.phase === 'tiebreakPlaying';
    // Si la sala sale de "jugando" (votación de desempate, resultados) mientras se está en una partida, todos vuelven a la sala.
    if (!playing) {
      checked.current = null;
      router.replace(salaHref);
      return;
    }
    const key = `${code}:${index}`;
    if (checked.current === key) return;
    checked.current = key;
    const own = snapshot.progress.find((item) => item.playerId === snapshot.you.playerId);
    if (snapshot.you.spectator || !own || own.index === 0) {
      router.replace(salaHref);
      return;
    }
    // También si la ruta no es la de la partida (se cambió el modo en la URL a mano): se va a la que corresponde.
    const target = gameHref(snapshot, own.index);
    if (own.index !== index || (target !== null && target.split('?')[0] !== pathname)) router.replace(target ?? salaHref);
  }, [wantsGame, snapshot, code, index, router, salaHref, pathname]);

  const onProgress = useCallback(
    (progress: VersusProgress) => {
      send({ type: 'progress', index, attempts: progress.attempts, ...(progress.errors === undefined ? {} : { errors: progress.errors }), ...(progress.score === undefined ? {} : { score: progress.score }) });
    },
    [send, index],
  );

  const onLoaded = useCallback(() => {
    send({ type: 'loaded', index });
  }, [send, index]);

  const onFinish = useCallback(
    (report: FinishReport) => {
      // Una partida ya terminada que se restauró al recargar ya está en el servidor.
      if (!report.fresh) return;
      const snap = latest.current;
      const partida = snap ? (index <= snap.config.partidas.length ? snap.config.partidas[index - 1] : snap.tiebreakGames.find((game) => game.index === index)?.partida) : undefined;
      const startedAt = snap?.mine?.index === index ? snap.mine.startedAt : undefined;
      const spent = report.timedOut ? (partida?.timeLimitMs ?? 0) : startedAt === undefined ? 0 : Math.max(0, serverNow() - startedAt);
      setFinishedMs((current) => {
        if (current[index] !== undefined) return current;
        const next = { ...current, [index]: spent };
        writeTimes(code, next);
        return next;
      });
      // Rendirse manda `surrender` (el servidor cierra la partida como perdida o con el límite completo) y después el `finish`
      // suma la respuesta y la grilla; si fue por tiempo agotado, la partida ya la cerró el servidor.
      if (report.surrendered && !report.timedOut) send({ type: 'surrender', index });
      send(buildFinish(index, report));
    },
    [send, serverNow, index, code],
  );

  const onNext = useCallback(() => {
    const snap = latest.current;
    if (!snap) return;
    const own = snap.progress.find((item) => item.playerId === snap.you.playerId);
    const href = own && own.index > 0 ? gameHref(snap, own.index) : null;
    router.push(href ?? salaHref);
  }, [router, salaHref]);

  const onLeave = useCallback(() => {
    connection.leave();
    router.push('/');
  }, [connection, router]);

  const game = useMemo<VersusGame | null>(() => {
    if (!wantsGame || !snapshot || snapshot.you.spectator || snapshot.seed === undefined) return null;
    const playing = snapshot.phase === 'playing' || snapshot.phase === 'tiebreakPlaying';
    const partida = index <= snapshot.config.partidas.length ? snapshot.config.partidas[index - 1] : snapshot.tiebreakGames.find((item) => item.index === index)?.partida;
    if (!playing || !partida || !Number.isInteger(index) || index < 1) return null;
    // Con un `p` que no es de esta página (se cambió la URL a mano), no se arma el juego: la página de otro modo se confundiría con las series de esta partida hasta que se redirige.
    if (pathname !== `/${partida.franchise}/${partida.mode}`) return null;
    const mine = snapshot.mine?.index === index ? snapshot.mine : undefined;
    return {
      seed: snapshot.seed,
      index,
      total: snapshot.config.partidas.length,
      modality: snapshot.config.modality,
      partida,
      options: snapshot.config.options,
      ...(mine?.startedAt === undefined ? {} : { startedAt: mine.startedAt }),
      ...(snapshot.startsAt === undefined ? {} : { raceStartedAt: snapshot.startsAt }),
      ...(mine?.endsAt === undefined ? {} : { endsAt: mine.endsAt }),
      ...(connection.stops[index] ? { stop: connection.stops[index] } : {}),
      onProgress,
      onFinish,
      onLoaded,
      onNext,
      now: serverNow,
      room: { code, meId: snapshot.you.playerId, players: snapshot.players, progress: snapshot.progress, status: connection.status, notices: connection.notices, finishedMs, onLeave },
    };
  }, [wantsGame, snapshot, index, pathname, connection.stops, connection.status, connection.notices, finishedMs, code, onProgress, onFinish, onLoaded, onNext, onLeave, serverNow]);

  useEffect(() => {
    setVersusStore({ code, handle, game, failure: wantsGame && connection.status === 'unavailable' ? 'unavailable' : null });
  }, [code, handle, game, wantsGame, connection.status]);

  useEffect(() => resetVersusStore, []);

  return null;
}
