import { describe, expect, it } from 'vitest';
import {
  CARDS_PER_POKEMON,
  buildCardContent,
  cardSlug,
  cardStem,
  isPhysicalSet,
  isSinglePokemonCard,
  orderCandidates,
  pickCards,
  setIdOf,
  type CardSource,
} from './cards.ts';
import { contentSchema, type TcgCard, type TcgCardBrief } from './schemas.ts';

const brief = (id: string, localId: string): TcgCardBrief => ({
  id,
  localId,
  name: 'Pikachu',
  image: `https://assets.example/${id}`,
});

function makeCard(id: string, localId: string, overrides: Partial<TcgCard> = {}): TcgCard {
  const setId = setIdOf({ id, localId });
  return {
    id,
    localId,
    name: 'Pikachu',
    category: 'Pokémon',
    image: `https://assets.example/${id}`,
    dexId: [25],
    set: { id: setId, name: `Set ${setId}` },
    ...overrides,
  };
}

/** Un origen en memoria: `details` por id; las imágenes son el id como bytes. */
function memorySource(cards: TcgCard[], missingImages: string[] = []): CardSource {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return {
    detail: async (id) => byId.get(id) ?? null,
    image: async (card) => (missingImages.includes(card.id) ? null : Buffer.from(card.id)),
  };
}

describe('isPhysicalSet', () => {
  it('acepta los sets del juego de cartas físico', () => {
    for (const id of ['base1', 'sv06', 'sv06.5', 'sv10.5w', 'swsh12', 'svp', '2024sv', 'cel25', 'xy3', 'bw2', 'me01']) {
      expect(isPhysicalSet(id), id).toBe(true);
    }
  });

  it('descarta los sets de TCG Pocket', () => {
    for (const id of ['A1', 'A1a', 'A2b', 'A3', 'B1', 'B2a', 'P-A', 'P-B']) {
      expect(isPhysicalSet(id), id).toBe(false);
    }
  });
});

describe('setIdOf', () => {
  it('quita el número local del final', () => {
    expect(setIdOf({ id: 'sv06.5-039', localId: '039' })).toBe('sv06.5');
    expect(setIdOf({ id: 'P-A-001', localId: '001' })).toBe('P-A');
    expect(setIdOf({ id: 'swsh12.5-GG01', localId: 'GG01' })).toBe('swsh12.5');
  });

  it('si el id no termina en el número local, devuelve el id', () => {
    expect(setIdOf({ id: 'raro', localId: '7' })).toBe('raro');
  });
});

describe('isSinglePokemonCard', () => {
  it('acepta una carta de Pokémon que muestra solo a esa especie', () => {
    expect(isSinglePokemonCard(makeCard('base1-58', '58'), 25)).toBe(true);
  });

  it('descarta otra especie, las cartas de equipo y lo que no es un Pokémon', () => {
    expect(isSinglePokemonCard(makeCard('base1-58', '58'), 26)).toBe(false);
    expect(isSinglePokemonCard(makeCard('sm9-1', '1', { dexId: [25, 644] }), 25)).toBe(false);
    expect(isSinglePokemonCard(makeCard('base1-90', '90', { category: 'Entrenador', dexId: undefined }), 25)).toBe(false);
    expect(isSinglePokemonCard(makeCard('base1-99', '99', { category: 'Energía' }), 25)).toBe(false);
  });

  it('descarta las que no tienen imagen o número de Pokédex', () => {
    expect(isSinglePokemonCard(makeCard('base1-1', '1', { image: undefined }), 25)).toBe(false);
    expect(isSinglePokemonCard(makeCard('base1-2', '2', { dexId: undefined }), 25)).toBe(false);
  });

  it('reconoce la categoría sin tildes ni mayúsculas', () => {
    expect(isSinglePokemonCard(makeCard('base1-3', '3', { category: 'Pokemon' }), 25)).toBe(true);
  });
});

describe('orderCandidates', () => {
  const briefs = [
    brief('base1-58', '58'),
    brief('sv06-1', '1'),
    brief('A1-94', '94'),
    brief('P-A-001', '001'),
    { ...brief('swsh1-65', '65'), image: undefined },
    brief('xy3-9', '9'),
  ];

  it('deja solo cartas físicas con escaneo', () => {
    const ids = orderCandidates('pikachu', briefs).map((card) => card.id).sort();
    expect(ids).toEqual(['base1-58', 'sv06-1', 'xy3-9']);
  });

  it('no depende del orden del listado', () => {
    const forward = orderCandidates('pikachu', briefs).map((card) => card.id);
    const backward = orderCandidates('pikachu', [...briefs].reverse()).map((card) => card.id);
    expect(backward).toEqual(forward);
  });

  it('cada Pokémon ordena a su manera', () => {
    const many = Array.from({ length: 12 }, (_, index) => brief(`sv0${index % 9}-${index}`, String(index)));
    const a = orderCandidates('pikachu', many).map((card) => card.id);
    const b = orderCandidates('raichu', many).map((card) => card.id);
    expect(a).not.toEqual(b);
  });
});

