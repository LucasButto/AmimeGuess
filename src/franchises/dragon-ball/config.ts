import sagasJson from '../../../data/dragon-ball/sagas.json';
import type { ClassicValueLabel } from '../../modes/classic/types';
import type { FranchiseConfig } from '../types';

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
  series: ['db', 'dbz', 'gt', 'super', 'daima'],
  seriesLabels: {
    db: seriesLabels.db,
    dbz: seriesLabels.dbz,
    gt: seriesLabels.gt,
    super: seriesLabels.super,
    daima: seriesLabels.daima,
  },
  modes: [
    {
      slug: 'clasico',
      name: 'Clásico',
      engine: 'classic',
      classic: {
        columns: [
          { key: 'genero', label: 'Género', compare: 'exact' },
          { key: 'razas', label: 'Raza', compare: 'set' },
          { key: 'afiliaciones', label: 'Afiliación', compare: 'set' },
          { key: 'planeta', label: 'Planeta de origen', compare: 'exact' },
          // Cada forma lleva la serie en que se ve: con una serie apagada, sus formas no aparecen (regla 3).
          { key: 'transformaciones', label: 'Transformaciones', compare: 'set' },
          // Se compara el lugar en la cronología (el orden de las series lo fija sagas.json); se muestra el nombre.
          // Si la serie del debut está apagada, el valor se oculta: lo excluido no aparece nunca.
          { key: 'serieDebut', label: 'Serie de debut', compare: 'ordered', valueLabels: serieDebutLabels },
          { key: 'sagaDebut', label: 'Saga de debut', compare: 'ordered', valueLabels: sagaDebutLabels },
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
      // Solo el arte de fondo transparente: con fondo, la sombra sería un rectángulo negro. Los demás se pueden intentar.
      imageReveal: { variant: 'silhouette', requireAttr: { key: 'imagenTransparente', equals: 1 } },
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
    { slug: 'zoom', name: 'Zoom', engine: 'image-reveal', imageReveal: { variant: 'zoom' } },
    {
      slug: 'poder',
      name: 'Nivel de poder',
      engine: 'higher-lower',
      // Un orden de magnitud de diferencia como mínimo: los valores de ki de la API no son precisos ni oficiales.
      higherLower: {
        minRatio: 10,
        metrics: [
          {
            key: 'ki',
            label: 'Ki máximo',
            question: '¿Quién tiene más ki?',
            scientific: true,
            note: 'Valores aproximados de Dragon Ball API: solo hay cifras oficiales hasta la saga de Freezer. Los dos de cada par difieren al menos 10 veces.',
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
      timeline: { contentKind: 'event', textField: 'text', orderField: 'order' },
    },
  ],
} as const satisfies FranchiseConfig;
