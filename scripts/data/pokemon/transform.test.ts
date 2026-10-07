import { describe, expect, it } from 'vitest';
import type { ChainLink, PokemonData, Species } from './schemas.ts';
import {
  baseStats,
  buildDexContent,
  buildEntity,
  capitalizeFirst,
  cleanFlavorText,
  evolutionStages,
  generationNumber,
  imageStem,
  leaksName,
  mainAbilityUrl,
  maskName,
  nameVariants,
  pickFlavorText,
} from './transform.ts';

const flavor = (text: string, version: string, id: number, language = 'es') => ({
  flavor_text: text,
  language: { name: language },
  version: { name: version, url: `https://pokeapi.co/api/v2/version/${id}/` },
});

function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 1,
    name: 'bulbasaur',
    names: [
      { name: 'Bulbasaur', language: { name: 'es' } },
      { name: 'Bulbasaur', language: { name: 'en' } },
    ],
    generation: { name: 'generation-i' },
    color: { name: 'green', url: 'https://pokeapi.co/api/v2/pokemon-color/5/' },
    habitat: { name: 'grassland', url: 'https://pokeapi.co/api/v2/pokemon-habitat/3/' },
    egg_groups: [
      { name: 'monster', url: 'https://pokeapi.co/api/v2/egg-group/1/' },
      { name: 'plant', url: 'https://pokeapi.co/api/v2/egg-group/7/' },
    ],
    evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' },
    flavor_text_entries: [flavor('Una semilla\nde BULBASAUR.', 'shield', 34)],
    varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' } }],
    ...overrides,
  };
}

function makePokemon(overrides: Partial<PokemonData> = {}): PokemonData {
  return {
    id: 1,
    name: 'bulbasaur',
    height: 7,
    weight: 69,
    types: [
      { slot: 2, type: { name: 'poison', url: 'https://pokeapi.co/api/v2/type/4/' } },
      { slot: 1, type: { name: 'grass', url: 'https://pokeapi.co/api/v2/type/12/' } },
    ],
    abilities: [
      { ability: { name: 'chlorophyll', url: 'https://pokeapi.co/api/v2/ability/34/' }, is_hidden: true, slot: 3 },
      { ability: { name: 'overgrow', url: 'https://pokeapi.co/api/v2/ability/65/' }, is_hidden: false, slot: 1 },
    ],
    stats: [
      { base_stat: 45, stat: { name: 'hp' } },
      { base_stat: 49, stat: { name: 'attack' } },
      { base_stat: 49, stat: { name: 'defense' } },
      { base_stat: 65, stat: { name: 'special-attack' } },
      { base_stat: 65, stat: { name: 'special-defense' } },
      { base_stat: 45, stat: { name: 'speed' } },
    ],
    sprites: {},
    ...overrides,
  };
}

const spanishNames: Record<string, string> = {
  'https://pokeapi.co/api/v2/type/12/': 'Planta',
  'https://pokeapi.co/api/v2/type/4/': 'Veneno',
  'https://pokeapi.co/api/v2/pokemon-color/5/': 'Verde',
  'https://pokeapi.co/api/v2/pokemon-habitat/3/': 'pradera',
  'https://pokeapi.co/api/v2/egg-group/1/': 'Monstruo',
  'https://pokeapi.co/api/v2/egg-group/7/': 'Planta',
  'https://pokeapi.co/api/v2/ability/65/': 'Espesura',
  'https://pokeapi.co/api/v2/ability/34/': 'Clorofila',
};
const spanish = (url: string) => {
  const name = spanishNames[url];
  if (name === undefined) throw new Error(`sin traducción: ${url}`);
  return name;
};

