import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickDaily } from '@/engine/daily';
import { writeState, type GameState } from '@/engine/storage';
import type { Content, Entity } from '@/engine/types';
import { ClassicBoard } from '@/modes/classic/ClassicBoard';
import { ImageRevealBoard } from '@/modes/image-reveal/ImageRevealBoard';
import { TextClueBoard } from '@/modes/text-clue/TextClueBoard';
import { RevealListBoard } from '@/modes/reveal-list/RevealListBoard';
import { HigherLowerBoard } from '@/modes/higher-lower/HigherLowerBoard';
import { ResultPanel } from './ResultPanel';
import type { GameSession } from './types';

const entities: Entity[] = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, name: { es: `Entity ${i}` }, series: ['one'], aliases: [], attrs: { value: i } }));
const session: GameSession = { franchise: 'test', mode: 'test', day: 100, filterKey: 'all', active: ['one'], attemptLimit: 2, onFinish: () => {} };
const answer = entities[0];
const content: Content = { id: 'clue', kind: 'clue', series: 'one', entityId: answer.id, verified: true, payload: { text: 'Clue', items: ['One', 'Two'] } };
const candidates = [{ id: answer.id, entity: answer, contents: [content] }];
const renderers = {
  classic: () => h(ClassicBoard, { session, pool: entities, columns: [{ key: 'value', label: 'Value', compare: 'ordered' as const }], hints: [], contents: [] }),
  image: () => h(ImageRevealBoard, { session, config: { variant: 'blur' as const }, options: entities, candidates: [{ id: answer.id, entity: answer, images: [{ id: 'img', stem: 'test/image', width: 512, height: 512, focus: null }] }] }),
  text: () => h(TextClueBoard, { session, config: { contentKind: 'clue', lines: [{ kind: 'content' as const, label: 'Clue', field: 'text', after: 0 }] }, candidates, options: entities }),
  list: () => h(RevealListBoard, { session, config: { contentKind: 'clue', field: 'items', label: 'Clues' }, candidates, options: entities }),
};

function save(attempts: string[], result: GameState['result'] = 'playing') {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
  writeState(storage, session, { attempts, result });
}

afterEach(() => vi.unstubAllGlobals());

describe('límite conectado a los motores de adivinar', () => {
  for (const [engine, renderer] of Object.entries(renderers)) {
    const actualAnswer = engine === 'classic' ? pickDaily(entities, session) : answer;
    const wrong = entities.filter((entity) => entity.id !== actualAnswer.id).map((entity) => entity.id);
    it(`${engine}: permite seguir antes del límite y cierra al agotarlo sin acertar`, () => {
      save(wrong.slice(0, 1));
      expect(renderToStaticMarkup(renderer())).toContain('data-over="false"');
      save(wrong.slice(0, 2));
      const html = renderToStaticMarkup(renderer());
      expect(html).toContain('data-over="true"');
      expect(html).toContain('data-won="false"');
      expect(html).toContain('Intentos: 2/2');
      expect(html).not.toContain('>Rendirse<');
    });
    it(`${engine}: acepta acertar en el último intento y conserva victorias anteriores más largas`, () => {
      save([wrong[0], actualAnswer.id], 'won');
      expect(renderToStaticMarkup(renderer())).toContain('data-won="true"');
      save([...wrong.slice(0, 3), actualAnswer.id], 'won');
      expect(renderToStaticMarkup(renderer())).toContain('data-won="true"');
    });
  }
});

describe('derrotas de puntaje', () => {
  it('restaura el fallo de Mayor o Menor y conserva el título del resumen', () => {
    save([entities[0].id], 'lost');
    const html = renderToStaticMarkup(h(HigherLowerBoard, { session: { ...session, attemptLimit: 1 }, metric: { key: 'value', label: 'Value', question: 'Higher?' }, rounds: [{ a: entities[0], b: entities[1], aValue: 0, bValue: 1 }] }));
    expect(html).toContain('data-ended="true"');
    expect(html).toContain('data-correct="false"');
    const summary = renderToStaticMarkup(h(ResultPanel, { won: false, attempts: 1, score: 0, answer: { label: 'Answer' }, streak: 0, getShareText: () => '' }));
    expect(summary).toContain('data-won="false"');
    expect(summary).toContain('Fin de la racha');
  });
});
