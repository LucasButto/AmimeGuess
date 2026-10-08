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
    help: {
      goal: 'Adiviná la respuesta del día. Escribí un nombre, elegí una opción de la lista y mirá cómo se compara con la respuesta.',
      colorsTitle: 'Qué significa cada color',
      exact: 'Verde: el valor coincide con el de la respuesta.',
      partial: 'Naranja: coincide en parte, por ejemplo comparten uno de dos valores.',
      none: 'Rojo: no coincide.',
      arrows: 'Una flecha hacia arriba o hacia abajo indica que el valor de la respuesta es mayor o menor que el del intento.',
      hintsTitle: 'Pistas',
      hintsIntro: 'Cuando fallás varias veces se desbloquean pistas:',
      hint: (label: string, after: number) =>
        `${label}: a los ${after} ${plural(after, 'intento fallido', 'intentos fallidos')}.`,
      columnsNote: 'Algunas columnas solo aparecen con ciertas series activas.',
    },
  },
  imageReveal: {
    inputLabel: 'Tu intento',
    imageAlt: 'Imagen del reto, parcialmente oculta',
    imageSolvedAlt: (label: string) => `Imagen completa: ${label}`,
    step: (current: number, total: number) => `Pista ${current} de ${total}`,
    attempts: (count: number) => `${count} ${plural(count, 'intento', 'intentos')}`,
    failedTitle: 'Intentos fallidos',
    empty: 'Todavía no hiciste ningún intento.',
    wrongAttempt: (name: string, revealed: boolean) =>
      revealed ? `${name} no es. Se reveló un poco más de la imagen.` : `${name} no es.`,
    difficultyTitle: 'Dificultad',
    revealSwitch: 'Revelar con cada intento',
    revealHint: 'Cada intento fallido muestra un poco más de la imagen.',
    colorsSwitch: 'Mostrar colores',
    colorsHint: 'Apagado, la imagen se ve en grises hasta que aciertes.',
    help: {
      goal: {
        silhouette: 'Adiviná la respuesta del día a partir de su silueta. Escribí un nombre y elegí una opción de la lista.',
        blur: 'Adiviná la respuesta del día a partir de una imagen desenfocada. Escribí un nombre y elegí una opción de la lista.',
        zoom: 'Adiviná la respuesta del día a partir de un detalle ampliado de su imagen. Escribí un nombre y elegí una opción de la lista.',
      },
      stepsTitle: 'Pistas',
      steps: (total: number) =>
        `Cada intento fallido revela un poco más de la imagen, en ${total} pasos. Al acertar se ve completa.`,
      difficultyTitle: 'Dificultad',
      difficulty:
        'Podés apagar "Revelar con cada intento" para que la imagen no cambie hasta que aciertes, y "Mostrar colores" para verla en grises. Tus elecciones se recuerdan en este dispositivo.',
    },
  },
  shell: {
    modesLabel: 'Modos de juego',
    modeSolved: 'resuelto hoy',
    modeSoon: 'próximamente',
    help: 'Cómo se juega',
    stats: 'Estadísticas',
    close: 'Cerrar',
    nextChallenge: 'Próximo reto en',
    yesterday: 'Ayer fue',
    helpTitle: 'Cómo se juega',
    helpCommonTitle: 'Reto diario',
    helpCommon: [
      'Hay un reto nuevo cada día a las 00:00 de Argentina (UTC-3), a la misma hora para todo el mundo.',
      'Dos personas con los mismos filtros ven el mismo reto. Copiá el link para jugar juntos.',
      'Cada combinación de series tiene su propio reto, y tu partida de cada una se guarda por separado.',
    ],
    result: {
      wonTitle: '¡Lo adivinaste!',
      lostTitle: 'Hoy no salió',
      answerWas: (label: string) => `Era ${label}.`,
      wonSummary: (attempts: number, streak: number) =>
        `Lo resolviste en ${attempts} ${plural(attempts, 'intento', 'intentos')}. Racha: ${streak} ${plural(streak, 'día', 'días')}.`,
      lostSummary: 'Mañana hay un reto nuevo.',
      share: 'Compartir resultado',
      shareCopied: 'Resultado copiado',
      shareFailed: 'No se pudo copiar',
    },
    statsView: {
      title: 'Estadísticas',
      played: 'Partidas',
      winRate: 'Victorias',
      currentStreak: 'Racha actual',
      maxStreak: 'Racha máxima',
      distribution: 'Intentos por victoria',
      distributionRow: (label: string, count: number) =>
        `${label} ${plural(count, 'intento', 'intentos')}: ${count} ${plural(count, 'victoria', 'victorias')}`,
      moreThan: (count: number) => `${count}+`,
      noGames: 'Todavía no jugaste ninguna partida de este modo.',
    },
  },
  share: {
    header: (franchise: string, mode: string) => `AnimeGuess · ${franchise} · ${mode}`,
    filters: (words: string) => `Series: ${words}`,
    allSeries: 'todas',
    and: 'y',
    won: (attempts: number) => `Lo resolví en ${attempts} ${plural(attempts, 'intento', 'intentos')}`,
    lost: 'Hoy no lo resolví',
    omitted: '…',
  },
} as const;
