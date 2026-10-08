import type { FranchiseConfig } from '../types';

export const pokemonConfig = {
  slug: 'pokemon',
  name: 'Pokémon',
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
  modes: [
    {
      slug: 'clasico',
      name: 'Clásico',
      engine: 'classic',
      classic: {
        columns: [
          { key: 'tipo1', label: 'Tipo 1', compare: 'exact' },
          { key: 'tipo2', label: 'Tipo 2', compare: 'exact' },
          { key: 'generacion', label: 'Generación', compare: 'ordered' },
          { key: 'colores', label: 'Color', compare: 'set' },
          { key: 'etapa', label: 'Etapa evolutiva', compare: 'ordered' },
          { key: 'altura', label: 'Altura', compare: 'ordered', unit: 'm' },
          { key: 'peso', label: 'Peso', compare: 'ordered', unit: 'kg' },
          { key: 'gruposHuevo', label: 'Grupo huevo', compare: 'set' },
          // PokéAPI solo tiene hábitat de g1 a g3 (386 de 1025): la columna aparece
          // únicamente cuando todas las series activas son de ese rango (SPEC 3.4).
          { key: 'habitat', label: 'Hábitat', compare: 'exact', onlyForSeries: ['g1', 'g2', 'g3'] },
        ],
        hints: [
          { kind: 'attr', label: 'Habilidad', after: 4, key: 'habilidad' },
          // La pista de la carta borrosa (tras 7 fallos) necesita una pista de imagen en el Clásico, que
          // todavía no existe: las cartas ya están en los datos (kind "tcg-card") para cuando se agregue.
          { kind: 'content', label: 'Descripción', after: 10, contentKind: 'dex', field: 'text' },
        ],
      },
    },
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal', imageReveal: { variant: 'silhouette' } },
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
      imageReveal: { variant: 'blur', imageContentKind: 'tcg-card' },
    },
    {
      slug: 'movimiento-insignia',
      name: 'Movimiento insignia',
      engine: 'text-clue',
      // Un movimiento que solo aprende una línea evolutiva: el nombre al principio, y el tipo y el texto si se falla.
      // Cuenta como acierto cualquier Pokémon de la línea que lo aprenda (ver `accepts` en los datos).
      textClue: {
        contentKind: 'signature-move',
        lines: [
          { kind: 'content', label: 'Movimiento', after: 0, field: 'name' },
          { kind: 'content', label: 'Tipo', after: 3, field: 'type' },
          { kind: 'content', label: 'Descripción', after: 6, field: 'description' },
        ],
      },
    },
    { slug: 'zoom', name: 'Zoom', engine: 'image-reveal', imageReveal: { variant: 'zoom' } },
    {
      slug: 'mayor-o-menor',
      name: 'Mayor o Menor',
      engine: 'higher-lower',
      // Una métrica por día, en este orden. Los tres atributos existen para los 1025 Pokémon.
      higherLower: {
        metrics: [
          { key: 'peso', label: 'Peso', question: '¿Cuál pesa más?', unit: 'kg' },
          { key: 'altura', label: 'Altura', question: '¿Cuál es más alto?', unit: 'm' },
          { key: 'totalEstadisticas', label: 'Total de estadísticas base', question: '¿Cuál tiene más estadísticas base en total?' },
        ],
      },
    },
    {
      slug: 'moveset',
      name: 'Moveset',
      engine: 'reveal-list',
      // Sus 4 movimientos menos comunes, del más común al menos común: cada fallo revela uno más.
      revealList: { contentKind: 'moveset', field: 'items', label: 'Movimientos' },
    },
  ],
} as const satisfies FranchiseConfig;
