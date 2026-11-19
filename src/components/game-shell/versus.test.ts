import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickDaily } from '@/engine/daily';
import { writeState, type GameState } from '@/engine/storage';
import type { Content, Entity } from '@/engine/types';
import { ClassicBoard } from '@/modes/classic/ClassicBoard';
import { HigherLowerBoard } from '@/modes/higher-lower/HigherLowerBoard';
import { MAX_ROUNDS, MAX_VERSUS_ROUNDS, playProgress, playRulesOf, winnerOf, type Round } from '@/modes/higher-lower/logic';
import { ImageRevealBoard } from '@/modes/image-reveal/ImageRevealBoard';
import { RevealListBoard } from '@/modes/reveal-list/RevealListBoard';
import { playOutcome, playRulesOf as statsRulesOf, type Assignment } from '@/modes/stat-builder/logic';
import { TextClueBoard } from '@/modes/text-clue/TextClueBoard';
import type { GameSession, VersusRules } from './types';
import { endLimit, isUnlimited } from './versus';

// Pasos 1.4 y 1.5 de docs/versus/03-fase-1-base.md: las reglas de versus en los motores. Sin `versus`, los tests de
// siempre (attempts.integration.test.ts y los de cada motor) siguen pasando sin tocarlos.

const entities: Entity[] = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, name: { es: `Entity ${i}` }, series: ['one'], aliases: [], attrs: { value: i, hp: i * 10, atk: i * 5 } }));
const base: GameSession = { franchise: 'test', mode: 'test', day: 2_100_000_000, filterKey: 'all', active: ['one'], attemptLimit: 2, onFinish: () => {} };
const unlimited: GameSession = { ...base, versus: { unlimited: true } };
const answer = entities[0];
const content: Content = { id: 'clue', kind: 'clue', series: 'one', entityId: answer.id, verified: true, payload: { text: 'Clue', items: ['One', 'Two'] } };
const candidates = [{ id: answer.id, entity: answer, contents: [content] }];

function save(session: GameSession, attempts: unknown[], result: GameState['result'] = 'playing') {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  writeState(storage, session, { attempts: attempts as string[], result });
}

afterEach(() => vi.unstubAllGlobals());

describe('endLimit', () => {
  it('sin versus devuelve el límite; con unlimited, infinito', () => {
    expect(endLimit(base, 8)).toBe(8);
    expect(isUnlimited(base)).toBe(false);
    expect(endLimit(unlimited, 8)).toBe(Infinity);
    expect(endLimit({ ...base, versus: { forgivenErrors: 2 } }, 8)).toBe(8);
  });
});

describe('unlimited en los motores de adivinar', () => {
  const renderers = {
    classic: (session: GameSession) => h(ClassicBoard, { session, pool: entities, columns: [{ key: 'value', label: 'Value', compare: 'ordered' as const }], hints: [], contents: [] }),
    text: (session: GameSession) => h(TextClueBoard, { session, config: { contentKind: 'clue', lines: [{ kind: 'content' as const, label: 'Clue', field: 'text', after: 0 }] }, candidates, options: entities }),
    list: (session: GameSession) => h(RevealListBoard, { session, config: { contentKind: 'clue', field: 'items', label: 'Clues' }, candidates, options: entities }),
  };
  for (const [engine, renderer] of Object.entries(renderers)) {
    const actual = engine === 'classic' ? pickDaily(entities, base) : answer;
    const wrong = entities.filter((entity) => entity.id !== actual.id).map((entity) => entity.id);
    it(`${engine}: no termina por intentos y el contador dice solo la cuenta`, () => {
      save(unlimited, wrong.slice(0, 12));
      const html = renderToStaticMarkup(renderer(unlimited));
      expect(html).toContain('data-over="false"');
      expect(html).toContain('Intento 13');
      expect(html).not.toContain('Intentos: ');
      // La misma partida sin versus terminó hace rato.
      save(base, wrong.slice(0, 12));
      expect(renderToStaticMarkup(renderer(base))).toContain('data-over="true"');
    });
  }

  it('imagen: no termina por fallos y la imagen queda en su último paso', () => {
    const render = (session: GameSession) => renderToStaticMarkup(h(ImageRevealBoard, {
      session,
      config: { variant: 'blur' },
      options: entities,
      candidates: [{ id: answer.id, entity: answer, images: [{ id: 'img', stem: 'test/image', width: 512, height: 512, focus: null }] }],
    }));
    const wrong = entities.slice(1).map((entity) => entity.id);
    save(unlimited, wrong.slice(0, 9));
    const html = render(unlimited);
    expect(html).toContain('data-over="false"');
    expect(html).toContain('data-step="5"');
    expect(html).toContain('Pista 6 de 6');
    expect(html).toContain('Intento 10');
    expect(html).not.toContain('Último intento');
    save(base, wrong.slice(0, 6));
    expect(render(base)).toContain('data-over="true"');
  });
});

