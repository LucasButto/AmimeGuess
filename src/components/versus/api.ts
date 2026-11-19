import type { VersusConfig } from '@/versus/config';
import { snapshotSchema, type Phase } from '@/versus/protocol';
import { versusUrl } from './enabled';

/** La dirección HTTP del servidor (la de la variable `NEXT_PUBLIC_VERSUS_URL`, que es `ws://` o `wss://`). */
export function httpBase(): string | undefined {
  return versusUrl()?.replace(/^ws/, 'http');
}

export type CreateRoomResult =
  | { readonly ok: true; readonly code: string; readonly playerId: string; readonly token: string }
  /** `quota`: el servidor no puede ahora (cupo del día agotado); `invalid`: no aceptó la configuración; `failed`: no respondió. */
  | { readonly ok: false; readonly reason: 'quota' | 'invalid' | 'failed' };

/** Crea la sala en el servidor (`POST /rooms`). */
export async function createRoom(config: VersusConfig, name: string): Promise<CreateRoomResult> {
  const base = httpBase();
  if (!base) return { ok: false, reason: 'failed' };
  try {
    const response = await fetch(`${base}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, name }) });
    if (response.status === 201) {
      const body = (await response.json()) as { code?: unknown; playerId?: unknown; token?: unknown };
      if (typeof body.code === 'string' && typeof body.playerId === 'string' && typeof body.token === 'string') {
        return { ok: true, code: body.code, playerId: body.playerId, token: body.token };
      }
      return { ok: false, reason: 'failed' };
    }
    if (response.status === 400) return { ok: false, reason: 'invalid' };
    if (response.status === 429 || response.status === 503) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export type RoomLookup =
  | { readonly kind: 'exists'; readonly phase: Phase; readonly players: number }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unavailable' };

/** Lo que ve cualquiera de la sala (`GET /rooms/:código`): sirve para avisar antes de pedir el apodo. */
export async function lookupRoom(code: string): Promise<RoomLookup> {
  const base = httpBase();
  if (!base) return { kind: 'unavailable' };
  try {
    const response = await fetch(`${base}/rooms/${code}`);
    if (response.status === 404) return { kind: 'missing' };
    if (response.status !== 200) return { kind: 'unavailable' };
    const parsed = snapshotSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'exists', phase: parsed.data.phase, players: parsed.data.players.length } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
