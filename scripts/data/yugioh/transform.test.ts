import { describe, expect, it } from 'vitest';
import translationsJson from '../../../data-src/yugioh/translations.json';
import sharp from 'sharp';
import { CLEANUP, THRESHOLDS, cleanAlpha, isUsable, largestShare, measureCutout } from './silhouette.ts';
import { translationsSchema, type DuelistSrc, type YgoprodeckCard } from './schemas.ts';
import {
  acceptedSummons,
  buildAceCardContents,
  buildCardEntity,
  buildCardTextContents,
  buildDeckContents,
  buildDuelistEntity,
  buildSilhouetteContents,
  buildSummonContents,
  evidenceOf,
  firstAppearanceText,
  leaksName,
  maskName,
  orderDeck,
  orderSeries,
  pageLinks,
  parseDebut,
  parseInfobox,
  quotedMaterials,
  slugify,
  summoningOf,
  type DeckCard,
  type SummonInput,
} from './transform.ts';

const translations = translationsSchema.parse(translationsJson);

const api = (overrides: Partial<YgoprodeckCard>): YgoprodeckCard => ({
  id: 1,
  name: 'Dark Magician',
  type: 'Normal Monster',
  desc: 'x',
  race: 'Spellcaster',
  attribute: 'DARK',
  atk: 2500,
  def: 2100,
  level: 7,
  card_images: [{ id: 1, image_url: 'https://example.com/a.jpg', image_url_cropped: 'https://example.com/b.jpg' }],
  misc_info: [{ konami_id: 4041 }],
  ...overrides,
});

