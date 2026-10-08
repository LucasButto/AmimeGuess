import { describe, expect, it } from 'vitest';
import type { ArcsFile, CharacterSrc, GroupSrc, TeamSrc, Translations } from './schemas.ts';
import {
  arcOfEpisode,
  arcRanks,
  asList,
  buildCharacterEntity,
  buildEmojiContent,
  buildEyeContents,
  buildGroupContent,
  buildQuoteContent,
  buildTeamContents,
  cleanList,
  cleanValue,
  countBoards,
  deriveAttributes,
  jutsuTypesOf,
  leaksName,
  parseDebut,
  parseJutsuInfo,
  pickOccupation,
  sharedMembers,
  translateList,
} from './transform.ts';

describe('cleanValue', () => {
  it('quita las notas de medio entre paréntesis, los espacios raros y los espacios de más', () => {
    expect(cleanValue('Root  (Anime only)')).toBe('Root');
    expect(cleanValue('Land of Ancestors  (Anime only)')).toBe('Land of Ancestors');
    expect(cleanValue('Wind Release (Affinity; Anime only)')).toBe('Wind Release');
    expect(cleanValue('  Konohagakure ')).toBe('Konohagakure');
  });

  it('deja las notas que cambian el sentido ("ex")', () => {
    expect(cleanValue('Anbu Captain  (Former)')).toBe('Anbu Captain (Former)');
  });

  it('se queda con lo que va antes del mensaje de error de la wiki que se cuela en algunos campos', () => {
    const noise = 'Ame Orphans"Ame Orphans" is not in the list (Allied Shinobi Forces, Akatsuki) of allowed values for the "affiliation" property.';
    expect(cleanValue(noise)).toBe('Ame Orphans');
  });

  it('un valor vacío da null', () => {
    expect(cleanValue('   ')).toBeNull();
    expect(cleanValue('(Anime only)')).toBeNull();
  });
});

describe('cleanList y asList', () => {
  it('limpia y no repite, conservando el orden', () => {
    expect(cleanList(['Root', 'Root  (Anime only)', 'Akatsuki'])).toEqual(['Root', 'Akatsuki']);
  });

  it('un texto suelto es una lista de uno; sin valor, vacía', () => {
    expect(asList('Byakugan')).toEqual(['Byakugan']);
    expect(asList(['a', 'b'])).toEqual(['a', 'b']);
    expect(asList(undefined)).toEqual([]);
  });
});

describe('parseDebut', () => {
  it('lee la serie y el episodio', () => {
    expect(parseDebut('Naruto Episode #1')).toEqual({ series: 'naruto', episode: 1 });
    expect(parseDebut('Naruto Shippūden Episode #128')).toEqual({ series: 'shippuden', episode: 128 });
    expect(parseDebut('Boruto Episode #157')).toEqual({ series: 'boruto', episode: 157 });
  });

  it('sin episodio, null', () => {
    expect(parseDebut(undefined)).toBeNull();
    expect(parseDebut('Naruto Chapter #34')).toBeNull();
  });
});

describe('pickOccupation', () => {
  it('toma la última sin nota: la más reciente', () => {
    expect(pickOccupation(['Anbu Captain  (Former)', 'Third Division Commander', 'Hokage', 'Genin Exams Proctor  (Anime only)'])).toBe('Hokage');
  });

  it('si todas llevan nota, la última que es "ex"; las de un solo medio no cuentan', () => {
    expect(pickOccupation(['Academy Teacher  (Anime only)', 'Heiress  (Former)'])).toBe('Heiress  (Former)');
    expect(pickOccupation(['Academy Teacher  (Anime only)'])).toBeNull();
    expect(pickOccupation([])).toBeNull();
  });
});

describe('translateList', () => {
  const dictionary = { 'Fire Release': 'Fuego', 'Wood Release': null, 'Wind Release': 'Viento' };

  it('traduce, ignora lo que está en null y no repite', () => {
    expect(translateList(['Fire Release', 'Wood Release', 'Fire Release'], dictionary)).toEqual({ translated: ['Fuego'], unknown: [] });
  });

  it('devuelve lo que no está en el diccionario, para que el build falle con la lista completa', () => {
    expect(translateList(['Fire Release', 'Dust Release'], dictionary)).toEqual({ translated: ['Fuego'], unknown: ['Dust Release'] });
  });

  it('limpia los valores antes de buscarlos', () => {
    expect(translateList(['Wind Release (Affinity)'], dictionary).translated).toEqual(['Viento']);
  });
});

