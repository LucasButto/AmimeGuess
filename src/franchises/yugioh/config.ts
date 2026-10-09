import seriesJson from '../../../data/yugioh/series.json';
import type { ClassicValueLabel } from '../../modes/classic/types';
import type { FranchiseConfig } from '../types';

/**
 * Alcance inicial (sesión 12): solo las tres series que conoce el usuario. ZEXAL, ARC-V, VRAINS, `sevens`
 * y `gorush` se suman después junto con sus duelistas en data-src/yugioh/: basta con agregar su id y su
 * nombre acá (el orden canónico de `data/yugioh/series.json` ya los trae).
 */
const seriesLabels: Readonly<Record<string, string>> = {
  dm: 'Duel Monsters',
  gx: 'GX',
  '5ds': "5D's",
};

/** El lugar de cada serie en la cronología → su nombre y a qué serie pertenece (columna "Serie de debut"). */
const serieDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  seriesJson.series
    .filter((entry) => entry.id in seriesLabels)
    .map((entry) => [String(entry.order), { label: seriesLabels[entry.id] ?? entry.id, series: entry.id }]),
);

export const yugiohConfig = {
  slug: 'yugioh',
  name: 'Yu-Gi-Oh',
  series: ['dm', 'gx', '5ds'],
  seriesLabels: {
    dm: seriesLabels.dm,
    gx: seriesLabels.gx,
    '5ds': seriesLabels['5ds'],
  },
  // Dos clases de entidad: los duelistas son las entidades principales (`data/yugioh/entities.json`) y las
  // cartas insignia, el conjunto `cards`. Cada modo elige la suya con `entitySet`: los de cartas dicen
  // `cards`; Duelista, Carta insignia y Deck adivinan un duelista.
  modes: [
    {
      slug: 'duelista',
      name: 'Duelista',
      engine: 'classic',
      // El modo principal: va primero en la navegación y en la lista de la franquicia.
      classic: {
        columns: [
          { key: 'genero', label: 'Género', compare: 'exact' },
          // Se compara el lugar de la serie en la cronología; se muestra su nombre.
          { key: 'serieDebut', label: 'Serie de debut', compare: 'ordered', valueLabels: serieDebutLabels },
          { key: 'rol', label: 'Rol', compare: 'exact' },
          { key: 'afiliaciones', label: 'Afiliación', compare: 'set' },
          { key: 'arquetipos', label: 'Arquetipo', compare: 'set' },
          { key: 'metodosInvocacion', label: 'Método de invocación', compare: 'set' },
        ],
        hints: [
          { kind: 'attr', label: 'Primera aparición', after: 4, key: 'primeraAparicion' },
          // La pista de la carta insignia borrosa necesita una pista de imagen en el Clásico, que todavía no
          // existe (igual que la carta de Pokémon): la imagen de la carta as ya está en los datos (kind "ace-card").
        ],
      },
    },
    {
      slug: 'carta',
      name: 'Carta',
      engine: 'classic',
      entitySet: 'cards',
      classic: {
        columns: [
          { key: 'clase', label: 'Clase', compare: 'exact' },
          { key: 'atributo', label: 'Atributo', compare: 'exact' },
          { key: 'tipo', label: 'Tipo', compare: 'exact' },
          { key: 'nivel', label: 'Nivel / Rango', compare: 'ordered' },
          { key: 'atk', label: 'ATK', compare: 'ordered' },
          { key: 'def', label: 'DEF', compare: 'ordered' },
          // Cada duelista y cada serie llevan la suya: con una serie apagada, sus valores no aparecen (regla 3).
          { key: 'duelistas', label: 'Duelista', compare: 'set' },
          { key: 'serie', label: 'Serie', compare: 'set' },
        ],
        // La SPEC pide también el arquetipo, pero los datos no lo tienen (las cartas se eligieron por su duelista).
        hints: [{ kind: 'content', label: 'Texto de la carta', after: 6, contentKind: 'card-text', field: 'text' }],
      },
    },
    {
      slug: 'silueta',
      name: 'Silueta',
      engine: 'image-reveal',
      entitySet: 'cards',
      // Solo monstruos: la imagen es su ilustración recortada del fondo (kind "silhouette", un WebP con transparencia
      // que genera `npm run data:yugioh`). Las magias, las trampas y los monstruos cuyo recorte no se pudo hacer
      // no tienen silueta: no pueden ser la respuesta, pero sí un intento.
      imageReveal: { variant: 'silhouette', imageContentKind: 'silhouette' },
    },
    {
      slug: 'texto',
      name: 'Texto',
      engine: 'text-clue',
      entitySet: 'cards',
      // El texto oficial de la carta con su nombre en "???". Si se falla: qué clase de carta es y su atributo.
      // No se usan `duelistas` ni `serie`: sus valores llevan etiqueta de serie y una pista no los filtra.
      textClue: {
        contentKind: 'card-text',
        lines: [
          { kind: 'content', label: 'Texto', after: 0, field: 'text' },
          { kind: 'attr', label: 'Clase y tipo', after: 3, keys: ['clase', 'tipo'] },
          { kind: 'attr', label: 'Atributo y nivel', after: 6, keys: ['atributo', 'nivel'] },
        ],
      },
    },
    {
      slug: 'arte',
      name: 'Arte',
      engine: 'image-reveal',
      entitySet: 'cards',
      // La ilustración de la carta, sin el marco, desenfocada.
      imageReveal: { variant: 'blur' },
    },
    {
      slug: 'carta-insignia',
      name: 'Carta insignia',
      engine: 'image-reveal',
      // La imagen es la carta as entera de un duelista y la respuesta, ese duelista (las entidades son los duelistas).
      imageReveal: { variant: 'blur', imageContentKind: 'ace-card' },
    },
    {
      slug: 'zoom',
      name: 'Zoom',
      engine: 'image-reveal',
      entitySet: 'cards',
      imageReveal: { variant: 'zoom' },
    },
    {
      slug: 'mayor-o-menor',
      name: 'Mayor o Menor',
      engine: 'higher-lower',
      entitySet: 'cards',
      // ATK y DEF se alternan por día. Solo entran los monstruos que tienen los dos valores: las magias, las
      // trampas y los monstruos de ATK o DEF "?" quedan fuera.
      higherLower: {
        metrics: [
          { key: 'atk', label: 'ATK', question: '¿Cuál tiene más ATK?' },
          { key: 'def', label: 'DEF', question: '¿Cuál tiene más DEF?' },
        ],
      },
    },
    {
      slug: 'invocacion',
      name: 'Invocación',
      engine: 'reveal-list',
      entitySet: 'cards',
      // Los materiales de un monstruo de fusión de a uno, y la respuesta es el monstruo. Cuenta como acierto cualquier
      // monstruo con los mismos materiales (ver `accepts` en los datos).
      revealList: { contentKind: 'summon', field: 'items', label: 'Materiales' },
    },
    {
      slug: 'deck',
      name: 'Deck',
      engine: 'reveal-list',
      // Las cartas de un duelista, de la menos a la más icónica: cada fallo revela una más. La respuesta es el duelista.
      revealList: { contentKind: 'deck', field: 'items', label: 'Cartas' },
    },
  ],
} as const satisfies FranchiseConfig;