describe('Mayor o Menor con reglas de versus', () => {
  const rounds: Round[] = Array.from({ length: 40 }, (_, i) => ({ a: entities[i % 30], b: entities[(i + 1) % 30], aValue: i % 30, bValue: (i + 1) % 30 }));
  const right = (count: number) => rounds.slice(0, count).map((round) => winnerOf(round).id);
  const miss = (round: Round) => (winnerOf(round) === round.a ? round.b.id : round.a.id);

  it('sin versus, las reglas de siempre', () => {
    expect(playRulesOf(base)).toEqual({ maxMistakes: 2, target: MAX_ROUNDS, endless: false });
    expect(playRulesOf({ ...base, practice: true })).toEqual({ maxMistakes: 2, target: undefined, endless: true });
  });

  it('Menos intentos: con 3 fallos perdonados termina en el cuarto error y suma todos los aciertos', () => {
    const rules = playRulesOf({ ...base, versus: { forgivenErrors: 3 } });
    expect(rules).toMatchObject({ maxMistakes: 4, target: undefined, endless: true });
    const picks = [...right(5), miss(rounds[5]), ...rounds.slice(6, 8).map((round) => winnerOf(round).id), miss(rounds[8]), miss(rounds[9]), ...rounds.slice(10, 15).map((round) => winnerOf(round).id)];
    expect(playProgress(picks, rounds, rules)).toEqual({ score: 12, ended: false, failedAt: null });
    expect(playProgress([...picks, miss(rounds[15])], rounds, rules)).toEqual({ score: 12, ended: true, failedAt: 15 });
    // Con 0 perdonados, el primer error termina.
    expect(playProgress([miss(rounds[0])], rounds, playRulesOf({ ...base, versus: { forgivenErrors: 0 } })).ended).toBe(true);
  });

  it('Contrarreloj y Carrera: los errores no terminan y se resuelve al llegar a la meta (sin tope de 10)', () => {
    const rules = playRulesOf({ ...base, versus: { unlimited: true, targetScore: 15 } });
    expect(rules).toMatchObject({ maxMistakes: Infinity, target: 15, endless: true });
    const wrongs = rounds.slice(0, 20).map(miss);
    expect(playProgress(wrongs, rounds, rules).ended).toBe(false);
    expect(playProgress(right(14), rounds, rules).ended).toBe(false);
    expect(playProgress(right(15), rounds, rules)).toEqual({ score: 15, ended: true, failedAt: null });
  });

  it('tope técnico de 999 jugadas', () => {
    const rules = playRulesOf({ ...base, versus: { unlimited: true, targetScore: 100 } });
    const long: Round[] = Array.from({ length: MAX_VERSUS_ROUNDS + 1 }, (_, i) => rounds[i % rounds.length]);
    expect(playProgress(long.slice(0, MAX_VERSUS_ROUNDS).map(miss), long, rules).ended).toBe(true);
  });

  it('el tablero respeta la meta y los fallos perdonados', () => {
    const render = (versus: VersusRules) => renderToStaticMarkup(h(HigherLowerBoard, { session: { ...base, attemptLimit: 1, versus }, metric: { key: 'value', label: 'Value', question: 'Higher?' }, rounds }));
    save({ ...base, versus: {} }, rounds.slice(0, 4).map(miss));
    expect(render({ unlimited: true, targetScore: 10 })).toContain('data-ended="false"');
    expect(render({ unlimited: true, targetScore: 10 })).toContain('Aciertos: 0/10');
    expect(render({ forgivenErrors: 3 })).toContain('data-ended="true"');
    expect(render({ forgivenErrors: 4 })).toContain('data-ended="false"');
    save({ ...base, versus: {} }, right(12));
    // Sin versus, a los 10 aciertos ya habría terminado; en versus sigue hasta la meta.
    expect(render({ unlimited: true, targetScore: 13 })).toContain('data-ended="false"');
    expect(render({ unlimited: true, targetScore: 12 })).toContain('data-ended="true"');
  });

  it('el fin anticipado guardado se restaura como terminado', () => {
    save({ ...base, versus: {} }, right(3), 'won');
    const html = renderToStaticMarkup(h(HigherLowerBoard, { session: { ...base, versus: { forgivenErrors: 3 } }, metric: { key: 'value', label: 'Value', question: 'Higher?' }, rounds }));
    expect(html).toContain('data-ended="true"');
  });
});

describe('Estadísticas con reglas de versus', () => {
  const pool = entities;
  const build = (total: number): Assignment[] => [{ key: 'value', entityId: `e${total}` }];

  it('sin versus, las del nivel', () => {
    expect(statsRulesOf(undefined, 500, 4)).toEqual({ target: 500, limit: 4, fixed: false });
    expect(playOutcome([build(29)], pool, { target: 10, limit: 4, fixed: false })).toEqual({ won: true, over: true });
  });

  it('Menos intentos: exactamente 3 combinaciones; superar el nivel no termina antes', () => {
    const rules = statsRulesOf({ fixedAttempts: 3 }, 10, 4);
    expect(rules).toEqual({ target: 10, limit: 3, fixed: true });
    expect(playOutcome([build(29)], pool, rules)).toEqual({ won: true, over: false });
    expect(playOutcome([build(29), build(1)], pool, rules).over).toBe(false);
    expect(playOutcome([build(29), build(1), build(2)], pool, rules)).toEqual({ won: true, over: true });
  });

  it('Contrarreloj y Carrera: ilimitadas hasta la primera que supera el objetivo', () => {
    const rules = statsRulesOf({ unlimited: true, targetTotal: 20 }, 500, 4);
    expect(rules).toEqual({ target: 20, limit: Infinity, fixed: false });
    const misses = Array.from({ length: 12 }, () => build(5));
    expect(playOutcome(misses, pool, rules)).toEqual({ won: false, over: false });
    expect(playOutcome([...misses, build(20)], pool, rules).over).toBe(false);
    expect(playOutcome([...misses, build(21)], pool, rules)).toEqual({ won: true, over: true });
  });
});