describe('parseJutsuInfo', () => {
  const WIKITEXT = `{{Infobox/Jutsu
|image=Rasengan.png;Una leyenda
|users=<!--No agregar a Asura-->Boruto Uzumaki, Naruto Uzumaki, Hidari~manga, Kiba Inuzuka~~with~Akamaru, Kakashi Hatake~game
|jutsu classification=Kekkei Genkai~Mangekyō Sharingan, Ninjutsu, Shape Transformation
|debut anime=86
|debut shippuden=No
|boruto anime=No
}}`;

  it('lee la clasificación sin las notas "~…"', () => {
    expect(parseJutsuInfo(WIKITEXT).classification).toEqual(['Kekkei Genkai', 'Ninjutsu', 'Shape Transformation']);
  });

  it('lee el archivo de la imagen sin la leyenda', () => {
    expect(parseJutsuInfo(WIKITEXT).image).toBe('Rasengan.png');
  });

  it('marca como "con nota" a los usuarios de un solo medio, pero no a los que van en pareja con otro', () => {
    const users = parseJutsuInfo(WIKITEXT).users;
    expect(users.map((user) => user.name)).toEqual(['Boruto Uzumaki', 'Naruto Uzumaki', 'Hidari', 'Kiba Inuzuka', 'Kakashi Hatake']);
    expect(users.map((user) => user.tagged)).toEqual([false, false, true, false, true]);
  });

  it('la serie sale de las marcas: el número de episodio es de Shippūden si `debut shippuden` es Yes', () => {
    expect(parseJutsuInfo(WIKITEXT).debutSeries).toBe('naruto');
    expect(parseJutsuInfo('|debut anime=29\n|debut shippuden=Yes\n|boruto anime=No').debutSeries).toBe('shippuden');
    expect(parseJutsuInfo('|debut anime=12\n|debut shippuden=No\n|boruto anime=Yes').debutSeries).toBe('boruto');
    expect(parseJutsuInfo('|debut anime=No\n|debut shippuden=No').debutSeries).toBeNull();
  });

  it('sin infobox, todo vacío', () => {
    expect(parseJutsuInfo('Solo texto')).toEqual({ classification: [], image: null, users: [], debutSeries: null });
  });
});

describe('jutsuTypesOf', () => {
  const order = ['Ninjutsu', 'Taijutsu', 'Genjutsu'];

  it('cuenta un tipo solo si al menos dos jutsu lo tienen', () => {
    expect(jutsuTypesOf([['Ninjutsu'], ['Ninjutsu', 'Taijutsu'], ['Genjutsu']], order)).toEqual(['Ninjutsu']);
  });

  it('un jutsu con el mismo tipo repetido cuenta una vez, y el orden es el del diccionario', () => {
    expect(jutsuTypesOf([['Taijutsu', 'Taijutsu'], ['Taijutsu'], ['Ninjutsu'], ['Ninjutsu']], order)).toEqual(['Ninjutsu', 'Taijutsu']);
  });

  it('sin jutsu, ningún tipo', () => {
    expect(jutsuTypesOf([], order)).toEqual([]);
  });
});

const ARCS: ArcsFile = [
  { id: 'n1', name: 'N1', series: 'naruto', from: 1 },
  { id: 'n2', name: 'N2', series: 'naruto', from: 20 },
  { id: 's1', name: 'S1', series: 'shippuden', from: 1 },
  { id: 's2', name: 'S2', series: 'shippuden', from: 33 },
  { id: 'b1', name: 'B1', series: 'boruto', from: 1 },
];