describe('pickCards', () => {
  it('toma hasta CARDS_PER_POKEMON cartas, de sets distintos', async () => {
    const cards = [
      makeCard('base1-58', '58'),
      makeCard('base1-60', '60'),
      makeCard('sv06-1', '1'),
      makeCard('xy3-9', '9'),
    ];
    const picked = await pickCards('pikachu', 25, cards.map((card) => brief(card.id, card.localId)), memorySource(cards));

    expect(picked).toHaveLength(CARDS_PER_POKEMON);
    const sets = picked.map((pick) => pick.card.set.id);
    expect(new Set(sets).size).toBe(sets.length);
  });

  it('elige siempre las mismas con las mismas respuestas', async () => {
    const cards = ['base1-58', 'sv06-1', 'xy3-9', 'swsh4-3', 'bw2-12'].map((id) => makeCard(id, id.split('-')[1]));
    const briefs = cards.map((card) => brief(card.id, card.localId));
    const first = await pickCards('pikachu', 25, briefs, memorySource(cards));
    const again = await pickCards('pikachu', 25, [...briefs].reverse(), memorySource(cards));
    expect(again.map((pick) => pick.card.id)).toEqual(first.map((pick) => pick.card.id));
  });

  it('saltea las cartas de equipo, las que no existen y las que no tienen imagen', async () => {
    const team = makeCard('sm9-1', '1', { dexId: [25, 644] });
    const noImage = makeCard('sv06-1', '1');
    const good = makeCard('xy3-9', '9');
    const briefs = [team, noImage, good, brief('swsh4-77', '77')].map((card) => brief(card.id, card.localId));

    // swsh4-77 no tiene detalle (404) y sv06-1 no tiene archivo de imagen.
    const picked = await pickCards('pikachu', 25, briefs, memorySource([team, noImage, good], ['sv06-1']));
    expect(picked.map((pick) => pick.card.id)).toEqual(['xy3-9']);
  });

  it('con menos candidatas que las pedidas, devuelve las que haya', async () => {
    const only = makeCard('base1-58', '58');
    const picked = await pickCards('pikachu', 25, [brief(only.id, only.localId)], memorySource([only]));
    expect(picked.map((pick) => pick.card.id)).toEqual(['base1-58']);
  });

  it('sin candidatas devuelve una lista vacía', async () => {
    expect(await pickCards('pikachu', 25, [], memorySource([]))).toEqual([]);
  });

  it('no descarga la imagen de una carta que no sirve', async () => {
    const downloads: string[] = [];
    const team = makeCard('sm9-1', '1', { dexId: [25, 644] });
    const source: CardSource = {
      detail: async () => team,
      image: async (card) => {
        downloads.push(card.id);
        return Buffer.from('x');
      },
    };
    await pickCards('pikachu', 25, [brief(team.id, team.localId)], source);
    expect(downloads).toEqual([]);
  });
});

describe('contenido de la carta', () => {
  it('el nombre de archivo queda en minúsculas y sin puntos', () => {
    expect(cardSlug('sv06.5-039')).toBe('sv06-5-039');
    expect(cardSlug('swsh12.5-GG01')).toBe('swsh12-5-gg01');
    expect(cardStem('base1-58')).toBe('pokemon/cards/base1-58');
  });

  it('arma un contenido que cumple el esquema, con la serie del Pokémon', () => {
    const entity = {
      id: 'pikachu',
      name: { es: 'Pikachu', en: 'Pikachu' },
      aliases: [],
      series: ['g1'],
      image: 'pokemon/pikachu',
      attrs: {},
    };
    const content = buildCardContent(entity, makeCard('sv06.5-039', '039'), { width: 372, height: 512 });

    expect(content).toEqual({
      id: 'tcg-card-sv06-5-039',
      kind: 'tcg-card',
      entityId: 'pikachu',
      series: 'g1',
      payload: { image: 'pokemon/cards/sv06-5-039', width: 372, height: 512, cardId: 'sv06.5-039' },
      verified: true,
    });
    expect(contentSchema.safeParse(content).success).toBe(true);
  });
});
