import arcsJson from '../../../data/naruto/arcs.json';
import { es } from '../../i18n/es';
import type { ClassicValueLabel } from '../../modes/classic/types';
import type { FranchiseConfig } from '../types';
import { NARUTO_PALETTE } from './palette';

/**
 * Nombre de cada arco para la celda de la tabla del Clásico: explícito pero más corto que el completo. El orden de los arcos (el número que se compara) sale de `data/naruto/arcs.json`, que
 * genera `npm run data:naruto` desde `data-src`.
 */
export const arcLabels: Readonly<Record<string, string>> = {
  'tierra-de-las-olas': 'País de las Olas',
  'examen-chunin': 'Examen Chūnin',
  'invasion-de-konoha': 'Invasión de Konoha',
  'busqueda-de-tsunade': 'Búsqueda de Tsunade',
  'recuperacion-de-sasuke': 'Recuperación de Sasuke',
  'rescate-del-kazekage': 'Rescate del Kazekage',
  'puente-tenchi': 'Puente Tenchi',
  'supresion-de-akatsuki': 'Supresión de Akatsuki',
  'persecucion-de-itachi': 'Persecución de Itachi',
  'historia-de-jiraiya': 'Historia de Jiraiya',
  'batalla-entre-hermanos': 'Batalla entre hermanos',
  'asalto-de-pain': 'Asalto de Pain',
  'cumbre-de-los-kage': 'Cumbre de los Kage',
  'guerra-cuenta-regresiva': 'Guerra: cuenta regresiva',
  'guerra-confrontacion': 'Guerra: confrontación',
  'guerra-climax': 'Guerra: clímax',
  'jinchuriki-del-diez-colas': 'Jinchūriki del Diez Colas',
  kaguya: 'Ataque de Kaguya',
  'konoha-hiden': 'Konoha Hiden',
  'ingreso-a-la-academia': 'Ingreso a la Academia',
  'arco-de-sarada': 'Arco de Sarada',
  'excursion-escolar': 'Excursión escolar',
  'examen-de-graduacion': 'Examen de graduación',
  'mision-de-genin': 'Misión de genin',
  'banda-de-byakuya': 'Banda de Byakuya',
  'contra-momoshiki': 'Contra Momoshiki',
  'desaparicion-de-mitsuki': 'Desaparición de Mitsuki',
  'activacion-de-kara': 'Activación de Kara',
  'arco-de-kawaki': 'Arco de Kawaki',
  'reexamen-chunin': 'Reexamen Chūnin',
  'asalto-de-code': 'Asalto de Code',
};

/** Qué es cada arco, por su nombre en la tabla (el texto de `arcLabels`); sale de `es.help.naruto.arcos`. */
const arcHelp: Readonly<Record<string, string>> = Object.fromEntries(
  arcsJson.arcs.map((arc) => [arcLabels[arc.id] ?? arc.name, es.help.naruto.arcos[arc.id as keyof typeof es.help.naruto.arcos]]),
);

/** El número de cada arco en la cronología → su nombre corto y la serie a la que pertenece. */
const arcDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  arcsJson.arcs.map((arc) => [String(arc.order), { label: arcLabels[arc.id] ?? arc.name, series: arc.series }]),
);

