'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientMessage, Snapshot } from '@/versus/protocol';
import { VersusClient, type ConnectionStatus } from './client';
import { versusUrl } from './enabled';
import { applyMessage, noticeFor, noticeOf, type Notice } from './roomState';
import { clearCredentials, writeCredentials, type Credentials } from './storage';

export interface RoomConnection {
  /** Cómo está la conexión (`connecting`, `open`, `reconnecting`, `closed`, `unavailable`). */
  readonly status: ConnectionStatus;
  /** Lo último que se sabe de la sala (`null` hasta el primer `snapshot`). */
  readonly snapshot: Snapshot | null;
  /** Un aviso que no se arregla reintentando (sala llena, ya empezó, te sacaron…). */
  readonly notice: Notice | null;
  /** Lo que el servidor le pidió cerrar a este jugador, por partida: tiempo agotado o fin anticipado. */
  readonly stops: Readonly<Record<number, 'won' | 'timeUp'>>;
  /** Avisos cortos de lo que pasa con los demás ("Beto terminó la partida 1"), los más nuevos al final. */
  readonly notices: readonly string[];
  /** La hora del servidor ahora (el reloj local corregido). */
  readonly serverNow: () => number;
  readonly send: (message: ClientMessage) => boolean;
  /** Sale de la sala: avisa, cierra la conexión y olvida el token. */
  readonly leave: () => void;
  /** Después de `unavailable`: volver a intentar. */
  readonly retry: () => void;
}

interface Input {
  readonly code: string | null;
  /** El lugar que este navegador ya tenía en la sala. */
  readonly credentials: Credentials | null;
  /** El apodo para unirse (sin token). Mientras sea `null` y no haya token, no se conecta (salvo `spectate`). */
  readonly name: string | null;
  /** Mirar sin unirse (la sala ya empezó o está llena). */
  readonly spectate?: boolean;
}

/** Cuántos avisos se recuerdan. */
const NOTICE_MS = 6_000;
const MAX_NOTICES = 3;

/**
 * La conexión de la sala: abre un solo WebSocket por sala (con el token guardado o, si no hay, con el apodo), guarda el token
 * que manda el servidor al unirse y mantiene el estado de la sala. Vive en el proveedor del versus (`VersusRuntime`), que
 * está en el layout raíz: la conexión sigue abierta mientras se navega entre la sala de espera y las partidas.
 */
export function useVersusRoom({ code, credentials, name, spectate = false }: Input): RoomConnection {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [stops, setStops] = useState<Record<number, 'won' | 'timeUp'>>({});
  const [notices, setNotices] = useState<readonly string[]>([]);
  const clientRef = useRef<VersusClient | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const token = credentials?.token;

  useEffect(() => {
    const url = versusUrl();
    if (!code || !url || (!token && !name && !spectate)) return;
    const client = new VersusClient({ url, code, ...(token ? { token } : {}), ...(name ? { name } : {}) });
    clientRef.current = client;
    const offStatus = client.onStatus(setStatus);
    const offMessage = client.onMessage((message) => {
      if (message.type === 'snapshot' && message.you.playerId && message.you.token) {
        writeCredentials(code, { playerId: message.you.playerId, token: message.you.token });
      }
      if (message.type === 'error') {
        const next = noticeOf(message.code);
        if (next) setNotice(next);
      }
      if (message.type === 'timeUp') setStops((current) => ({ ...current, [message.index]: 'timeUp' }));
      if (message.type === 'endNow') setStops((current) => ({ ...current, [message.index]: current[message.index] ?? 'won' }));
      if (message.type === 'progress' && latest.current) {
        const text = noticeFor(latest.current.progress.find((item) => item.playerId === message.progress.playerId), message.progress, latest.current.players, latest.current.you.playerId);
        if (text) {
          setNotices((current) => [...current, text].slice(-MAX_NOTICES));
          // Un aviso dura unos segundos: no se acumulan ni tapan el juego.
          window.setTimeout(() => setNotices((current) => {
            const at = current.indexOf(text);
            return at < 0 ? current : current.filter((_, index) => index !== at);
          }), NOTICE_MS);
        }
      }
      latest.current = applyMessage(latest.current, message);
      setSnapshot(latest.current);
    });
    client.connect();
    return () => {
      offStatus();
      offMessage();
      client.close();
      clientRef.current = null;
      latest.current = null;
    };
  }, [code, token, name, spectate]);

  const send = useCallback((message: ClientMessage) => clientRef.current?.send(message) ?? false, []);
  const serverNow = useCallback(() => clientRef.current?.serverNow() ?? Date.now(), []);
  const retry = useCallback(() => clientRef.current?.retry(), []);
  const leave = useCallback(() => {
    clientRef.current?.send({ type: 'leave' });
    clientRef.current?.close();
    if (code) clearCredentials(code);
  }, [code]);

  return useMemo(() => ({ status, snapshot, notice, stops, notices, serverNow, send, leave, retry }), [status, snapshot, notice, stops, notices, serverNow, send, leave, retry]);
}
