import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, corsHeaders, originAllowed, parseCreateBody, parseOrigins, route } from '../src/http';

const clasico = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], timeLimitMs: 90_000 };

describe('orígenes', () => {
  const allowed = parseOrigins('https://animeguess.vercel.app, http://localhost:3000/');

  it('lee la lista de la variable, sin espacios ni barras finales', () => {
    expect(allowed).toEqual(['https://animeguess.vercel.app', 'http://localhost:3000']);
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins('')).toEqual([]);
  });

  it('acepta los orígenes de la lista y los pedidos sin Origin; rechaza los demás', () => {
    expect(originAllowed('https://animeguess.vercel.app', allowed)).toBe(true);
    expect(originAllowed('http://localhost:3000', allowed)).toBe(true);
    expect(originAllowed(null, allowed)).toBe(true);
    expect(originAllowed('https://ejemplo.com', allowed)).toBe(false);
    expect(originAllowed('https://animeguess.vercel.app.evil.com', allowed)).toBe(false);
    expect(originAllowed('null', allowed)).toBe(false);
  });

  it('CORS solo para los orígenes permitidos', () => {
    expect(corsHeaders('https://animeguess.vercel.app', allowed)).toEqual({ 'Access-Control-Allow-Origin': 'https://animeguess.vercel.app', Vary: 'Origin' });
    expect(corsHeaders(null, allowed)).toEqual({});
    expect(corsHeaders('https://ejemplo.com', allowed)).toEqual({});
  });
});

describe('rutas', () => {
  it('reconoce las rutas del Worker', () => {
    expect(route('GET', '/health')).toEqual({ name: 'health' });
    expect(route('POST', '/rooms')).toEqual({ name: 'create' });
    expect(route('GET', '/rooms/K7P2QX')).toEqual({ name: 'summary', code: 'K7P2QX' });
    expect(route('GET', '/rooms/K7P2QX/ws')).toEqual({ name: 'socket', code: 'K7P2QX' });
    expect(route('OPTIONS', '/rooms')).toEqual({ name: 'preflight' });
  });

  it('el resto es 404: otros métodos, códigos mal formados y rutas que no existen', () => {
    expect(route('POST', '/health')).toBeNull();
    expect(route('GET', '/rooms')).toBeNull();
    expect(route('GET', '/rooms/k7p2qx')).toBeNull();
    expect(route('GET', '/rooms/K7P2Q0')).toBeNull();
    expect(route('GET', '/rooms/K7P2QX/ws/extra')).toBeNull();
    expect(route('DELETE', '/rooms/K7P2QX')).toBeNull();
    expect(route('GET', '/adopt')).toBeNull();
    expect(route('POST', '/init')).toBeNull();
    expect(route('GET', '/summary')).toBeNull();
  });
});

describe('crear sala', () => {
  it('acepta una configuración válida y un apodo, y los limpia', () => {
    const body = parseCreateBody(JSON.stringify({ config: { modality: 'timeAttack', partidas: [clasico] }, name: '  Ana ' }));
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.name).toBe('Ana');
      expect(body.config.options.higherLowerTarget).toBe(10);
    }
  });

  it('rechaza lo que no es JSON, un apodo inválido y una configuración inválida', () => {
    const rejected = (text: string) => parseCreateBody(text).ok;
    expect(rejected('no es json')).toBe(false);
    expect(rejected('null')).toBe(false);
    expect(rejected(JSON.stringify({ config: { modality: 'timeAttack', partidas: [clasico] } }))).toBe(false);
    expect(rejected(JSON.stringify({ config: { modality: 'timeAttack', partidas: [clasico] }, name: 'a'.repeat(17) }))).toBe(false);
    expect(rejected(JSON.stringify({ config: { modality: 'timeAttack', partidas: [clasico] }, name: 'Ana\nBeto' }))).toBe(false);
    expect(rejected(JSON.stringify({ config: { modality: 'timeAttack', partidas: [] }, name: 'Ana' }))).toBe(false);
    expect(rejected(JSON.stringify({ config: { modality: 'timeAttack', partidas: [{ ...clasico, timeLimitMs: undefined }] }, name: 'Ana' }))).toBe(false);
    expect(rejected(JSON.stringify({ name: 'Ana' }))).toBe(false);
  });

  it('rechaza un cuerpo de más de 4 KB', () => {
    const body = parseCreateBody(JSON.stringify({ config: { modality: 'race', partidas: [clasico] }, name: 'Ana', relleno: 'x'.repeat(MAX_BODY_BYTES) }));
    expect(body).toEqual({ ok: false, error: 'cuerpo demasiado grande' });
  });
});