describe('generación y nombres', () => {
  it('traduce las 9 generaciones', () => {
    const names = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'].map((n) => `generation-${n}`);
    expect(names.map(generationNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('falla ante una generación desconocida', () => {
    expect(() => generationNumber('generation-x')).toThrow();
  });

  it('capitaliza la primera letra sin tocar el resto', () => {
    expect(capitalizeFirst('caverna')).toBe('Caverna');
    expect(capitalizeFirst('agua salada')).toBe('Agua salada');
    expect(capitalizeFirst('Hada')).toBe('Hada');
    expect(capitalizeFirst('')).toBe('');
  });
});

describe('cleanFlavorText', () => {
  it('une las líneas y colapsa espacios', () => {
    expect(cleanFlavorText('Desde que nace,\ncrece  alimentándose\fde la semilla.')).toBe(
      'Desde que nace, crece alimentándose de la semilla.',
    );
  });

  it('quita los guiones suaves sin dejar espacios', () => {
    expect(cleanFlavorText('ali­men­tándose')).toBe('alimentándose');
  });

  it('recorta los extremos', () => {
    expect(cleanFlavorText('  hola \n')).toBe('hola');
  });
});

describe('pickFlavorText', () => {
  it('elige la versión más reciente con texto en español', () => {
    const picked = pickFlavorText([
      flavor('Texto viejo.', 'red', 1),
      flavor('Texto nuevo.', 'violet', 41),
      flavor('Texto medio.', 'sword', 33),
      flavor('English text.', 'scarlet', 40, 'en'),
    ]);
    expect(picked).toEqual({ text: 'Texto nuevo.', version: 'violet' });
  });

  it('no depende del orden de las entradas', () => {
    const entries = [flavor('A.', 'x', 5), flavor('B.', 'y', 9), flavor('C.', 'z', 2)];
    expect(pickFlavorText(entries)).toEqual(pickFlavorText([...entries].reverse()));
  });

  it('ignora los textos vacíos y devuelve undefined si no hay ninguno en español', () => {
    expect(pickFlavorText([flavor(' \n ', 'sword', 33)])).toBeUndefined();
    expect(pickFlavorText([flavor('English only.', 'sword', 33, 'en')])).toBeUndefined();
    expect(pickFlavorText([])).toBeUndefined();
  });

  it('devuelve el texto ya limpio', () => {
    expect(pickFlavorText([flavor('Una\nlínea.', 'sword', 33)])?.text).toBe('Una línea.');
  });
});

describe('maskName', () => {
  it('reemplaza el nombre sin distinguir mayúsculas', () => {
    expect(maskName('BULBASAUR duerme. Bulbasaur sueña.', ['Bulbasaur'])).toBe('??? duerme. ??? sueña.');
  });

  it('no distingue acentos', () => {
    expect(maskName('FLABEBE y Flabébé bailan.', ['Flabébé'])).toBe('??? y ??? bailan.');
    expect(maskName('FLABÉBÉ baila.', ['Flabebe'])).toBe('??? baila.');
  });

  it('solo reemplaza palabras completas', () => {
    expect(maskName('Abra usa un abrazo con Abra.', ['Abra'])).toBe('??? usa un abrazo con ???.');
    expect(maskName('Mewtwo desciende de Mew.', ['Mew'])).toBe('Mewtwo desciende de ???.');
  });

  it('funciona con nombres de varias palabras y puntuación', () => {
    expect(maskName('MR. MIME hace mimos.', ['Mr. Mime'])).toBe('??? hace mimos.');
    expect(maskName("Farfetch'd lleva un puerro.", ["Farfetch'd"])).toBe('??? lleva un puerro.');
    expect(maskName('HO-OH vuela.', ['Ho-Oh'])).toBe('??? vuela.');
  });

  it('con varios nombres gana el más largo', () => {
    expect(maskName('Mr. Mime y Mime Jr.', ['Mr. Mime', 'Mime'])).toBe('??? y ??? Jr.');
  });

  it('usa los nombres alternativos que se le pasan', () => {
    expect(maskName('Bulbasaur y Bulbizarre', ['Bulbasaur', 'Bulbizarre'])).toBe('??? y ???');
  });

  it('no toca un texto que no contiene el nombre', () => {
    expect(maskName('Un Pokémon muy tranquilo.', ['Pikachu'])).toBe('Un Pokémon muy tranquilo.');
  });

  it('conserva el resto del texto idéntico, con sus acentos', () => {
    expect(maskName('Su cola brilla; PIKACHU está feliz.', ['Pikachu'])).toBe('Su cola brilla; ??? está feliz.');
  });

  it('un nombre sin ningún carácter útil no hace nada', () => {
    expect(maskName('Hola.', [''])).toBe('Hola.');
  });
});

describe('nameVariants', () => {
  it('incluye el nombre, sin ♀/♂ y con espacios en vez de guiones', () => {
    expect(nameVariants(['Nidoran♀'])).toEqual(expect.arrayContaining(['Nidoran♀', 'Nidoran']));
    expect(nameVariants(['porygon-z'])).toEqual(expect.arrayContaining(['porygon-z', 'porygon z']));
  });

  it('permite enmascarar Nidoran aunque el texto no lleve el símbolo', () => {
    expect(maskName('NIDORAN es pequeño.', nameVariants(['Nidoran♀']))).toBe('??? es pequeño.');
  });

  it('no deja variantes vacías', () => {
    expect(nameVariants(['♀'])).not.toContain('');
  });
});

describe('leaksName', () => {
  it('detecta el nombre como palabra completa, sin importar mayúsculas ni acentos', () => {
    expect(leaksName('El gran PIKACHU llegó.', ['Pikachu'])).toBe(true);
    expect(leaksName('FLABEBE baila.', ['Flabébé'])).toBe(true);
  });

  it('no se confunde con palabras que lo contienen', () => {
    expect(leaksName('Un abrazo.', ['Abra'])).toBe(false);
    expect(leaksName('Mewtwo.', ['Mew'])).toBe(false);
  });

  it('concuerda con maskName: tras enmascarar ya no hay filtración', () => {
    const names = nameVariants(['Mr. Mime', 'mr-mime']);
    for (const text of ['MR. MIME baila.', 'Se parece a Mr. Mime, o a MR.MIME.', 'Sin nombre.']) {
      expect(leaksName(maskName(text, names), names)).toBe(false);
    }
  });
});

describe('evolutionStages', () => {
  const link = (name: string, ...next: ChainLink[]): ChainLink => ({ species: { name }, evolves_to: next });

  it('cadena lineal: 1, 2, 3', () => {
    const stages = evolutionStages(link('charmander', link('charmeleon', link('charizard'))));
    expect([...stages]).toEqual([
      ['charmander', 1],
      ['charmeleon', 2],
      ['charizard', 3],
    ]);
  });

  it('cadena sin evoluciones: etapa 1', () => {
    expect(evolutionStages(link('tauros')).get('tauros')).toBe(1);
  });

  it('cadena ramificada: todas las ramas están en la misma etapa', () => {
    const stages = evolutionStages(link('eevee', link('vaporeon'), link('jolteon'), link('flareon')));
    expect(stages.get('eevee')).toBe(1);
    expect(['vaporeon', 'jolteon', 'flareon'].map((name) => stages.get(name))).toEqual([2, 2, 2]);
  });

  it('un bebé es la etapa 1 de su cadena aunque sea de una generación posterior', () => {
    const stages = evolutionStages(link('pichu', link('pikachu', link('raichu'))));
    expect(stages.get('pichu')).toBe(1);
    expect(stages.get('pikachu')).toBe(2);
    expect(stages.get('raichu')).toBe(3);
  });
});

describe('atributos', () => {
  it('la habilidad principal es la primera no oculta', () => {
    expect(mainAbilityUrl(makePokemon().abilities)).toBe('https://pokeapi.co/api/v2/ability/65/');
  });

  it('si todas son ocultas, usa la de menor slot', () => {
    const abilities = [
      { ability: { name: 'b', url: 'https://x/b' }, is_hidden: true, slot: 3 },
      { ability: { name: 'a', url: 'https://x/a' }, is_hidden: true, slot: 2 },
    ];
    expect(mainAbilityUrl(abilities)).toBe('https://x/a');
  });

  it('las estadísticas base salen con claves en español y su total', () => {
    expect(baseStats(makePokemon().stats)).toEqual({
      ps: 45,
      ataque: 49,
      defensa: 49,
      ataqueEspecial: 65,
      defensaEspecial: 65,
      velocidad: 45,
      totalEstadisticas: 318,
    });
  });

  it('falla si falta una estadística', () => {
    expect(() => baseStats(makePokemon().stats.slice(1))).toThrow();
  });
});

describe('buildEntity', () => {
  const entity = buildEntity({ species: makeSpecies(), pokemon: makePokemon(), stage: 1, spanish });

  it('arma la identidad', () => {
    expect(entity.id).toBe('bulbasaur');
    expect(entity.name).toEqual({ es: 'Bulbasaur', en: 'Bulbasaur' });
    expect(entity.series).toEqual(['g1']);
    expect(entity.image).toBe('pokemon/bulbasaur');
    expect(imageStem('mr-mime')).toBe('pokemon/mr-mime');
  });

  it('arma los atributos del Clásico', () => {
    expect(entity.attrs).toMatchObject({
      tipo1: 'Planta',
      tipo2: 'Veneno',
      generacion: 1,
      colores: ['Verde'],
      etapa: 1,
      altura: 0.7,
      peso: 6.9,
      habitat: 'Pradera',
      gruposHuevo: ['Monstruo', 'Planta'],
      habilidad: 'Espesura',
      totalEstadisticas: 318,
    });
  });

  it('ordena los tipos por slot, no por el orden de la respuesta', () => {
    expect(entity.attrs.tipo1).toBe('Planta');
    expect(entity.attrs.tipo2).toBe('Veneno');
  });

  it('sin segundo tipo, tipo2 es null', () => {
    const single = buildEntity({
      species: makeSpecies(),
      pokemon: makePokemon({ types: [{ slot: 1, type: { name: 'grass', url: 'https://pokeapi.co/api/v2/type/12/' } }] }),
      stage: 1,
      spanish,
    });
    expect(single.attrs.tipo2).toBeNull();
  });

  it('sin hábitat en la API, habitat es null', () => {
    const noHabitat = buildEntity({ species: makeSpecies({ habitat: null }), pokemon: makePokemon(), stage: 1, spanish });
    expect(noHabitat.attrs.habitat).toBeNull();
  });

  it('la serie es g<generación>', () => {
    const gen9 = buildEntity({
      species: makeSpecies({ generation: { name: 'generation-ix' } }),
      pokemon: makePokemon(),
      stage: 2,
      spanish,
    });
    expect(gen9.series).toEqual(['g9']);
    expect(gen9.attrs.generacion).toBe(9);
    expect(gen9.attrs.etapa).toBe(2);
  });

  it('los alias son el nombre en inglés y el id, sin repetir el nombre en español', () => {
    const mrMime = buildEntity({
      species: makeSpecies({
        name: 'mr-mime',
        names: [
          { name: 'Mr. Mime', language: { name: 'es' } },
          { name: 'Mr. Mime', language: { name: 'en' } },
        ],
      }),
      pokemon: makePokemon(),
      stage: 2,
      spanish,
    });
    expect(mrMime.aliases).toEqual(['mr-mime']);

    const farfetchd = buildEntity({
      species: makeSpecies({
        name: 'farfetchd',
        names: [
          { name: "Farfetch'd", language: { name: 'es' } },
          { name: "Farfetch'd", language: { name: 'en' } },
        ],
      }),
      pokemon: makePokemon(),
      stage: 1,
      spanish,
    });
    expect(farfetchd.aliases).toEqual(['farfetchd']);
    expect(entity.aliases).toEqual([]);
  });

  it('un nombre con apóstrofo tipográfico también se ofrece con el del teclado', () => {
    const farfetchd = buildEntity({
      species: makeSpecies({
        name: 'farfetchd',
        names: [
          { name: 'Farfetch’d', language: { name: 'es' } },
          { name: 'Farfetch’d', language: { name: 'en' } },
        ],
      }),
      pokemon: makePokemon(),
      stage: 1,
      spanish,
    });
    expect(farfetchd.name.es).toBe('Farfetch’d');
    expect(farfetchd.aliases).toEqual(["Farfetch'd", 'farfetchd']);
  });

  it('si falta el nombre en español usa el inglés', () => {
    const noSpanish = buildEntity({
      species: makeSpecies({ names: [{ name: 'Bulbasaur', language: { name: 'en' } }] }),
      pokemon: makePokemon(),
      stage: 1,
      spanish,
    });
    expect(noSpanish.name.es).toBe('Bulbasaur');
  });
});

describe('buildDexContent', () => {
  const species = makeSpecies();
  const entity = buildEntity({ species, pokemon: makePokemon(), stage: 1, spanish });

  it('arma el contenido con el nombre enmascarado', () => {
    expect(buildDexContent(species, entity)).toEqual({
      id: 'dex-bulbasaur',
      kind: 'dex',
      entityId: 'bulbasaur',
      series: 'g1',
      payload: { text: 'Una semilla de ???.', version: 'shield' },
      verified: true,
    });
  });

  it('sin texto en español no hay contenido', () => {
    const noSpanish = makeSpecies({ flavor_text_entries: [flavor('English.', 'sword', 33, 'en')] });
    expect(buildDexContent(noSpanish, entity)).toBeUndefined();
  });

  it('enmascara también el nombre en inglés y el id', () => {
    const mixed = makeSpecies({
      names: [
        { name: 'Bulbasaur', language: { name: 'es' } },
        { name: 'Bulbizarre', language: { name: 'en' } },
      ],
      flavor_text_entries: [flavor('Bulbasaur, o BULBIZARRE.', 'sword', 33)],
    });
    const mixedEntity = buildEntity({ species: mixed, pokemon: makePokemon(), stage: 1, spanish });
    expect(buildDexContent(mixed, mixedEntity)?.payload.text).toBe('???, o ???.');
  });
});
