/** Textos de interfaz (regla 8 de CLAUDE.md). Nada de texto visible dentro de los componentes. */

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const es = {
  site: {
    name: 'AnimeGuess',
    description: 'Juegos diarios de adivinanza de Pokémon, Dragon Ball, Naruto y Yu-Gi-Oh.',
  },
  home: {
    title: 'AnimeGuess',
    subtitle: 'Un reto nuevo cada día. Elegí una franquicia.',
    franchisesLabel: 'Franquicias',
  },
  franchise: {
    provisional: 'Página de la franquicia en construcción.',
    backToHome: 'Volver al inicio',
  },
  mode: {
    comingSoon: 'Próximamente',
    provisional: 'Este modo todavía no está disponible.',
    engineLabel: 'Motor',
    backToFranchise: 'Volver a la franquicia',
  },
  game: {
    loading: 'Cargando el reto…',
    loadError: 'No se pudieron cargar los datos. Probá recargar la página.',
    copyLink: 'Copiar link',
    linkCopied: 'Link copiado',
    linkCopyFailed: 'No se pudo copiar el link',
  },
  filters: {
    title: 'Filtros',
    hint: 'Apagá las series que no querés que aparezcan.',
    groupLabel: 'Filtrar por serie',
    remaining: (count: number) => `${count} ${plural(count, 'posible', 'posibles')}`,
    belowMinimum: (remaining: number, minimum: number) =>
      `Con estos filtros quedan ${remaining} y hacen falta al menos ${minimum} para jugar este modo. Activá más series.`,
    keepOne: 'Tiene que quedar al menos una serie activa.',
  },
  autocomplete: {
    placeholder: 'Escribí un nombre…',
    noResults: 'Sin coincidencias',
    results: (count: number) => `${count} ${plural(count, 'sugerencia', 'sugerencias')}`,
  },
  classic: {
    inputLabel: 'Tu intento',
    tableCaption: 'Intentos, del más reciente al más antiguo',
    nameHeader: 'Nombre',
    empty: 'Todavía no hiciste ningún intento.',
    attempts: (count: number) => `${count} ${plural(count, 'intento', 'intentos')}`,
    lastAttempt: (name: string) => `Intento agregado: ${name}`,
    cellExact: 'Coincide',
    cellPartial: 'Coincide en parte',
    cellNone: 'No coincide',
    answerHigher: 'La respuesta es mayor',
    answerLower: 'La respuesta es menor',
    noValue: 'Ninguno',
    hintsTitle: 'Pistas',
    hintLocked: (remaining: number) =>
      `Se desbloquea con ${remaining} ${plural(remaining, 'intento fallido más', 'intentos fallidos más')}`,
    wonTitle: '¡Lo adivinaste!',
    wonText: (name: string, attempts: number) =>
      `Era ${name}. Lo lograste en ${attempts} ${plural(attempts, 'intento', 'intentos')}.`,
  },
} as const;
