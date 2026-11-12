import { newRoomCode } from '../../src/versus/code';
import { PROTOCOL_VERSION } from '../../src/versus/protocol';
import type { Env } from './env';
import { corsHeaders, json, originAllowed, parseCreateBody, parseOrigins, route } from './http';

export { VersusRoom } from './room';

/** Cuántos códigos se prueban al crear una sala si alguno ya existe (casi nunca pasa: son unos 900 millones). */
const CREATE_ATTEMPTS = 5;

/**
 * El Worker de las salas del versus (docs/versus/02-arquitectura.md, "Rutas del Worker"): valida el origen, responde CORS,
 * crea salas y pasa cada WebSocket al Durable Object de su sala. Lo demás lo hace el objeto.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = parseOrigins(env.ALLOWED_ORIGINS);
    if (!originAllowed(origin, allowed)) return new Response('Forbidden', { status: 403 });
    const cors = corsHeaders(origin, allowed);

    const matched = route(request.method, url.pathname);
    if (!matched) return json({ error: 'not_found' }, 404, cors);

    switch (matched.name) {
      case 'preflight':
        return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
      case 'health':
        return json({ ok: true, protocol: PROTOCOL_VERSION }, 200, cors);
      case 'create': {
        const body = parseCreateBody(await request.text());
        if (!body.ok) return json({ error: 'bad_request', message: body.error }, 400, cors);
        for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
          const code = newRoomCode((buffer) => crypto.getRandomValues(buffer));
          const response = await env.VERSUS_ROOM.getByName(code).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, config: body.config, name: body.name }) });
          if (response.status === 201) return json(await response.json(), 201, cors);
          if (response.status !== 409) break;
        }
        return json({ error: 'unavailable' }, 503, cors);
      }
      case 'summary': {
        const response = await env.VERSUS_ROOM.getByName(matched.code).fetch('https://room/summary');
        return json(await response.json(), response.status, cors);
      }
      case 'socket': {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
        const target = new URL('https://room/ws');
        const token = url.searchParams.get('token');
        if (token) target.searchParams.set('token', token);
        return env.VERSUS_ROOM.getByName(matched.code).fetch(new Request(target, request));
      }
    }
  },
} satisfies ExportedHandler<Env>;
