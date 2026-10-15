import sagasJson from '../../../data/dragon-ball/sagas.json';
import { es } from '../../i18n/es';
import type { ClassicValueLabel } from '../../modes/classic/types';
import type { FranchiseConfig } from '../types';
import { DRAGON_BALL_PALETTE } from './palette';

// Ayudas (botón ⓘ) de las columnas del Clásico.
const help = es.help.dragonBall;

const seriesLabels: Readonly<Record<string, string>> = {
  db: 'Dragon Ball',
  dbz: 'Dragon Ball Z',
  gt: 'Dragon Ball GT',
  super: 'Dragon Ball Super',
  daima: 'Dragon Ball Daima',
};

/**
 * Nombre corto de cada saga para la celda de la tabla del Clásico, donde el nombre completo
 * no entra. El orden de las series y de las sagas (el número que se compara) sale de
 * `data/dragon-ball/sagas.json`, que genera `npm run data:dragon-ball` desde `data-src`.
 */
export const sagaLabels: Readonly<Record<string, string>> = {
  pilaf: 'Pilaf',
  'torneo-21': 'Torneo 21',
  'liston-rojo': 'Listón Rojo',
  'torneo-22': 'Torneo 22',
  'gran-rey-demonio-piccolo': 'Rey Piccolo',
  'torneo-23': 'Torneo 23',
  saiyanos: 'Saiyanos',
  'namek-freezer': 'Namek',
  makyo: 'Makyo',
  'androides-cell': 'Androides y Célula',
  'otro-mundo': 'Otro Mundo',
  boo: 'Boo',
  'dbz-peliculas': 'Películas de Z',
  beerus: 'Beerus',
  'freezer-dorado': 'Freezer Dorado',
  'universo-6': 'Universo 6',
  'trunks-futuro': 'Trunks del Futuro',
  supervivencia: 'Supervivencia',
  'super-broly': 'Película Broly',
  'prisionero-patrulla-galactica': 'Patrulla Galáctica',
  'sobreviviente-granolah': 'Granolah',
  'super-hero': 'Super Hero',
  'esferas-definitivas': 'Esferas Definitivas',
  baby: 'Baby',
  'androide-definitivo': 'Androide Definitivo',
  'dragones-malignos': 'Dragones Malignos',
  'reino-demoniaco': 'Daima',
};

/** El número de cada serie en la cronología → su nombre y a qué serie pertenece. */
const serieDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  sagasJson.series.map((entry) => [String(entry.order), { label: seriesLabels[entry.id] ?? entry.id, series: entry.id }]),
);

/** El número de cada saga en la cronología → su nombre corto y la serie a la que pertenece. */
const sagaDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  sagasJson.sagas.map((saga) => [String(saga.order), { label: sagaLabels[saga.id] ?? saga.name, series: saga.series }]),
);

