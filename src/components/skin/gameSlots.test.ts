import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AttemptsMeterProps, ComparisonMediaProps, EngineId, ModeFrameProps, RevealListItemProps } from '@/franchises/types';
import { celebratesResult, revealListPosition, SkinAttemptsMeter, SkinComparisonMedia, SkinGameFrame, SkinRevealListItem } from './gameSlots';

const engines: readonly EngineId[] = ['image-reveal', 'text-clue', 'reveal-list', 'higher-lower'];

describe('representaciones opcionales de opciones y eslabones', () => {
  const entity: ComparisonMediaProps['entity'] = { id: 'sample', name: { es: 'Sample' }, aliases: [], series: ['one'], attrs: { power: 3 } };
  it.each([undefined, false])('sin opt-in (%s) conserva el HTML original y no monta slots', (flag) => {
    const ComparisonMedia = vi.fn(() => h('span', null, 'custom'));
    const RevealListItem = vi.fn(() => h('span', null, 'custom'));
    const children = h(Fragment, null, h('span', { 'aria-hidden': true }, '1'), h('span', { 'data-part': 'text' }, 'original'));
    const original = renderToStaticMarkup(children);
    expect(renderToStaticMarkup(SkinComparisonMedia({ skin: { customComparisonMedia: flag, slots: { ComparisonMedia } }, entity, metric: 'power', revealed: false, children }))).toBe(original);
    expect(renderToStaticMarkup(SkinRevealListItem({ skin: { customRevealListItems: flag, slots: { RevealListItem } }, position: 1, revealed: false, children }))).toBe(original);
    expect(ComparisonMedia).not.toHaveBeenCalled();
    expect(RevealListItem).not.toHaveBeenCalled();
  });
  it('la opción recibe entidad, métrica y estado de revelación sin cambiar el botón', () => {
    const ComparisonMedia = vi.fn((props: ComparisonMediaProps) => h('span', { 'data-metric': props.metric }, props.entity.name.es));
    const html = renderToStaticMarkup(SkinComparisonMedia({ skin: { customComparisonMedia: true, slots: { ComparisonMedia } }, entity, metric: 'power', revealed: false, children: h('img', { alt: '' }) }));
    expect(html).toBe('<span data-metric="power">Sample</span>');
    expect(ComparisonMedia.mock.calls[0][0]).toEqual({ entity, metric: 'power', revealed: false });
  });
  it.each([false, true])('un eslabón revelado=%s solo entrega texto cuando está desbloqueado', (revealed) => {
    const RevealListItem = vi.fn((props: RevealListItemProps) => h('span', null, props.text ?? 'hidden'));
    renderToStaticMarkup(SkinRevealListItem({ skin: { customRevealListItems: true, slots: { RevealListItem } }, position: 2, text: 'secret', revealed, children: 'original' }));
    expect(RevealListItem.mock.calls[0][0]).toEqual({ position: 2, text: revealed ? 'secret' : undefined, revealed });
  });
});

describe('slots adicionales: opt-in sin DOM por defecto', () => {
  it.each(engines)('%s: sin opt-in conserva exactamente hijos, atributos y orden', (engine) => {
    const Frame = vi.fn(({ children }: ModeFrameProps) => h('section', null, children));
    const Meter = vi.fn(() => h('aside'));
    const children = h(Fragment, null, h('button', { 'data-part': 'input' }, 'Input'), h('ol', null, h('li', { 'data-revealed': 'true' }, 'Clue')));
    const plain = renderToStaticMarkup(children);
    for (const inactive of [undefined, []]) {
      expect(renderToStaticMarkup(SkinGameFrame({ skin: { additionalModeFrames: inactive, slots: { ModeFrame: Frame } }, engine, mode: 'test', children }))).toBe(plain);
      expect(renderToStaticMarkup(h(SkinAttemptsMeter, { skin: { additionalAttemptsMeters: inactive, slots: { AttemptsMeter: Meter } }, engine, failed: 2, won: false }))).toBe('');
    }
    expect(Frame).not.toHaveBeenCalled();
    expect(Meter).not.toHaveBeenCalled();
  });

  it.each(engines)('%s: monta solo el slot solicitado y entrega sus datos reales', (engine) => {
    const Frame = vi.fn(({ children, engine: received, mode }: ModeFrameProps) => h('section', { 'data-engine': received, 'data-mode': mode }, children));
    const Meter = vi.fn(({ failed, won, total }: AttemptsMeterProps) => h('aside', { 'data-failed': failed, 'data-won': won, 'data-total': total }));
    expect(renderToStaticMarkup(SkinGameFrame({ skin: { additionalModeFrames: [engine], slots: { ModeFrame: Frame } }, engine, mode: 'test', children: h('button', null, 'Input') }))).toBe(`<section data-engine="${engine}" data-mode="test"><button>Input</button></section>`);
    for (const total of [undefined, 1, 6]) {
      renderToStaticMarkup(h(SkinAttemptsMeter, { skin: { additionalAttemptsMeters: [engine], slots: { AttemptsMeter: Meter } }, engine, failed: 2, won: true, ...(total === undefined ? {} : { total }) }));
      const props = Meter.mock.calls.at(-1)![0];
      expect(props).toEqual(total === undefined ? { failed: 2, won: true } : { failed: 2, won: true, total });
    }
  });

  it('no activa otro motor por estar en una lista distinta', () => {
    const Frame = vi.fn(() => h('section'));
    const Meter = vi.fn(() => h('aside'));
    expect(renderToStaticMarkup(SkinGameFrame({ skin: { additionalModeFrames: ['classic'], slots: { ModeFrame: Frame } }, engine: 'text-clue', mode: 'test', children: 'unchanged' }))).toBe('unchanged');
    expect(renderToStaticMarkup(h(SkinAttemptsMeter, { skin: { additionalAttemptsMeters: ['timeline'], slots: { AttemptsMeter: Meter } }, engine: 'image-reveal', failed: 0, won: false }))).toBe('');
    expect(Frame).not.toHaveBeenCalled();
    expect(Meter).not.toHaveBeenCalled();
  });
});

describe('posición y celebración opcionales', () => {
  it('conserva el número sin prefijo y agrega el prefijo sin alterar la posición', () => {
    expect(revealListPosition(2)).toBe(2);
    expect(revealListPosition(2, '')).toBe(2);
    expect(revealListPosition(2, 'Chain')).toBe('Chain 2');
  });
  it.each([undefined, false, true])('la bandera %s no altera victorias y derrotas sin puntaje', (flag) => {
    expect(celebratesResult(true, false, { celebrateScoredResults: flag })).toBe(true);
    expect(celebratesResult(false, false, { celebrateScoredResults: flag })).toBe(false);
    expect(celebratesResult(false, true, { celebrateScoredResults: flag })).toBe(false);
  });
  it('un resumen por puntaje solo festeja si se pide expresamente', () => {
    expect(celebratesResult(true, true, {})).toBe(false);
    expect(celebratesResult(true, true, { celebrateScoredResults: false })).toBe(false);
    expect(celebratesResult(true, true, { celebrateScoredResults: true })).toBe(true);
  });
});