describe('arcos', () => {
  it('la posición va primero por serie y después por episodio', () => {
    const ranks = arcRanks([ARCS[4], ARCS[2], ARCS[3], ARCS[0], ARCS[1]]);
    expect([...ranks].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual(['n1', 'n2', 's1', 's2', 'b1']);
  });

  it('un episodio pertenece al arco que empezó más recientemente', () => {
    expect(arcOfEpisode(ARCS, 'naruto', 1)).toBe('n1');
    expect(arcOfEpisode(ARCS, 'naruto', 19)).toBe('n1');
    expect(arcOfEpisode(ARCS, 'naruto', 20)).toBe('n2');
    expect(arcOfEpisode(ARCS, 'naruto', 220)).toBe('n2');
    expect(arcOfEpisode(ARCS, 'shippuden', 33)).toBe('s2');
    expect(arcOfEpisode(ARCS, 'boruto', 100)).toBe('b1');
  });

  it('falla si una serie no tiene arcos, si el primero no empieza en 1 o si no están en orden', () => {
    expect(() => arcRanks(ARCS.filter((arc) => arc.series !== 'boruto'))).toThrow(/boruto/);
    expect(() => arcRanks([{ ...ARCS[0], from: 2 }, ...ARCS.slice(1)])).toThrow(/episodio 1/);
    expect(() => arcRanks([ARCS[0], { ...ARCS[1], from: 1 }, ...ARCS.slice(2)])).toThrow(/orden/);
    expect(() => arcRanks([...ARCS, ARCS[0]])).toThrow(/repetido/);
  });
});

describe('leaksName', () => {
  it('detecta el nombre o un alias como palabra completa', () => {
    expect(leaksName('Soy Naruto y seré Hokage', ['Naruto Uzumaki', 'Naruto'])).toBe(true);
    expect(leaksName('Es el Séptimo Hokage', ['Séptimo Hokage'])).toBe(true);
  });

  it('no confunde con una palabra más larga ni con otros personajes', () => {
    expect(leaksName('Hokagesama dijo hola', ['Hokage'])).toBe(false);
    expect(leaksName('Sakura, sal conmigo', ['Rock Lee', 'Lee'])).toBe(false);
  });
});

const TRANSLATIONS: Translations = {
  verified: false,
  sex: { Male: 'Masculino', Female: 'Femenino', Other: null },
  status: { Deceased: 'Muerto' },
  affiliation: { Konohagakure: 'Konoha', Kara: 'Kara', 'Allied Shinobi Forces': 'Fuerzas Aliadas Shinobi' },
  classification: { 'Sensor Type': 'Sensor' },
  occupation: { Hokage: 'Hokage' },
  kekkeiGenkai: { Byakugan: 'Byakugan' },
  natureType: { 'Fire Release': 'Fuego', 'Wood Release': null },
  jutsuType: { Ninjutsu: 'Ninjutsu' },
  affiliationSeries: { Kara: 'boruto' },
};

const CHARACTER: CharacterSrc = {
  id: 'test-uno',
  name: 'Test Uno',
  aliases: ['Uno', 'test uno'],
  api: 1,
  apiName: 'Test Uno',
  series: ['naruto', 'boruto'],
  verified: false,
};

describe('deriveAttributes y buildCharacterEntity', () => {
  const api = {
    id: 1,
    name: 'Test Uno',
    natureType: ['Fire Release', 'Wood Release'],
    personal: {
      sex: 'Male',
      kekkeiGenkai: 'Byakugan',
      classification: ['Sensor Type'],
      occupation: ['Hokage'],
      affiliation: ['Konohagakure', 'Kara', 'Allied Shinobi Forces  (Anime only)'],
    },
  };

  it('traduce cada campo, ignora lo que el diccionario manda ignorar y toma un texto suelto como lista', () => {
    const { attributes, unknown } = deriveAttributes(CHARACTER, api, TRANSLATIONS, ['Ninjutsu']);
    expect(unknown).toEqual([]);
    expect(attributes).toEqual({
      genero: 'Masculino',
      afiliaciones: ['Konoha', 'Kara', 'Fuerzas Aliadas Shinobi'],
      tiposDeJutsu: ['Ninjutsu'],
      kekkeiGenkai: ['Byakugan'],
      naturalezas: ['Fuego'],
      atributos: ['Sensor'],
      estadoVital: 'Vivo',
      ocupacion: 'Hokage',
    });
  });

  it('sin estado en la API el personaje está vivo; con "Deceased", muerto', () => {
    expect(deriveAttributes(CHARACTER, api, TRANSLATIONS, []).attributes.estadoVital).toBe('Vivo');
    expect(deriveAttributes(CHARACTER, { ...api, personal: { ...api.personal, status: 'Deceased' } }, TRANSLATIONS, []).attributes.estadoVital).toBe('Muerto');
  });

  it('lo que no está en el diccionario se devuelve en `unknown`', () => {
    const { unknown } = deriveAttributes(CHARACTER, { ...api, personal: { ...api.personal, affiliation: ['Konohagakure', 'Nowhere'], sex: 'Robot' } }, TRANSLATIONS, []);
    expect(unknown).toEqual([
      { field: 'sex', value: 'Robot' },
      { field: 'affiliation', value: 'Nowhere' },
    ]);
  });

  it('un valor forzado a mano reemplaza al calculado, incluso con null', () => {
    const { attributes } = deriveAttributes({ ...CHARACTER, override: { genero: null, ocupacion: 'Maestro', estadoVital: 'Incapacitado', naturalezas: [] } }, api, TRANSLATIONS, []);
    expect(attributes.genero).toBeNull();
    expect(attributes.ocupacion).toBe('Maestro');
    expect(attributes.estadoVital).toBe('Incapacitado');
    expect(attributes.naturalezas).toEqual([]);
    expect(attributes.afiliaciones).toEqual(['Konoha', 'Kara', 'Fuerzas Aliadas Shinobi']);
  });

  it('la entidad lleva la serie en las afiliaciones que se conocen desde una serie, y las imagenes en 1 o 0', () => {
    const { attributes } = deriveAttributes(CHARACTER, api, TRANSLATIONS, []);
    const entity = buildCharacterEntity({ src: CHARACTER, attributes, arcRank: 7, translations: TRANSLATIONS, image: null });
    expect(entity.attrs.afiliaciones).toEqual(['Konoha', { value: 'Kara', series: 'boruto' }, 'Fuerzas Aliadas Shinobi']);
    expect(entity.attrs.arcoDebut).toBe(7);
    expect(entity.attrs.imagenTransparente).toBeNull();
    expect(entity.image).toBeUndefined();
    expect(entity.aliases).toEqual(['Uno']);

    const withImage = buildCharacterEntity({ src: CHARACTER, attributes, arcRank: 7, translations: TRANSLATIONS, image: { path: 'naruto/test-uno', transparent: true } });
    expect(withImage.attrs.imagenTransparente).toBe(1);
    expect(withImage.image).toBe('naruto/test-uno');
    expect(buildCharacterEntity({ src: CHARACTER, attributes, arcRank: 7, translations: TRANSLATIONS, image: { path: 'x', transparent: false } }).attrs.imagenTransparente).toBe(0);
  });
});

const team = (id: string, members: string[], answers?: string[]): TeamSrc => ({ id, name: id.toUpperCase(), members, ...(answers ? { answers } : {}), series: 'naruto', verified: false });

describe('buildTeamContents', () => {
  const name = (id: string) => `N-${id}`;

  it('un contenido por miembro que puede faltar, con los demás en el orden del equipo', () => {
    const contents = buildTeamContents([team('t', ['a', 'b', 'c'])], name);
    expect(contents.map((content) => content.entityId)).toEqual(['a', 'b', 'c']);
    expect(contents[0].payload.items).toEqual(['N-b', 'N-c']);
    expect(contents[1].payload.items).toEqual(['N-a', 'N-c']);
    expect(contents[0].id).toBe('team-t-a');
  });

  it('`answers` limita quién puede faltar, pero todos se muestran como pista', () => {
    const contents = buildTeamContents([team('t', ['a', 'b', 'c'], ['a'])], name);
    expect(contents).toHaveLength(1);
    expect(contents[0].payload.items).toEqual(['N-b', 'N-c']);
    const other = buildTeamContents([team('t', ['a', 'b', 'c', 'd'], ['a', 'b'])], name);
    expect(other[0].payload.items).toEqual(['N-b', 'N-c', 'N-d']);
  });

  it('si lo que se muestra cabe también en otro equipo, los miembros que faltan de ese otro son respuestas válidas', () => {
    const contents = buildTeamContents([team('t1', ['a', 'b', 'c']), team('t2', ['a', 'b', 'd'])], name);
    const missingC = contents.find((content) => content.id === 'team-t1-c');
    // Se ve [a, b]: en t1 falta c; en t2 falta d.
    expect(missingC?.payload.accepts).toEqual(['d']);
    expect(contents.find((content) => content.id === 'team-t1-a')?.payload.accepts).toEqual([]);
  });
});

describe('quotes, emojis y ojos', () => {
  it('la frase lleva la fuente, el destinatario y el arco; sin destinatario, no hay campo', () => {
    const quote = {
      id: 'q', character: 'a', text: 'hola', addressee: 'Ibiki', arc: 'n1', series: 'naruto' as const,
      source: 'https://naruto.fandom.com/wiki/A', verified: false,
    };
    expect(buildQuoteContent(quote, 'Arco Uno')).toEqual({
      id: 'quote-q', kind: 'quote', entityId: 'a', series: 'naruto',
      payload: { text: 'hola', source: 'https://naruto.fandom.com/wiki/A', addressee: 'Ibiki', arc: 'Arco Uno' }, verified: false,
    });
    expect(buildQuoteContent({ ...quote, addressee: null }, 'Arco Uno').payload).not.toHaveProperty('addressee');
  });

  it('un emoji de personaje es un contenido con respuesta; uno de arco, no', () => {
    expect(buildEmojiContent({ id: 'a', character: 'a', text: '🦊', series: 'naruto', verified: false })).toMatchObject({ kind: 'emoji', entityId: 'a' });
    const arc = buildEmojiContent({ id: 'arco-n1', arc: 'n1', text: '🌉', series: 'naruto', verified: false });
    expect(arc.kind).toBe('emoji-arc');
    expect(arc.entityId).toBeUndefined();
  });

  it('el ojo solo existe si el personaje tiene imagen, y usa la serie de debut', () => {
    const focus = [{ character: 'a', x: 0.4, y: 0.3, verified: false }, { character: 'b', x: 0.5, y: 0.5, verified: false }];
    const contents = buildEyeContents(focus, () => 'shippuden', (id) => id === 'a');
    expect(contents).toEqual([
      { id: 'eye-a', kind: 'eye', entityId: 'a', series: 'shippuden', payload: { image: 'naruto/a', width: 512, height: 512, focus: { x: 0.4, y: 0.3 } }, verified: false },
    ]);
  });
});

const group = (id: string, difficulty: number, members: string[]): GroupSrc => ({ id, name: id, category: 'x', difficulty, series: 'naruto', members, verified: false });

describe('grupos de Conexiones', () => {
  it('sharedMembers dice quién está en más de un grupo y en cuáles otros', () => {
    const groups = [group('g1', 1, ['a', 'b', 'c', 'd']), group('g2', 2, ['d', 'e', 'f', 'g'])];
    const shared = sharedMembers(groups);
    expect([...(shared.get('g1') as Map<string, string[]>)]).toEqual([['d', ['g2']]]);
    expect([...(shared.get('g2') as Map<string, string[]>)]).toEqual([['d', ['g1']]]);
    expect(buildGroupContent(groups[0], shared.get('g1') as Map<string, string[]>).payload.shared).toEqual({ d: ['g2'] });
  });

  const members = (prefix: string, count = 5) => Array.from({ length: count }, (_, index) => `${prefix}${index}`);

  it('un tablero lleva un grupo de cada dificultad y cada uno conserva 4 miembros que no están en los otros tres', () => {
    const groups = [group('g1', 1, members('a')), group('g2', 2, members('b')), group('g3', 3, members('c')), group('g4', 4, members('d'))];
    expect(countBoards(groups)).toBe(1);
  });

  it('sin una dificultad no hay tableros', () => {
    expect(countBoards([group('g1', 1, members('a')), group('g2', 2, members('b')), group('g3', 3, members('c'))])).toBe(0);
  });

  it('un grupo que comparte demasiados miembros con otro deja el tablero sin solución única', () => {
    // g2 tiene 5 miembros y 2 están también en g1: le quedan 3 libres, menos de 4.
    const groups = [group('g1', 1, ['a0', 'a1', 'a2', 'a3', 'a4']), group('g2', 2, ['a0', 'a1', 'b2', 'b3', 'b4']), group('g3', 3, members('c')), group('g4', 4, members('d'))];
    expect(countBoards(groups)).toBe(0);
  });

  it('con más grupos por dificultad se cuentan las combinaciones válidas', () => {
    const groups = [
      group('g1', 1, members('a')), group('g1b', 1, members('e')),
      group('g2', 2, members('b')), group('g3', 3, members('c')), group('g4', 4, members('d')), group('g4b', 4, members('f')),
    ];
    expect(countBoards(groups)).toBe(4);
  });

  it('`eligible` limita los miembros (por ejemplo, a las series activas)', () => {
    const groups = [group('g1', 1, members('a')), group('g2', 2, members('b')), group('g3', 3, members('c')), group('g4', 4, members('d'))];
    expect(countBoards(groups, (id) => !id.startsWith('d'))).toBe(0);
    expect(countBoards(groups, (id) => id !== 'a0')).toBe(1);
    expect(countBoards(groups, (id) => id !== 'a0' && id !== 'a1')).toBe(0);
  });
});
