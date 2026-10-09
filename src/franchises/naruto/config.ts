import arcsJson from '../../../data/naruto/arcs.json';
import type { ClassicValueLabel } from '../../modes/classic/types';
import type { FranchiseConfig } from '../types';

/**
 * Nombre corto de cada arco para la celda de la tabla del Clásico, donde el nombre completo no
 * entra. El orden de los arcos (el número que se compara) sale de `data/naruto/arcs.json`, que
 * genera `npm run data:naruto` desde `data-src`.
 */
export const arcLabels: Readonly<Record<string, string>> = {
  'tierra-de-las-olas': 'Olas',
  'examen-chunin': 'Chūnin',
  'invasion-de-konoha': 'Invasión',
  'busqueda-de-tsunade': 'Tsunade',
  'recuperacion-de-sasuke': 'Sasuke',
  'rescate-del-kazekage': 'Kazekage',
  'puente-tenchi': 'Puente Tenchi',
  'supresion-de-akatsuki': 'Akatsuki',
  'persecucion-de-itachi': 'Itachi',
  'historia-de-jiraiya': 'Jiraiya',
  'batalla-entre-hermanos': 'Hermanos',
  'asalto-de-pain': 'Pain',
  'cumbre-de-los-kage': 'Cumbre Kage',
  'guerra-cuenta-regresiva': 'Cuenta regresiva',
  'guerra-confrontacion': 'Confrontación',
  'guerra-climax': 'Clímax',
  'jinchuriki-del-diez-colas': 'Diez Colas',
  kaguya: 'Kaguya',
  'konoha-hiden': 'Konoha Hiden',
  'ingreso-a-la-academia': 'Academia',
  'arco-de-sarada': 'Sarada',
  'excursion-escolar': 'Excursión',
  'examen-de-graduacion': 'Graduación',
  'mision-de-genin': 'Genin',
  'banda-de-byakuya': 'Byakuya',
  'contra-momoshiki': 'Momoshiki',
  'desaparicion-de-mitsuki': 'Mitsuki',
  'activacion-de-kara': 'Kara',
  'arco-de-kawaki': 'Kawaki',
  'reexamen-chunin': 'Reexamen',
  'asalto-de-code': 'Code',
};

/** El número de cada arco en la cronología → su nombre corto y la serie a la que pertenece. */
const arcDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  arcsJson.arcs.map((arc) => [String(arc.order), { label: arcLabels[arc.id] ?? arc.name, series: arc.series }]),
);

export const narutoConfig = {
  slug: 'naruto',
  name: 'Naruto',
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
          { key: 'afiliaciones', label: 'Afiliaciones', compare: 'set' },
          { key: 'tiposDeJutsu', label: 'Tipos de jutsu', compare: 'set' },
          { key: 'kekkeiGenkai', label: 'Kekkei Genkai', compare: 'set' },
          { key: 'naturalezas', label: 'Naturalezas', compare: 'set' },
          { key: 'atributos', label: 'Atributos', compare: 'set' },
          // Se compara el lugar del arco en la cronología (el orden de las series lo fija arcs.json); se muestra el nombre.
          // Si la serie del arco está apagada, el valor se oculta: lo excluido no aparece nunca.
          { key: 'arcoDebut', label: 'Arco de debut', compare: 'ordered', valueLabels: arcDebutLabels },
        ],
        hints: [
          { kind: 'attr', label: 'Estado vital', after: 4, key: 'estadoVital' },
          { kind: 'attr', label: 'Ocupación', after: 7, key: 'ocupacion' },
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
      // El recorte arranca en el ojo: el punto focal viene en los datos de cada personaje (`focus`).
      imageReveal: { variant: 'zoom', imageContentKind: 'eye' },
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
          { kind: 'attr', label: 'Tipos de jutsu', after: 6, keys: ['tiposDeJutsu'] },
        ],
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
} as const satisfies FranchiseConfig;
