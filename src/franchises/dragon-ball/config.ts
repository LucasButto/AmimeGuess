import sagasJson from '../../../data/dragon-ball/sagas.json';
import boardJson from '../../../data/dragon-ball/source/casillas.json';
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

/** Cada posición de la cronología apunta al nombre de la saga y a su serie. */
const sagaDebutLabels: Readonly<Record<string, ClassicValueLabel>> = Object.fromEntries(
  sagasJson.sagas.map((saga) => [String(saga.order), { label: saga.name, series: saga.series }]),
);

export const dragonBallConfig = {
  slug: 'dragon-ball',
  name: 'Dragon Ball',
  // Versus, Contrarreloj: segundos de más en el tiempo por defecto por cada serie activa desde la segunda.
  versusSecondsPerExtraSeries: 0,
  // Todos los personajes tienen imagen: el autocompletado la muestra en miniatura (se midió que escribir sigue fluido).
  autocompleteThumbnails: true,
  entityNoun: { one: 'personaje', many: 'personajes' },
  // En el orden de la historia (el de los filtros y el de la cronología de los datos): Daima ocurre entre Z y Super, y GT
  // al final. Es el orden elegido por el usuario el 2026-10-14; `data/dragon-ball/source/sagas.json` (`seriesOrder`) lo repite.
  series: ['db', 'dbz', 'daima', 'super', 'gt'],
  // Escribir "db" trae los personajes de Dragon Ball; "dbz", los de Z; "dbd", los de Daima; "dbs", los de Super; "dbgt", los de GT.
  seriesSearchTags: {
    db: ['db', 'dragonball'],
    dbz: ['dbz', 'dragonballz'],
    daima: ['dbd', 'dbdaima', 'daima'],
    super: ['dbs', 'dbsuper'],
    gt: ['dbgt', 'gt'],
  },
  seriesLabels: {
    db: seriesLabels.db,
    dbz: seriesLabels.dbz,
    daima: seriesLabels.daima,
    super: seriesLabels.super,
    gt: seriesLabels.gt,
  },
  modes: [
    {
      slug: 'clasico', versusIcon: 'classic',
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
          // Se compara el orden global de las sagas en sagas.json.
          // Si la serie del debut está apagada, el valor se oculta: lo excluido no aparece nunca.
          { key: 'sagaDebut', label: 'Saga de debut', compare: 'ordered', valueLabels: sagaDebutLabels, help: help.sagaDebut },
  ],
        hints: [],
      },
    },
    {
      slug: 'silueta', versusIcon: 'silhouette',
      name: 'Silueta',
      engine: 'image-reveal',
      // Un zoom sobre la sombra negra del personaje: parte de un costado y se abre hacia el centro (la silueta no se
      // ilumina). Solo el arte de fondo transparente: con fondo, la sombra sería un rectángulo negro. Los demás se pueden intentar.
      imageReveal: { variant: 'zoom-silhouette', requireAttr: { key: 'imagenTransparente', equals: 1 } },
    },
    {
      slug: 'frase', versusIcon: 'quote',
      name: 'Frase',
      engine: 'text-clue',
      // Primero se revela a quién va dirigida la frase y luego la raza de quien la dijo.
      textClue: {
        contentKind: 'quote',
        preferredContentFlag: 'famous',
        // Para admitir solo citas literales, configurar requiredContentFlag: 'literal'.
        lines: [
          { kind: 'content', label: 'Frase', after: 0, field: 'text' },
          { kind: 'content', label: es.textClue.addressee, after: 3, field: 'addressee' },
          { kind: 'attr', label: 'Raza', after: 6, keys: ['razas'] },
        ],
      },
    },
    {
      slug: 'quiz', versusIcon: 'description',
      name: 'Quiz',
      engine: 'quiz',
      // Una pregunta rebuscada por día, con una sola respuesta correcta (un personaje) entre 12 opciones que aparecen
      // siempre en orden aleatorio, en la grilla de nombres de Conexiones. Las preguntas salen de
      // `data/dragon-ball/source/quiz.json`; `try` de data/mode.json fija los intentos (uno por defecto).
      quiz: {
        contentKind: 'question',
        questionField: 'question',
        correctField: 'correct',
        distractorsField: 'distractors',
        explanationField: 'explanation',
        scopeField: 'scope',
      },
    },
    {
      slug: 'tecnica', versusIcon: 'technique',
      name: 'Técnica',
      engine: 'image-reveal',
      // La pista es un clip en bucle de una técnica (cada uno con su video y su póster; no quedan imágenes fijas) y la respuesta, quien la usa. Cuenta como acierto cualquiera de los personajes que la usan (ver `accepts` en los
      // datos). Una técnica tiene más de un clip: el contador cuenta clips, y al terminar el reto se nombra la técnica ("Era Goku –
      // Kamehameha"). El desenfoque es algo más fuerte que el de Jutsu (se acertaba a la primera con la escena en movimiento) y más suave que el de una imagen.
      imageReveal: { variant: 'blur', imageContentKind: 'technique', showsContentName: true, countNoun: { one: 'técnica', many: 'técnicas' }, blurLevels: [1.25, 0.95, 0.7, 0.5, 0.32, 0.18], compactDifficulty: true },
    },
    {
      slug: 'linea-de-tiempo', versusIcon: 'timeline',
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
    {
      slug: 'conexiones', versusIcon: 'connections',
      name: 'Conexiones',
      engine: 'connections',
      // Cuatro grupos de cuatro personajes por tablero, de fácil a difícil. Los grupos salen de
      // `data/dragon-ball/source/conexiones.json` (con la lista completa de miembros de cada uno).
      connections: { contentKind: 'group', nameField: 'name', membersField: 'members', difficultyField: 'difficulty' },
    },
          { slug: 'casillas', versusIcon: 'moveset', name: es.categoryBoard.name, engine: 'category-board', categoryBoard: { reassignCurrent: true, roster: boardJson.roster, exclusions: boardJson.exclusions, categories: boardJson.categories.map((category) => ({ ...category, ...es.categoryBoard.categories[category.id] })) } },
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
      { text: 'ink', background: 'orange', kind: 'ui', where: 'Marcos sobre naranja (tapa de la cápsula)' },
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