describe('slugify', () => {
  it('pasa el nombre oficial a kebab-case', () => {
    expect(slugify('Dark Magician')).toBe('dark-magician');
    expect(slugify("Alligator's Sword")).toBe('alligators-sword');
    expect(slugify('T.G. Blade Blaster')).toBe('t-g-blade-blaster');
    expect(slugify('Crawling Dragon #2')).toBe('crawling-dragon-2');
    expect(slugify('Destiny HERO - Plasma')).toBe('destiny-hero-plasma');
    expect(slugify('Spirit Message "L"')).toBe('spirit-message-l');
    expect(slugify('Double Tool C&D')).toBe('double-tool-c-d');
    expect(slugify('Ojama Delta Hurricane!!')).toBe('ojama-delta-hurricane');
    expect(slugify('Téa Gardner')).toBe('tea-gardner');
  });

  it('el resultado cumple el formato de id de la SPEC', () => {
    for (const name of ['Blackwing - Gale the Whirlwind', 'Level Up!', 'Shinato, King of a Higher Plane', 'Cloudian - Eye of the Typhoon']) {
      expect(slugify(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('maskName y leaksName', () => {
  it('reemplaza el nombre de la carta por ??? sin distinguir mayúsculas', () => {
    expect(maskName('Esta carta, Mago Oscuro, gana ATK. mago oscuro.', ['Mago Oscuro'])).toBe('Esta carta, ???, gana ATK. ???.');
  });

  it('enmascara también el nombre en inglés y el nombre más largo primero', () => {
    expect(maskName('Dark Magician Girl se une a Dark Magician', ['Dark Magician', 'Dark Magician Girl'])).toBe('??? se une a ???');
  });

  it('un nombre con signos de expresión regular no rompe nada', () => {
    expect(maskName('Usa "D.D. Crow" (o D.D. Crow).', ['D.D. Crow'])).toBe('Usa "???" (o ???).');
    expect(maskName('XYZ-Dragón Cañón ataca', ['XYZ-Dragón Cañón'])).toBe('??? ataca');
  });

  it('sin nombres, el texto queda igual', () => {
    expect(maskName('texto', [])).toBe('texto');
    expect(maskName('texto', [''])).toBe('texto');
  });

  it('leaksName detecta el nombre a la vista y no un texto ya enmascarado', () => {
    expect(leaksName('El Mago Oscuro ataca', ['Mago Oscuro'])).toBe(true);
    expect(leaksName('El ??? ataca', ['Mago Oscuro'])).toBe(false);
    expect(leaksName(maskName('Mago Oscuro y mago oscuro', ['Mago Oscuro']), ['Mago Oscuro'])).toBe(false);
  });
});

describe('infobox de Yugipedia', () => {
  const wikitext = `{{About|algo}}
{{Infobox character
| headers = yes
| en_name = Aster Phoenix
| gender = Male
| school = [[Duel Academy]]
| anime_debut = {{episode|Yu-Gi-Oh! GX|53|ref}}
| video_game_debut = ''[[Spirit Caller]]''
}}
== Design ==
| fuera = no
`;

  it('lee los campos de la plantilla y nada de lo que viene después', () => {
    const fields = parseInfobox(wikitext);
    expect(fields.en_name).toBe('Aster Phoenix');
    expect(fields.gender).toBe('Male');
    expect(fields.school).toBe('[[Duel Academy]]');
    expect(fields.fuera).toBeUndefined();
  });

  it('una página sin infobox no da campos', () => {
    expect(parseInfobox('solo texto')).toEqual({});
  });

  it('parseDebut lee la serie y el episodio', () => {
    expect(parseDebut('{{episode|Yu-Gi-Oh! GX|53|ref}}')).toEqual({ series: 'gx', episode: 53 });
    expect(parseDebut('{{episode|Yu-Gi-Oh!|1|ref}}')).toEqual({ series: 'dm', episode: 1 });
    expect(parseDebut("{{episode|Yu-Gi-Oh! 5D's|30|ref}}")).toEqual({ series: '5ds', episode: 30 });
  });

  it('con varias apariciones (otro nombre antes), elige el menor número', () => {
    expect(parseDebut("* {{episode|Yu-Gi-Oh! 5D's|134|ref}}\n* {{episode|Yu-Gi-Oh! 5D's|65|ref}} (As Primo)")).toEqual({ series: '5ds', episode: 65 });
  });

  it('sin plantilla de episodio o con una serie desconocida, no hay debut', () => {
    expect(parseDebut(undefined)).toBeNull();
    expect(parseDebut('Yu-Gi-Oh! GX')).toBeNull();
    expect(parseDebut('{{episode|Otra serie|3}}')).toBeNull();
  });

  it('la primera aparición se escribe con el nombre de la serie', () => {
    expect(firstAppearanceText({ series: 'gx', episode: 53 }, translations)).toBe('GX, episodio 53');
    expect(firstAppearanceText({ series: 'dm', episode: 1 }, translations)).toBe('Duel Monsters, episodio 1');
  });
});

describe('respaldo en las páginas del duelista', () => {
  const page = `Texto con [[Dark Magician]] y [[Elemental HERO Avian (anime)|Elemental HERO Avian]] y [[Template:X]].
{{Decklist|Deck
|monsters =
* [[Kuriboh]]
* [[Elemental HERO Neos (anime)|Elemental HERO Neos]]
}}
Otra mención de [[Mirror Force]].`;
  const links = pageLinks([page]);

  it('lo que está en una lista de deck es respaldo firme, aunque enlace a la versión de anime', () => {
    expect(evidenceOf('Kuriboh', links)).toBe('deck');
    expect(evidenceOf('Elemental HERO Neos', links)).toBe('deck');
    expect(evidenceOf('elemental hero neos', links)).toBe('deck');
  });

  it('lo mencionado solo en la página es respaldo débil', () => {
    expect(evidenceOf('Dark Magician', links)).toBe('page');
    expect(evidenceOf('Mirror Force', links)).toBe('page');
    expect(evidenceOf('Elemental HERO Avian', links)).toBe('page');
  });

  it('lo que no aparece no tiene respaldo, y los espacios de nombres no cuentan', () => {
    expect(evidenceOf('Blue-Eyes White Dragon', links)).toBe('none');
    expect(evidenceOf('Template:X', links)).toBe('none');
  });

  it('junta varias páginas', () => {
    const several = pageLinks([page, '[[Pot of Greed]]']);
    expect(evidenceOf('Pot of Greed', several)).toBe('page');
    expect(evidenceOf('Kuriboh', several)).toBe('deck');
  });
});

describe('orderSeries', () => {
  it('ordena como la lista canónica y sin repetidos', () => {
    expect(orderSeries(['5ds', 'dm', 'gx', 'dm'])).toEqual(['dm', 'gx', '5ds']);
    expect(orderSeries([])).toEqual([]);
  });
});

describe('summoningOf', () => {
  it('cada clase de monstruo se invoca como corresponde y las mágicas no', () => {
    expect(summoningOf({ type: 'Normal Monster' }, translations)).toBe('normal');
    expect(summoningOf({ type: 'Effect Monster' }, translations)).toBe('normal');
    expect(summoningOf({ type: 'Fusion Monster' }, translations)).toBe('fusion');
    expect(summoningOf({ type: 'Synchro Tuner Monster' }, translations)).toBe('synchro');
    expect(summoningOf({ type: 'Ritual Effect Monster' }, translations)).toBe('ritual');
    expect(summoningOf({ type: 'Spell Card' }, translations)).toBeNull();
  });

  it('un tipo que no está en el diccionario falla con un mensaje claro', () => {
    expect(() => summoningOf({ type: 'Token' }, translations)).toThrow(/Token/);
  });
});

describe('buildCardEntity', () => {
  const owners = [{ id: 'yugi-muto', name: 'Yugi Muto', series: ['dm'] as const }];

  it('un monstruo con todos sus atributos en español', () => {
    const entity = buildCardEntity({ id: 'dark-magician', api: api({}), spanishName: 'Mago Oscuro', owners, image: 'yugioh/cards/dark-magician' }, translations);
    expect(entity.name).toEqual({ es: 'Mago Oscuro', en: 'Dark Magician' });
    expect(entity.aliases).toEqual(['Dark Magician']);
    expect(entity.series).toEqual(['dm']);
    expect(entity.attrs).toMatchObject({
      clase: 'Monstruo Normal',
      atributo: 'OSCURIDAD',
      tipo: 'Lanzador de Conjuros',
      nivel: 7,
      atk: 2500,
      def: 2100,
      imagenTransparente: 0,
    });
    expect(entity.attrs.duelistas).toEqual([{ value: 'Yugi Muto', series: 'dm' }]);
    expect(entity.attrs.serie).toEqual([{ value: 'Duel Monsters', series: 'dm' }]);
  });

  it('una carta mágica no tiene nivel ni stats y su atributo es MÁGICA', () => {
    const entity = buildCardEntity(
      { id: 'swords', api: api({ name: 'Swords of Revealing Light', type: 'Spell Card', race: 'Continuous', attribute: undefined, atk: undefined, def: undefined, level: undefined }), spanishName: 'Espadas de Luz Reveladora', owners, image: 'yugioh/cards/swords' },
      translations,
    );
    expect(entity.attrs).toMatchObject({ clase: 'Carta Mágica', atributo: 'MÁGICA', tipo: 'Continua', nivel: null, atk: null, def: null });
  });

  it('una trampa y su subtipo', () => {
    const entity = buildCardEntity(
      { id: 'mirror', api: api({ name: 'Mirror Force', type: 'Trap Card', race: 'Normal', attribute: undefined, atk: undefined, def: undefined, level: undefined }), spanishName: 'Fuerza de Espejo', owners, image: 'yugioh/cards/mirror' },
      translations,
    );
    expect(entity.attrs).toMatchObject({ clase: 'Carta de Trampa', atributo: 'TRAMPA', tipo: 'Normal' });
  });

  it('un monstruo link usa su valor de link como nivel y no tiene DEF', () => {
    const entity = buildCardEntity(
      { id: 'link', api: api({ name: 'Link X', type: 'Link Monster', level: undefined, linkval: 3, def: undefined }), spanishName: 'Link X', owners, image: 'yugioh/cards/link' },
      translations,
    );
    expect(entity.attrs).toMatchObject({ clase: 'Monstruo Link', nivel: 3, def: null });
  });

  it('un ATK desconocido (negativo) queda en null', () => {
    const entity = buildCardEntity({ id: 'x', api: api({ atk: -1, def: -1 }), spanishName: null, owners, image: 'yugioh/cards/x' }, translations);
    expect(entity.attrs).toMatchObject({ atk: null, def: null });
  });

  it('sin clave es, el nombre en inglés ocupa su lugar y no se repite como alias', () => {
    const entity = buildCardEntity({ id: 'dark-magician', api: api({}), spanishName: null, owners, image: 'yugioh/cards/dark-magician' }, translations);
    expect(entity.name).toEqual({ es: 'Dark Magician', en: 'Dark Magician' });
    expect(entity.aliases).toEqual([]);
  });

  it('regla 4: hereda las series de todos sus duelistas, en orden canónico, y cada valor lleva su serie', () => {
    const entity = buildCardEntity(
      {
        id: 'black-tyranno',
        api: api({ name: 'Black Tyranno' }),
        spanishName: 'Tyranno Negro',
        owners: [
          { id: 'tyranno-hassleberry', name: 'Tyranno Hassleberry', series: ['gx'] },
          { id: 'rex-raptor', name: 'Rex Raptor', series: ['dm'] },
        ],
        image: 'yugioh/cards/black-tyranno',
      },
      translations,
    );
    expect(entity.series).toEqual(['dm', 'gx']);
    expect(entity.attrs.duelistas).toEqual([
      { value: 'Tyranno Hassleberry', series: 'gx' },
      { value: 'Rex Raptor', series: 'dm' },
    ]);
    expect(entity.attrs.serie).toEqual([
      { value: 'Duel Monsters', series: 'dm' },
      { value: 'GX', series: 'gx' },
    ]);
  });

  it('un valor sin traducir hace fallar el armado con el nombre del valor', () => {
    expect(() => buildCardEntity({ id: 'x', api: api({ attribute: 'LAVA' }), spanishName: null, owners, image: 'yugioh/cards/x' }, translations)).toThrow(/LAVA/);
    expect(() => buildCardEntity({ id: 'x', api: api({ race: 'Cthulhu' }), spanishName: null, owners, image: 'yugioh/cards/x' }, translations)).toThrow(/Cthulhu/);
  });
});

describe('buildDuelistEntity', () => {
  const src: DuelistSrc = {
    id: 'jaden-yuki',
    name: 'Jaden Yuki',
    aliases: ['Judai'],
    series: ['gx'],
    fandom: 'Jaden Yuki',
    role: 'protagonista',
    affiliations: ['Academia de Duelos'],
    decks: ['HÉROE Elemental'],
    verified: false,
  };

  it('arma los atributos del Clásico Duelista', () => {
    const entity = buildDuelistEntity(
      { src, gender: 'Male', debut: { series: 'gx', episode: 1 }, summoning: ['normal', 'fusion', 'normal'], image: 'yugioh/duelists/jaden-yuki', transparent: false },
      translations,
    );
    expect(entity).toMatchObject({ id: 'jaden-yuki', series: ['gx'], image: 'yugioh/duelists/jaden-yuki' });
    expect(entity.attrs).toEqual({
      genero: 'Masculino',
      serieDebut: 2,
      rol: 'protagonista',
      afiliaciones: ['Academia de Duelos'],
      arquetipos: ['HÉROE Elemental'],
      metodosInvocacion: ['Normal', 'Fusión'],
      primeraAparicion: 'GX, episodio 1',
      imagenTransparente: 0,
    });
  });

  it('la serie de debut es la posición en la lista canónica, así sumar series después no la cambia', () => {
    const debut = (series: 'dm' | 'gx' | '5ds' | 'vrains') =>
      buildDuelistEntity({ src, gender: 'Female', debut: { series, episode: 1 }, summoning: [], image: null, transparent: false }, translations).attrs.serieDebut;
    expect([debut('dm'), debut('gx'), debut('5ds'), debut('vrains')]).toEqual([1, 2, 3, 6]);
  });

  it('los métodos de invocación van en orden canónico', () => {
    const entity = buildDuelistEntity({ src, gender: 'Male', debut: { series: 'gx', episode: 1 }, summoning: ['synchro', 'ritual', 'normal'], image: null, transparent: false }, translations);
    expect(entity.attrs.metodosInvocacion).toEqual(['Normal', 'Ritual', 'Sincro']);
  });

  it('sin imagen no tiene el campo image, y una imagen transparente se marca con 1', () => {
    const without = buildDuelistEntity({ src, gender: 'Male', debut: { series: 'gx', episode: 1 }, summoning: [], image: null, transparent: true }, translations);
    expect('image' in without).toBe(false);
    expect(without.attrs.imagenTransparente).toBe(1);
  });

  it('un género sin traducir falla', () => {
    expect(() => buildDuelistEntity({ src, gender: 'Robot', debut: { series: 'gx', episode: 1 }, summoning: [], image: null, transparent: false }, translations)).toThrow(/Robot/);
  });
});

describe('contenidos', () => {
  it('el texto de una carta es un contenido por serie, así es elegible mientras alguna de sus series esté activa', () => {
    const contents = buildCardTextContents('black-tyranno', ['dm', 'gx'], 'texto');
    expect(contents.map((content) => [content.id, content.series])).toEqual([
      ['card-text-black-tyranno-dm', 'dm'],
      ['card-text-black-tyranno-gx', 'gx'],
    ]);
    expect(contents.every((content) => content.kind === 'card-text' && content.entityId === 'black-tyranno')).toBe(true);
  });

  const deck: DeckCard[] = [
    { id: 'c', displayName: 'Carta C', iconicity: 3, ace: true },
    { id: 'a', displayName: 'Carta A', iconicity: 1, ace: false },
    { id: 'b', displayName: 'Carta B', iconicity: 2, ace: false },
    { id: 'd', displayName: 'Carta D', iconicity: 3, ace: false },
    { id: 'e', displayName: 'Carta E', iconicity: 1, ace: false },
  ];

  it('el deck va de menor a mayor iconicidad, con la carta as al final y desempate por id', () => {
    expect(orderDeck(deck).map((card) => card.id)).toEqual(['a', 'e', 'b', 'd', 'c']);
  });

  it('el contenido del deck lleva los nombres que se muestran, de la menos a la más icónica', () => {
    const [content] = buildDeckContents('jaden-yuki', ['gx'], deck);
    expect(content).toMatchObject({ id: 'deck-jaden-yuki-gx', kind: 'deck', entityId: 'jaden-yuki', series: 'gx', verified: false });
    expect(content.payload.items).toEqual(['Carta A', 'Carta E', 'Carta B', 'Carta D', 'Carta C']);
  });

  it('la carta as entera apunta al duelista y a la carta', () => {
    const [content] = buildAceCardContents('jaden-yuki', ['gx'], { id: 'elemental-hero-neos', image: 'yugioh/cards-full/elemental-hero-neos', width: 351, height: 512 });
    expect(content).toMatchObject({
      id: 'ace-card-jaden-yuki-gx',
      kind: 'ace-card',
      entityId: 'jaden-yuki',
      payload: { image: 'yugioh/cards-full/elemental-hero-neos', width: 351, height: 512, card: 'elemental-hero-neos' },
    });
  });

  it('la silueta de un monstruo es un contenido por serie de la carta, sin verificar, con la imagen recortada', () => {
    const contents = buildSilhouetteContents('dark-magician', ['dm', 'gx'], 'yugioh/silhouettes/dark-magician');
    expect(contents.map((content) => content.id)).toEqual(['silhouette-dark-magician-dm', 'silhouette-dark-magician-gx']);
    expect(contents.map((content) => content.series)).toEqual(['dm', 'gx']);
    for (const content of contents) {
      expect(content).toMatchObject({ kind: 'silhouette', entityId: 'dark-magician', payload: { image: 'yugioh/silhouettes/dark-magician' }, verified: false });
    }
  });

  const avian = 'elemental-hero-avian';
  const burst = 'elemental-hero-burstinatrix';
  const flame: SummonInput = { cardId: 'flame-wingman', kind: 'fusion', series: ['gx'], items: ['Avian', 'Burstinatrix'], materialIds: [avian, burst] };
  const phoenix: SummonInput = { cardId: 'phoenix-enforcer', kind: 'fusion', series: ['gx'], items: ['Avian', 'Burstinatrix'], materialIds: [burst, avian] };
  const mud: SummonInput = { cardId: 'mudballman', kind: 'fusion', series: ['gx'], items: ['Bubbleman', 'Clayman'], materialIds: ['bubbleman', 'clayman'] };

  it('dos monstruos con los mismos materiales (en cualquier orden) se aceptan entre sí', () => {
    expect(acceptedSummons(flame, [flame, phoenix, mud])).toEqual(['phoenix-enforcer']);
    expect(acceptedSummons(phoenix, [flame, phoenix, mud])).toEqual(['flame-wingman']);
    expect(acceptedSummons(mud, [flame, phoenix, mud])).toEqual([]);
  });

  it('el contenido de una invocación lleva los materiales en orden y las respuestas equivalentes', () => {
    const [content] = buildSummonContents(flame, [flame, phoenix, mud]);
    expect(content).toMatchObject({ id: 'summon-flame-wingman-gx', kind: 'summon', entityId: 'flame-wingman', payload: { kind: 'fusion', items: ['Avian', 'Burstinatrix'], accepts: ['phoenix-enforcer'] } });
  });
});

describe('quotedMaterials', () => {
  it('lee los materiales entre comillas de la primera línea del texto', () => {
    expect(quotedMaterials('"Elemental HERO Avian" + "Elemental HERO Burstinatrix"\nOtra línea "no cuenta"')).toEqual(['Elemental HERO Avian', 'Elemental HERO Burstinatrix']);
    expect(quotedMaterials('"Cyber Dragon" + 1+ Machine monsters')).toEqual(['Cyber Dragon']);
    expect(quotedMaterials('2 Tuners + "Red Dragon Archfiend"')).toEqual(['Red Dragon Archfiend']);
  });

  it('un texto sin comillas no tiene materiales con nombre', () => {
    expect(quotedMaterials('1 Tuner + 1 or more non-Tuner monsters')).toEqual([]);
    expect(quotedMaterials('')).toEqual([]);
  });
});

describe('silueta: qué recortes sirven', () => {
  const whole = 0.95;

  it('sirve el que ocupa entre el 8 % y el 85 % de la imagen y es en su mayor parte una sola pieza, bordes incluidos', () => {
    expect(isUsable({ coverage: THRESHOLDS.coverage.min, connected: whole })).toBe(true);
    expect(isUsable({ coverage: THRESHOLDS.coverage.max, connected: whole })).toBe(true);
    expect(isUsable({ coverage: 0.45, connected: THRESHOLDS.connected })).toBe(true);
    // Infernity Beast: el modelo solo encontró un detalle (6,5 %).
    expect(isUsable({ coverage: 0.065, connected: whole })).toBe(false);
    expect(isUsable({ coverage: 0, connected: 0 })).toBe(false);
    expect(isUsable({ coverage: 0.92, connected: whole })).toBe(false);
    // Cloudian - Sheep Cloud: además de la nube recortó las del fondo, que quedan en piezas sueltas.
    expect(isUsable({ coverage: 0.4, connected: 0.55 })).toBe(false);
  });

  it('largestShare mide qué parte de lo marcado es la pieza más grande, con vecinos en cruz', () => {
    // 5 × 3: una pieza de 6 píxeles, una de 1 y una de 2; la diagonal no conecta.
    // 1 1 0 0 1
    // 1 1 0 0 0
    // 1 0 1 0 1  (el de la diagonal arriba a la izquierda del 1 del medio no cuenta como vecino)
    const marked = Uint8Array.from([1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1]);
    expect(largestShare(marked, 5, 3)).toBeCloseTo(5 / 8, 10);
    expect(largestShare(new Uint8Array(15), 5, 3)).toBe(0);
    expect(largestShare(Uint8Array.from([1, 1, 1, 1]), 2, 2)).toBe(1);
    expect(largestShare(Uint8Array.from([1, 0, 0, 1]), 2, 2)).toBe(0.5);
  });

  it('cleanAlpha borra lo tenue, afirma lo casi opaco, deja el borde suave y quita las islas diminutas', () => {
    const size = 100;
    const alpha = new Uint8Array(size * size);
    // Un cuadrado de 30 × 30 con el borde exterior a medias, una isla de 2 × 2 y un velo tenue.
    for (let y = 10; y < 40; y++) for (let x = 10; x < 40; x++) alpha[y * size + x] = 250;
    for (let x = 10; x < 40; x++) alpha[10 * size + x] = 150;
    for (let y = 70; y < 72; y++) for (let x = 70; x < 72; x++) alpha[y * size + x] = 255;
    for (let y = 60; y < 70; y++) for (let x = 0; x < 10; x++) alpha[y * size + x] = CLEANUP.floor - 1;
    cleanAlpha(alpha, size, size);
    expect(alpha[20 * size + 20]).toBe(255);
    expect(alpha[10 * size + 20]).toBe(150);
    expect(alpha[70 * size + 70]).toBe(0);
    expect(alpha[65 * size + 5]).toBe(0);
    expect(alpha.filter((value) => value > 0).length).toBe(30 * 30);
  });

  it('measureCutout lee la cobertura y la conexión del canal alfa de un PNG', async () => {
    const size = 20;
    const rgba = Buffer.alloc(size * size * 4);
    // Un cuadrado opaco de 10 × 10 (25 %) y un punto suelto de 1 píxel.
    const paint = (x: number, y: number) => {
      rgba[(y * size + x) * 4 + 3] = 255;
    };
    for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) paint(x, y);
    paint(17, 17);
    const png = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    const metrics = await measureCutout(png);
    expect(metrics.coverage).toBeCloseTo(101 / 400, 10);
    expect(metrics.connected).toBeCloseTo(100 / 101, 10);
  });
});
