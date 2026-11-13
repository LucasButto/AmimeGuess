'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, Snapshot } from '@/versus/protocol';
import { VersusClient, type ConnectionStatus } from './client';
import { versusUrl } from './enabled';
import { applyMessage, noticeOf, type Notice } from './roomState';
import { clearCredentials, writeCredentials, type Credentials } from './storage';

export interface RoomConnection {
  /** Cómo está la conexión (`connecting`, `open`, `reconnecting`, `closed`, `unavailable`). */
  readonly status: ConnectionStatus;
  /** Lo último que se sabe de la sala (`null` hasta el primer `snapshot`). */
  readonly snapshot: Snapshot | null;
  /** Un aviso que no se arregla reintentando (sala llena, ya empezó, te sacaron…). */
  readonly notice: Notice | null;
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

/**
 * La conexión de la pantalla de la sala: abre un solo WebSocket por sala (con el token guardado o, si no hay, con el apodo),
 * guarda el token que manda el servidor al unirse y mantiene el estado de la sala. Se cierra al salir de la pantalla.
 */
export function useVersusRoom({ code, credentials, name, spectate = false }: Input): RoomConnection {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const clientRef = useRef<VersusClient | null>(null);
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
      setSnapshot((current) => applyMessage(current, message));
    });
    client.connect();
    return () => {
      offStatus();
      offMessage();
      client.close();
      clientRef.current = null;
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

  return { status, snapshot, notice, serverNow, send, leave, retry };
}