export const narutoConfig = {
  slug: 'naruto',
  name: 'Naruto',
  entityNoun: { one: 'personaje', many: 'personajes' },
  series: ['naruto', 'shippuden', 'boruto'],
  seriesLabels: {
    naruto: 'Naruto',
    shippuden: 'Shippuden',
    boruto: 'Boruto',
  },
  modes: [
    {
      slug: 'clasico',
      name: 'Clásico',
      engine: 'classic',
      classic: {
        columns: [
          { key: 'genero', label: 'Género', compare: 'exact' },
          // Dos valores llevan la serie en que se ven (Kara y las Fuerzas Aliadas Shinobi): con su serie apagada, no aparecen (regla 3).
          { key: 'afiliaciones', label: 'Afiliaciones', compare: 'set', valueHelp: es.help.naruto.afiliaciones },
          { key: 'tiposDeJutsu', label: 'Tipos de jutsu', compare: 'set', valueHelp: es.help.naruto.tiposDeJutsu },
          { key: 'kekkeiGenkai', label: 'Kekkei Genkai', compare: 'set', help: es.help.narutoClassic.kekkeiGenkai },
          { key: 'naturalezas', label: 'Naturalezas', compare: 'set', help: es.help.narutoClassic.naturalezas },
          { key: 'atributos', label: 'Atributos', compare: 'set', valueHelp: es.help.naruto.atributos, help: es.help.narutoClassic.atributos },
          // La primera letra del nombre (sin tilde): verde si es la misma que la de la respuesta, rojo si no.
          { key: 'inicial', label: 'Inicial', compare: 'exact', large: true },
          // Se compara el lugar del arco en la cronología (el orden de las series lo fija arcs.json); se muestra el nombre.
          // Si la serie del arco está apagada, el valor se oculta: lo excluido no aparece nunca.
          { key: 'arcoDebut', label: 'Arco de debut', compare: 'ordered', valueLabels: arcDebutLabels, valueHelp: arcHelp, help: es.help.narutoClassic.arcoDebut },
        ],
        hints: [
          // La ocupación revela mucho: va última, después de la inicial.
          { kind: 'attr', label: 'Estado vital', after: 4, key: 'estadoVital' },
          { kind: 'attr', label: 'Inicial', after: 7, key: 'inicial' },
          { kind: 'attr', label: 'Ocupación', after: 9, key: 'ocupacion' },
        ],
      },
    },
    {
      slug: 'silueta',
      name: 'Silueta',
      engine: 'image-reveal',
      // Solo el arte de fondo transparente: con fondo, la sombra sería un rectángulo negro. Los demás se pueden intentar.
      imageReveal: { variant: 'silhouette', requireAttr: { key: 'imagenTransparente', equals: 1 } },
    },
    {
      slug: 'frase',
      name: 'Frase',
      engine: 'text-clue',
      // Una frase que dijo el personaje (solo las verificadas). Si se falla: a quién se la dijo y en qué arco.
      textClue: {
        contentKind: 'quote',
        lines: [
          { kind: 'content', label: 'Frase', after: 0, field: 'text' },
          { kind: 'content', label: 'Dicha a', after: 3, field: 'addressee' },
          { kind: 'content', label: 'Arco', after: 6, field: 'arc' },
        ],
      },
    },
    { slug: 'borroso', name: 'Borroso', engine: 'image-reveal', imageReveal: { variant: 'blur' } },
    {
      slug: 'jutsu',
      name: 'Jutsu',
      engine: 'image-reveal',
      // La imagen es un jutsu (cada uno con su captura) y la respuesta, quien lo usa. Cuenta como acierto
      // cualquiera de los personajes que lo usan (ver `accepts` en los datos).
      imageReveal: { variant: 'blur', imageContentKind: 'jutsu' },
    },
    {
      slug: 'ojo',
      name: 'Ojo',
      engine: 'image-reveal',
      // El recorte arranca en el ojo: el punto focal viene en los datos de cada personaje (`focus`). Parte mucho más cerca que
      // el Zoom de las otras franquicias (5,2 en vez de 3,2) y se abre de a poco (de 2,6 como mucho: nunca llega a mostrar la
      // cara entera), para que no se sepa quién es al primer vistazo.
      imageReveal: { variant: 'zoom', imageContentKind: 'eye', zoomScales: [5.2, 4.5, 3.9, 3.4, 3, 2.6] },
    },
    {
      slug: 'equipo',
      name: 'Equipo',
      engine: 'reveal-list',
      // Los miembros del equipo de a uno, y la respuesta es el que falta: cada fallo revela un miembro más.
      revealList: { contentKind: 'team', field: 'items', label: 'Miembros' },
    },
    {
      slug: 'emoji',
      name: 'Emoji',
      engine: 'text-clue',
      // El personaje descrito con emojis. Si se falla, su ocupación y sus tipos de jutsu.
      textClue: {
        contentKind: 'emoji',
        lines: [
          { kind: 'content', label: 'Emojis', after: 0, field: 'text', display: 'emoji' },
          { kind: 'attr', label: 'Ocupación', after: 3, keys: ['ocupacion'] },
          { kind: 'attr', label: 'Tipos de jutsu', after: 6, keys: ['tiposDeJutsu'], valueHelp: es.help.naruto.tiposDeJutsu },
        ],
      },
    },
    {
      slug: 'linea-de-tiempo',
      name: 'Línea de tiempo',
      engine: 'timeline',
      // Sucesos de la historia (solo los verificados) para ordenar del más antiguo al más reciente, con las mismas tres
      // dificultades que Dragon Ball: 5 sucesos y 3 intentos, 10 y 4, y 15 y 5. Los de relleno y los de arcos del manga sin
      // adaptar los dejan afuera los interruptores comunes a todos los modos (ver `withoutFlagged`).
      timeline: {
        contentKind: 'event',
        textField: 'text',
        orderField: 'order',
        orderHelp: es.help.naruto.timelineOrder,
        levels: [{ count: 5, attempts: 3 }, { count: 10, attempts: 4 }, { count: 15, attempts: 5 }],
      },
    },
    {
      slug: 'conexiones',
      name: 'Conexiones',
      engine: 'connections',
      // 4 grupos de 4 personajes (un grupo de cada dificultad). Cada personaje del tablero pertenece a uno solo de los cuatro.
      connections: { contentKind: 'group', nameField: 'name', membersField: 'members', difficultyField: 'difficulty' },
    },
  ],
  // Pergamino y tinta: papel cálido, naranja apagado y un título de pincel.
  theme: {
    scheme: 'light',
    // Pergamino y tinta (sesión 17): papel washi, tinta casi negra y un naranja quemado como acento (el naranja de la
    // paleta, #e07b2e, no llega a 4,5:1 como texto sobre el papel; la piel lo usa con tinta encima).
    colors: {
      bg: '#e9dcbf',
      surface: '#f3e9d2',
      stage: '#f8f2e2',
      text: '#22201c',
      'text-muted': '#584e40',
      border: '#22201c',
      accent: '#9c3a12',
      'accent-contrast': '#ffffff',
      focus: '#23334d',
      match: '#3d6a26',
      partial: '#9a5410',
      miss: '#b8322a',
      'on-result': '#ffffff',
    },
    // Permanent Marker (trazo de marcador, como de pincel) para títulos y Shippori Mincho para el resto (elegidas en la
    // sesión 17).
    headingFont: { id: 'permanent-marker', fallback: '"Comic Sans MS", "Segoe Print", cursive' },
    bodyFont: { id: 'shippori-mincho', fallback: 'Georgia, "Times New Roman", serif' },
    radius: { sm: '0.125rem', md: '0.25rem', lg: '0.375rem' },
    cardShadow: '0.125rem 0.125rem 0 var(--color-border)',
    headingStyle: { letterSpacing: '0.01em', textTransform: 'none' },
    background: '/themes/naruto.svg',
    // La paleta de la piel (palette.ts): 24 colores como mucho, contando los de `colors`.
    palette: NARUTO_PALETTE,
    pairs: [
      { text: 'ink', background: 'paper', kind: 'text', where: 'Texto de paneles, pergaminos y celdas' },
      { text: 'ink', background: 'washi-shade', kind: 'text', where: 'Chips apagados y papel oscuro' },
      { text: 'ink', background: 'orange', kind: 'text', where: 'Botones y marcas sobre naranja' },
      { text: 'white', background: 'seal', kind: 'text', where: 'Sellos rojos (botón principal y victoria)' },
      { text: 'paper', background: 'night', kind: 'text', where: 'Barra de título de los modales' },
      { text: 'white', background: 'wood', kind: 'text', where: 'Placas de madera (botones secundarios)' },
      { text: 'white', background: 'chakra', kind: 'text', where: 'Barra de chakra' },
      { text: 'ink', background: 'smoke', kind: 'text', where: 'Texto sobre el humo' },
      { text: 'ink', background: 'gold', kind: 'ui', where: 'Kanji del ícono de Rayo (Naturalezas)' },
      { text: 'ink', background: 'paper', kind: 'ui', where: 'Marcos y anillo de foco sobre el papel' },
      { text: 'seal', background: 'paper', kind: 'ui', where: 'Sellos rojos sobre el papel' },
    ],
  },
} as const satisfies FranchiseConfig;
