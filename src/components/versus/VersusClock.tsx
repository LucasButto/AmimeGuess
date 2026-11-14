'use client';

import { useEffect, useState } from 'react';
import { es } from '@/i18n/es';
import { useSkin } from '@/components/skin/context';
import type { VersusBarProps } from '@/franchises/types';
import { avatarColor } from './arcade/PlayerAvatar';
import { formatClock } from './format';
import type { VersusGame } from './VersusGameContext';

/** Desde acá la cuenta regresiva cambia de color. */
const WARNING_MS = 10_000;

/**
 * La barra de una partida de versus: en Contrarreloj, la cuenta regresiva del tiempo límite y el total acumulado; en Carrera,
 * el tiempo total desde el inicio común; en Menos intentos, sin reloj. Arriba va la modalidad y "Partida N de M", y abajo los
 * rivales, el último aviso y Salir. Esta pieza arma los datos; la dibuja el slot `VersusBar` de la piel de la franquicia.
 */
export function VersusClock({ game, frozen }: { game: VersusGame; frozen?: boolean }) {
  const clock = game.now ?? Date.now;
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    if (frozen) return;
    const timer = window.setInterval(() => setNow(clock()), 250);
    return () => window.clearInterval(timer);
  }, [frozen, clock]);

  const countdown = game.modality === 'timeAttack' && game.endsAt !== undefined ? Math.max(0, game.endsAt - now) : null;
  const elapsed = game.modality === 'race' && game.raceStartedAt !== undefined ? Math.max(0, now - game.raceStartedAt) : null;
  // Carrera: lo que ya tardó en las partidas anteriores más lo de esta (el tiempo total corre desde el inicio común).
  const room = game.room;
  const spentBefore = room ? Object.entries(room.finishedMs).reduce((sum, [index, ms]) => (Number(index) < game.index ? sum + ms : sum), 0) : 0;
  const warning = countdown !== null && countdown <= WARNING_MS;

  const { VersusBar } = useSkin().skin.slots;
  const clocks: VersusBarProps['clocks'][number][] = [];
  if (countdown !== null) clocks.push({ label: es.versus.timeLeft, text: formatClock(countdown, 'up'), main: true });
  if (elapsed !== null) clocks.push({ label: es.versus.elapsed, text: formatClock(elapsed), main: true });
  if (room && game.modality === 'timeAttack' && spentBefore > 0) {
    clocks.push({ label: es.versus.rivals.totalTime, text: formatClock(spentBefore + (game.startedAt === undefined || frozen ? 0 : Math.max(0, now - game.startedAt))), main: false });
  }
  const rivals = room?.players.map((player) => {
    const view = room.progress.find((item) => item.playerId === player.id);
    const status = player.abandoned
      ? es.versus.rivals.abandoned
      : !player.connected
        ? es.versus.rivals.disconnected
        : !view || view.index === 0
          ? es.versus.rivals.doneAll
          : view.index > game.total
            ? es.versus.tiebreak.badge
            : es.versus.rivals.where(view.index, game.total);
    return { id: player.id, name: player.name, status, self: player.id === room.meId, gone: player.abandoned || !player.connected, color: avatarColor(player.name) };
  });
  const connection = room && room.status !== 'open' ? (room.status === 'unavailable' ? es.versus.room.unavailable : es.versus.rivals.offline) : undefined;
  const notice = room?.notices.at(-1);

  return (
    <VersusBar
      modality={es.versus.modality[game.modality]}
      modalityKey={game.modality}
      partida={game.index > game.total ? es.versus.tiebreak.badge : es.versus.partidaOf(game.index, game.total)}
      clocks={clocks}
      warning={warning}
      rivalsLabel={es.versus.rivals.label}
      leaveLabel={es.versus.rivals.leave}
      {...(rivals ? { rivals } : {})}
      {...(connection ? { connection } : {})}
      {...(notice ? { notice } : {})}
      {...(room ? { onLeave: room.onLeave } : {})}
    />
  );
}
