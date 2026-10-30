import { es } from '../../i18n/es';
import type { FranchiseConfig } from '../types';
import { POKEMON_PALETTE } from './palette';

// Ayudas (botón ⓘ) de las columnas del Clásico.
const help = es.help.pokemon;

export const pokemonConfig = {
  slug: 'pokemon',
  name: 'Pokémon',
  entityNoun: { one: 'Pokémon', many: 'Pokémon' },
  series: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'],
  seriesLabels: {
    g1: 'Gen 1',
    g2: 'Gen 2',
    g3: 'Gen 3',
    g4: 'Gen 4',
    g5: 'Gen 5',
    g6: 'Gen 6',
    g7: 'Gen 7',
    g8: 'Gen 8',
    g9: 'Gen 9',
  },
  // La región de cada generación: los chips de filtro la muestran desde `sm` (sesión 15).
  seriesDetails: {
    g1: 'Kanto',
    g2: 'Johto',
    g3: 'Hoenn',
    g4: 'Sinnoh',
    g5: 'Teselia',
    g6: 'Kalos',
    g7: 'Alola',
    g8: 'Galar',
    g9: 'Paldea',
  },
  // Sugerencias del autocompletado con la miniatura de cada Pokémon (sesión 15).
  autocompleteThumbnails: true,
  modes: [
    {
      slug: 'clasico',
      name: 'Clásico',
      engine: 'classic',
      classic: {
        columns: [
          { key: 'tipo1', label: 'Tipo 1', compare: 'exact', matchAnyOf: ['tipo2'], help: help.tipo1 },
          { key: 'tipo2', label: 'Tipo 2', compare: 'exact', matchAnyOf: ['tipo1'], help: help.tipo2 },
          { key: 'generacion', label: 'Generación', compare: 'ordered', help: help.generacion },
          { key: 'colores', label: 'Color', compare: 'set', help: help.colores },
          { key: 'etapa', label: 'Etapa evolutiva', compare: 'ordered', help: help.etapa },
          { key: 'altura', label: 'Altura', compare: 'ordered', unit: 'm', help: help.altura },
          { key: 'peso', label: 'Peso', compare: 'ordered', unit: 'kg', help: help.peso },
          // La primera letra del nombre: verde si es la misma que la de la respuesta, rojo si no.
          { key: 'inicial', label: 'Inicial', compare: 'exact', large: true, help: help.inicial },
          // PokéAPI solo tiene hábitat de g1 a g3 (386 de 1025): la columna aparece
          // únicamente cuando todas las series activas son de ese rango (SPEC 3.4).
          { key: 'habitat', label: 'Hábitat', compare: 'exact', onlyForSeries: ['g1', 'g2', 'g3'], help: help.habitat },
        ],
        hints: [
          { kind: 'attr', label: 'Habilidad', after: 4, key: 'habilidad' },
          // La pista de la carta borrosa (tras 7 fallos) necesita una pista de imagen en el Clásico, que
          // todavía no existe: las cartas ya están en los datos (kind "tcg-card") para cuando se agregue.
          { kind: 'content', label: 'Descripción', after: 10, contentKind: 'dex', field: 'text' },
        ],
      },
    },
    // Un zoom sobre la sombra negra del Pokémon: parte de un costado y se abre hacia el centro (la silueta no se ilumina).
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal', imageReveal: { variant: 'zoom-silhouette' } },
    {
      slug: 'descripcion',
      name: 'Descripción',
      engine: 'text-clue',
      // La entrada de la Pokédex en español, con el nombre en "???". Los tipos y la generación ayudan si se falla.
      textClue: {
        contentKind: 'dex',
        lines: [
          { kind: 'content', label: 'Descripción', after: 0, field: 'text' },
          { kind: 'attr', label: 'Tipos', after: 3, keys: ['tipo1', 'tipo2'] },
          { kind: 'attr', label: 'Generación', after: 6, keys: ['generacion'] },
        ],
      },
    },
    {
      slug: 'carta',
      name: 'Carta',
      engine: 'image-reveal',
      // La imagen es una carta del TCG (hasta 2 por Pokémon, una por día) y la respuesta, su Pokémon.
      imageReveal: { variant: 'blur', imageContentKind: 'tcg-card', blurLevels: [0.65, 0.5, 0.35, 0.23, 0.12, 0.04] },
    },
    {
      slug: 'movimiento-insignia',
      name: 'Movimiento insignia',
      engine: 'text-clue',
      // Un movimiento que solo aprende una línea evolutiva: el nombre al principio; si se falla, los tipos del Pokémon, el
      // tipo del movimiento y el texto.
      // Cuenta como acierto cualquier Pokémon de la línea que lo aprenda (ver `accepts` en los datos).
      textClue: {
        contentKind: 'signature-move',
        lines: [
          { kind: 'content', label: 'Movimiento', after: 0, field: 'name' },
          // Los dos tipos del Pokémon (como en las demás pistas de tipos) y, aparte, el tipo del movimiento.
          { kind: 'attr', label: 'Tipos del Pokémon', after: 3, keys: ['tipo1', 'tipo2'] },
          { kind: 'content', label: 'Tipo del movimiento', after: 3, field: 'type' },
          { kind: 'content', label: 'Descripción', after: 6, field: 'description' },
        ],
      },
    },
    {
      slug: 'mayor-o-menor',
      name: 'Mayor o Menor',
      engine: 'higher-lower',
      // Una métrica por día, en este orden; quien juega también puede elegir cuál comparar. Los atributos existen para
      // los 1025 Pokémon.
      higherLower: {
        metrics: [
          { key: 'peso', label: 'Peso', question: '¿Cuál pesa más?', unit: 'kg' },
          { key: 'altura', label: 'Altura', question: '¿Cuál es más alto?', unit: 'm' },
          { key: 'totalEstadisticas', label: 'Total de estadísticas base', short: 'Total', question: '¿Cuál tiene más estadísticas base en total?' },
          { key: 'ps', label: 'PS', question: '¿Cuál tiene más PS base?' },
          { key: 'ataque', label: 'Ataque', question: '¿Cuál tiene más Ataque base?' },
          { key: 'defensa', label: 'Defensa', question: '¿Cuál tiene más Defensa base?' },
          { key: 'ataqueEspecial', label: 'Ataque especial', short: 'At. especial', question: '¿Cuál tiene más Ataque especial base?' },
          { key: 'defensaEspecial', label: 'Defensa especial', short: 'Def. especial', question: '¿Cuál tiene más Defensa especial base?' },
          { key: 'velocidad', label: 'Velocidad', question: '¿Cuál tiene más Velocidad base?' },
          { key: 'numero', label: 'Número de la Pokédex', short: 'N.º Pokédex', question: '¿Cuál tiene el número de la Pokédex más alto?' },
        ],
      },
    },
    {
      slug: 'moveset',
      name: 'Moveset',
      engine: 'reveal-list',
      // Sus 4 movimientos menos comunes, del más común al menos común: cada fallo revela uno más.
      revealList: {
        contentKind: 'moveset',
        field: 'items',
        label: 'Movimientos',
        // Aparte de los movimientos, tres pistas sobre el Pokémon que se desbloquean al fallar.
        hints: [
          { kind: 'attr', label: 'Tipos', after: 2, keys: ['tipo1', 'tipo2'] },
          { kind: 'attr', label: 'Inicial', after: 4, keys: ['inicial'] },
          { kind: 'attr', label: 'Generación', after: 6, keys: ['generacion'] },
        ],
      },
    },
  ],
  // Retro de Game Boy Advance (sesión 15): paleta corta y plana, panel crema con tinta oscura, marcos negros
  // y rojo de Poké Ball. La piel (theme/) la usa a través de los tokens y de las variables --palette-*.
  theme: {
    scheme: 'light',
    colors: {
      bg: '#b8e8f8',
      surface: '#f8f8f0',
      stage: '#f8f8f0',
      text: '#383838',
      'text-muted': '#585858',
      border: '#202020',
      accent: '#b82828',
      'accent-contrast': '#ffffff',
      focus: '#202020',
      match: '#2c6c2c',
      partial: '#a85400',
      miss: '#b82828',
      'on-result': '#ffffff',
    },
    // Press Start 2P (grilla de 8 px) para títulos; Jersey 10 para el resto: letras comunes y dígitos que no se confunden.
    // Jersey es más angosta y de mayúsculas más bajas: la piel sube los tamaños de texto con `--font-scale`.
    headingFont: { id: 'press-start-2p', fallback: '"Courier New", ui-monospace, monospace' },
    bodyFont: { id: 'jersey-10', fallback: 'system-ui, sans-serif' },
    radius: { sm: '0', md: '0', lg: '0' },
    cardShadow: 'none',
    headingStyle: { letterSpacing: '0', textTransform: 'none' },
    background: '/themes/pokemon.svg',
    // La paleta GBA (palette.ts): 24 colores como mucho, contando los de `colors`.
    palette: POKEMON_PALETTE,
    pairs: [
      { text: 'ink', background: 'cream', kind: 'text', where: 'Texto de paneles, cuadros de diálogo y celdas de la tabla' },
      { text: 'text-muted', background: 'cream', kind: 'text', where: 'Texto secundario sobre los paneles' },
      { text: 'accent', background: 'cream', kind: 'text', where: 'Enlaces sobre los paneles' },
      { text: 'cream', background: 'night', kind: 'text', where: 'Texto de la pantalla de la Pokédex' },
      { text: 'yellow', background: 'night', kind: 'text', where: 'Estado resaltado en la pantalla de la Pokédex' },
      { text: 'white', background: 'red', kind: 'text', where: 'Botón principal (cápsula roja) y botón A' },
      { text: 'white', background: 'blue', kind: 'text', where: 'Botón secundario (cápsula azul) y barra de título de los modales' },
      { text: 'text-muted', background: 'cloud-shade', kind: 'text', where: 'Chip de filtro apagado y botón deshabilitado' },
      { text: 'ink', background: 'gray', kind: 'text', where: 'Botón B (cerrar, volver)' },
      { text: 'ink', background: 'yellow', kind: 'text', where: 'Chips y marcas sobre amarillo' },
      { text: 'white', background: 'grass-3', kind: 'text', where: 'Celda correcta' },
      { text: 'white', background: 'orange', kind: 'text', where: 'Celda parcial' },
      { text: 'white', background: 'accent', kind: 'text', where: 'Celda incorrecta' },
      { text: 'frame', background: 'sky-2', kind: 'ui', where: 'Marcos sobre el cielo claro' },
      { text: 'frame', background: 'sky-1', kind: 'ui', where: 'Marcos sobre el cielo' },
      { text: 'frame', background: 'cream', kind: 'ui', where: 'Marcos y anillo de foco sobre los paneles' },
      { text: 'cream', background: 'red', kind: 'ui', where: 'Halo del anillo de foco sobre rojo' },
      { text: 'cream', background: 'blue', kind: 'ui', where: 'Halo del anillo de foco sobre azul' },
      { text: 'cream', background: 'night', kind: 'ui', where: 'Estrellas del cielo de noche' },
      { text: 'red', background: 'frame', kind: 'ui', where: 'Bola roja contra su contorno' },
      { text: 'blue', background: 'frame', kind: 'ui', where: 'Bola azul contra su contorno' },
      { text: 'yellow', background: 'frame', kind: 'ui', where: 'Bola dorada contra su contorno' },
      { text: 'grass-2', background: 'frame', kind: 'ui', where: 'Bola verde contra su contorno' },
      { text: 'cyan', background: 'frame', kind: 'ui', where: 'Bola turquesa contra su contorno' },
      { text: 'night', background: 'cyan', kind: 'text', where: 'Pantalla de la Pokédex encendida (hover y foco)' },
      { text: 'ink', background: 'cyan', kind: 'text', where: 'Chip de filtro prendido' },
      { text: 'pink', background: 'frame', kind: 'ui', where: 'Bola rosa contra su contorno' },
      { text: 'frame', background: 'dawn', kind: 'ui', where: 'Marcos sobre el cielo del amanecer' },
      { text: 'frame', background: 'dusk', kind: 'ui', where: 'Marcos sobre el cielo del atardecer' },
    ],
  },
} as const satisfies FranchiseConfig;