export const dragonBallConfig = {
  slug: 'dragon-ball',
  name: 'Dragon Ball',
  // Los 121 personajes tienen imagen: el autocompletado la muestra en miniatura (se midió que escribir sigue fluido).
  autocompleteThumbnails: true,
  entityNoun: { one: 'personaje', many: 'personajes' },
  entitySetNouns: { transformations: { one: 'forma', many: 'formas' }, power: { one: 'personaje', many: 'personajes' } },
  // En el orden de la historia (el de los filtros y el de la cronología de los datos): Daima ocurre entre Z y Super, y GT
  // al final. Es el orden elegido por el usuario el 2026-10-14; `data-src/dragon-ball/sagas.json` (`seriesOrder`) lo repite.
  series: ['db', 'dbz', 'daima', 'super', 'gt'],
  seriesLabels: {
    db: seriesLabels.db,
    dbz: seriesLabels.dbz,
    daima: seriesLabels.daima,
    super: seriesLabels.super,
    gt: seriesLabels.gt,
  },
  modes: [
    {
      slug: 'clasico',
      name: 'Clásico',
      engine: 'classic',
      classic: {
        columns: [
          { key: 'genero', label: 'Género', compare: 'exact', help: help.genero },
          { key: 'razas', label: 'Raza', compare: 'set', help: help.razas },
          { key: 'afiliaciones', label: 'Afiliación', compare: 'set', help: help.afiliaciones },
          { key: 'planeta', label: 'Planeta de origen', compare: 'exact', help: help.planeta },
          // Cada forma lleva la serie en que se ve: con una serie apagada, sus formas no aparecen (regla 3).
          { key: 'transformaciones', label: 'Transformaciones', compare: 'set', help: help.transformaciones },
          // Se compara el lugar en la cronología (el orden de las series lo fija sagas.json); se muestra el nombre.
          // Si la serie del debut está apagada, el valor se oculta: lo excluido no aparece nunca.
          { key: 'serieDebut', label: 'Serie de debut', compare: 'ordered', valueLabels: serieDebutLabels, help: help.serieDebut },
          { key: 'sagaDebut', label: 'Saga de debut', compare: 'ordered', valueLabels: sagaDebutLabels, help: help.sagaDebut },
        ],
        hints: [
          { kind: 'attr', label: 'Estado vital', after: 4, key: 'estadoVital' },
          { kind: 'attr', label: 'Técnica característica', after: 7, key: 'tecnica' },
        ],
      },
    },
    {
      slug: 'silueta',
      name: 'Silueta',
      engine: 'image-reveal',
      // Un zoom sobre la sombra negra del personaje: parte de un costado y se abre hacia el centro (la silueta no se
      // ilumina). Solo el arte de fondo transparente: con fondo, la sombra sería un rectángulo negro. Los demás se pueden intentar.
      imageReveal: { variant: 'zoom-silhouette', requireAttr: { key: 'imagenTransparente', equals: 1 } },
    },
    {
      slug: 'frase',
      name: 'Frase',
      engine: 'text-clue',
      // Una frase que dijo el personaje (solo las verificadas). Su raza y su afiliación ayudan si se falla.
      textClue: {
        contentKind: 'quote',
        lines: [
          { kind: 'content', label: 'Frase', after: 0, field: 'text' },
          { kind: 'attr', label: 'Raza', after: 3, keys: ['razas'] },
          { kind: 'attr', label: 'Afiliación', after: 6, keys: ['afiliaciones'] },
        ],
      },
    },
    { slug: 'borroso', name: 'Borroso', engine: 'image-reveal', imageReveal: { variant: 'blur' } },
    {
      slug: 'tecnica',
      name: 'Técnica',
      engine: 'image-reveal',
      // La imagen es una técnica (cada una con su captura) y la respuesta, quien la usa. Cuenta como acierto
      // cualquiera de los personajes que la usan (ver `accepts` en los datos).
      imageReveal: { variant: 'blur', imageContentKind: 'technique' },
    },
    {
      slug: 'poder',
      name: 'Nivel de poder',
      engine: 'higher-lower',
      // Personajes y formas en un momento de la historia (la saga va entre paréntesis cuando cambia el poder), de
      // `data-src/dragon-ball/power.json`: estimaciones propias revisadas con el usuario (2026-10-14).
      entitySet: 'power',
      // Un orden de magnitud de diferencia como mínimo: los valores son estimaciones, no cifras exactas.
      higherLower: {
        minRatio: 10,
        metrics: [
          {
            key: 'ki',
            label: 'Nivel de poder',
            question: '¿Quién tiene más ki?',
            note: 'Estimaciones propias: solo hay cifras oficiales hasta la saga de Freezer. Entre paréntesis, la saga de ese poder. Cada par difiere al menos 10 veces.',
          },
        ],
      },
    },
    {
      slug: 'transformacion',
      name: 'Transformación',
      engine: 'image-reveal',
      // Se adivina la forma exacta (por ejemplo, "Goku Supersaiyano 3"), no el personaje: las entidades son las formas.
      entitySet: 'transformations',
      imageReveal: { variant: 'blur' },
    },
    {
      slug: 'linea-de-tiempo',
      name: 'Línea de tiempo',
      engine: 'timeline',
      // Cinco sucesos de la historia (solo los verificados) para ordenar del más antiguo al más reciente.
      // Tres dificultades (elegidas por el usuario el 2026-10-14): fácil con 5 sucesos y 3 intentos, normal con 10 y 4, y
      // difícil con 15 y 5. Los sucesos de relleno y los de arcos del manga sin adaptar los dejan afuera los interruptores
      // comunes a todos los modos (ver `withoutFlagged`).
      timeline: {
        contentKind: 'event',
        textField: 'text',
        orderField: 'order',
        orderHelp: es.help.timelineOrder,
        levels: [{ count: 5, attempts: 3 }, { count: 10, attempts: 4 }, { count: 15, attempts: 5 }],
      },
    },
  ],
  // Manga de acción (sesión 16): paneles de papel crema con tinta negra gruesa sobre el cielo celeste de la serie. Bangers
  // para los títulos (letra de cómic, solo títulos y etiquetas cortas) y Rubik para el texto.
  theme: {
    scheme: 'light',
    colors: {
      bg: '#ffe3b8',
      surface: '#fff6e5',
      stage: '#fff6e5',
      text: '#1a1a1a',
      'text-muted': '#4a4a4a',
      border: '#1a1a1a',
      // El naranja de la marca (#f28c18) no llega a 4,5:1 como texto sobre el papel: el acento, que también se usa para
      // enlaces, es un naranja quemado. La piel pinta el botón principal con el naranja de la paleta y tinta oscura.
      accent: '#a33f00',
      'accent-contrast': '#ffffff',
      focus: '#1a1a1a',
      match: '#2f7d32',
      partial: '#b35500',
      miss: '#c62828',
      'on-result': '#ffffff',
    },
    headingFont: { id: 'bangers', fallback: 'Impact, "Arial Narrow Bold", system-ui, sans-serif' },
    bodyFont: { id: 'rubik', fallback: 'system-ui, sans-serif' },
    radius: { sm: '0', md: '0', lg: '0' },
    cardShadow: '0.25rem 0.25rem 0 #1a1a1a',
    headingStyle: { letterSpacing: '0.04em', textTransform: 'uppercase' },
    background: '/themes/dragon-ball.svg',
    // La paleta de la piel (palette.ts): 24 colores como mucho, contando los de `colors`.
    palette: DRAGON_BALL_PALETTE,
    pairs: [
      { text: 'ink', background: 'white', kind: 'text', where: 'Texto de paneles y celdas (tinta sobre papel blanco)' },
      { text: 'ink', background: 'cream', kind: 'text', where: 'Texto de paneles, cuadros de diálogo y celdas de la tabla' },
      { text: 'text-muted', background: 'white', kind: 'text', where: 'Aviso del pie, en el globo blanco' },
      { text: 'accent', background: 'white', kind: 'text', where: 'Enlace a Créditos, en el globo blanco' },
      { text: 'text-muted', background: 'cream', kind: 'text', where: 'Texto secundario sobre los paneles' },
      { text: 'accent', background: 'cream', kind: 'text', where: 'Enlaces sobre los paneles' },
      { text: 'ink', background: 'orange', kind: 'text', where: 'Botón principal (placa naranja)' },
      { text: 'ink', background: 'cloud', kind: 'text', where: 'Etiqueta de la cápsula del Clásico (nombre y estado de hoy)' },
      { text: 'white', background: 'ink', kind: 'text', where: 'Nombre de cada modo: letras blancas con contorno de tinta sobre la cinta naranja (el contorno las separa del naranja)' },
      { text: 'yellow', background: 'scouter-dark', kind: 'ui', where: 'Anillo de foco dentro de la lente del rastreador' },
      { text: 'yellow', background: 'scouter-dark', kind: 'text', where: 'Nombre del objetivo fijado en el rastreador' },
      { text: 'white', background: 'blue', kind: 'text', where: 'Botón secundario (placa azul) y barra de título de los modales' },
      { text: 'white', background: 'red', kind: 'text', where: 'Texto sobre rojo' },
      { text: 'ink', background: 'yellow', kind: 'text', where: 'Chips y marcas sobre amarillo (esfera del dragón)' },
      { text: 'ink', background: 'gray', kind: 'text', where: 'Botón B (cerrar, volver)' },
      { text: 'text-muted', background: 'paper-shade', kind: 'text', where: 'Chip de filtro apagado y botón deshabilitado' },
      { text: 'ink', background: 'paper-shade', kind: 'text', where: 'Texto sobre lo hundido (celdas vacías, pistas bloqueadas)' },
      { text: 'scouter', background: 'scouter-dark', kind: 'text', where: 'Lectura del scouter' },
      { text: 'text-muted', background: 'cloud', kind: 'text', where: 'Estado del Clásico en el cuerpo de la cápsula' },
      { text: 'ink', background: 'orange', kind: 'ui', where: 'Marcos sobre naranja (líneas de impacto del Nivel de poder, tapa de la cápsula)' },
      { text: 'ink', background: 'sky-blue', kind: 'ui', where: 'Marcos y contorno de los títulos sobre el cielo' },
      { text: 'ink', background: 'cloud', kind: 'ui', where: 'Marcos y contorno de las nubes sobre el horizonte claro' },
      { text: 'ink', background: 'logo-yellow-top', kind: 'ui', where: 'Contorno negro de los títulos sobre el amarillo (arriba)' },
      { text: 'ink', background: 'logo-yellow-bottom', kind: 'ui', where: 'Contorno negro de los títulos sobre el amarillo (abajo)' },
      { text: 'ink', background: 'logo-red-top', kind: 'ui', where: 'Contorno negro de los títulos sobre el rojo (arriba)' },
      { text: 'ink', background: 'cream', kind: 'ui', where: 'Marcos y anillo de foco sobre los paneles' },
      { text: 'cream', background: 'blue', kind: 'ui', where: 'Halo del anillo de foco sobre azul' },
    ],
  },
} as const satisfies FranchiseConfig;
