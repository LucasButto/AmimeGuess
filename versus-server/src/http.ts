import { isValidName, parseConfig, type VersusConfig } from '../../src/versus/config';
import { isRoomCode } from '../../src/versus/code';

// Lo puro de las rutas del Worker (sin Cloudflare): qué origen se acepta, qué ruta es cada pedido y cómo se lee el cuerpo
// de "crear sala". Así se prueba sin levantar nada.

/** Un cuerpo de "crear sala" de más de esto se rechaza. */
export const MAX_BODY_BYTES = 4096;

/** Los orígenes permitidos de la variable `ALLOWED_ORIGINS` (separados por comas). */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin !== '');
}

/**
 * Si el pedido trae `Origin`, tiene que estar en la lista. Sin `Origin` (un script, el smoke test) se acepta: esto evita
 * que otra página use el servidor desde el navegador de alguien, no frena a un programa.
 */
export function originAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || allowed.includes(origin);
}

/** Los encabezados de CORS para un origen permitido; sin `Origin`, ninguno. */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  return origin !== null && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
}

export type Route =
  | { readonly name: 'health' }
  | { readonly name: 'create' }
  | { readonly name: 'summary'; readonly code: string }
  | { readonly name: 'socket'; readonly code: string }
  | { readonly name: 'preflight' };

/** Qué ruta es el pedido, o `null` si ninguna (404). El código de sala tiene que estar bien formado. */
export function route(method: string, pathname: string): Route | null {
  if (method === 'OPTIONS') return { name: 'preflight' };
  if (method === 'GET' && pathname === '/health') return { name: 'health' };
  if (method === 'POST' && pathname === '/rooms') return { name: 'create' };
  const match = /^\/rooms\/([^/]+)(\/ws)?$/.exec(pathname);
  if (method === 'GET' && match && isRoomCode(match[1])) return match[2] ? { name: 'socket', code: match[1] } : { name: 'summary', code: match[1] };
  return null;
}

export type CreateBody = { readonly ok: true; readonly config: VersusConfig; readonly name: string } | { readonly ok: false; readonly error: string };

/** El cuerpo de `POST /rooms`: `{ config, name }`, con la configuración y el apodo validados. */
export function parseCreateBody(text: string): CreateBody {
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return { ok: false, error: 'cuerpo demasiado grande' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'no es JSON' };
  }
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'se esperaba un objeto' };
  const { config, name } = json as { config?: unknown; name?: unknown };
  if (typeof name !== 'string' || !isValidName(name.trim())) return { ok: false, error: 'apodo inválido' };
  const parsed = parseConfig(config);
  if (!parsed.ok) return { ok: false, error: `configuración inválida: ${parsed.errors.slice(0, 3).join('; ')}` };
  return { ok: true, config: parsed.config, name: name.trim() };
}

/** Una respuesta JSON. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
