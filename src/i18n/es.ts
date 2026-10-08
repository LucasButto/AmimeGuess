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
    modesLabel: 'Modos de juego',
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
    hiddenValue: 'Oculto: pertenece a una serie que apagaste',
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
      hiddenNote: 'Si el valor de una columna pertenece a una serie que apagaste, se ve como — y no se compara.',
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
  textClue: {
    inputLabel: 'Tu intento',
    clueTitle: 'La pista',
    hintsTitle: 'Más pistas',
    hintLocked: (remaining: number) =>
      `Se desbloquea con ${remaining} ${plural(remaining, 'intento fallido más', 'intentos fallidos más')}`,
    attempts: (count: number) => `${count} ${plural(count, 'intento', 'intentos')}`,
    failedTitle: 'Intentos fallidos',
    empty: 'Todavía no hiciste ningún intento.',
    wrongAttempt: (name: string) => `${name} no es.`,
    help: {
      goal: 'Adiviná la respuesta del día a partir de la pista. Escribí un nombre, elegí una opción de la lista y probá las veces que haga falta.',
      hintsTitle: 'Pistas',
      hintsIntro: 'Cuando fallás varias veces se desbloquean más pistas:',
      hint: (label: string, after: number) =>
        `${label}: a los ${after} ${plural(after, 'intento fallido', 'intentos fallidos')}.`,
    },
  },
  higherLower: {
    roundLabel: (round: number) => `Ronda ${round}`,
    score: (score: number) => `Aciertos seguidos: ${score}`,
    optionsLabel: 'Opciones',
    higher: 'Mayor',
    picked: 'Tu elección',
    next: 'Siguiente',
    correct: '¡Correcto!',
    wrong: (winner: string) => `Fallaste: ${winner} tenía el valor mayor.`,
    perfect: '¡Acertaste todas las rondas!',
    noRounds: 'Con estos filtros no hay pares para comparar. Activá más series.',
    announceCorrect: (name: string) => `Correcto: ${name} tenía el valor mayor.`,
    announceWrong: (name: string) => `Incorrecto: ${name} tenía el valor mayor.`,
    lastRound: (winner: string, winnerValue: string, loser: string, loserValue: string) =>
      `Tenía el mayor valor ${winner} (${winnerValue}), frente a ${loser} (${loserValue}).`,
    help: {
      goal: 'Elegí cuál de los dos tiene el valor mayor. Si acertás, sigue otro par; la partida termina con el primer error y tu puntaje son los aciertos seguidos.',
      sequence: 'Los pares son los mismos para todo el mundo con los mismos filtros, y nunca empatan.',
      metricsTitle: 'Qué se compara',
      metricsIntro: 'Cada día se juega una de estas medidas, en rotación:',
    },
  },
  revealList: {
    inputLabel: 'Tu intento',
    listTitle: 'Las pistas',
    position: (position: number) => `Pista ${position}`,
    hidden: 'Todavía oculta',
    attempts: (count: number) => `${count} ${plural(count, 'intento', 'intentos')}`,
    failedTitle: 'Intentos fallidos',
    empty: 'Todavía no hiciste ningún intento.',
    wrongAttempt: (name: string, revealed: boolean) =>
      revealed ? `${name} no es. Se reveló una pista más.` : `${name} no es.`,
    help: {
      goal: 'Adiviná la respuesta del día con las pistas. Escribí un nombre, elegí una opción de la lista y probá las veces que haga falta.',
      reveal: 'Al empezar ves una sola pista; cada intento fallido revela una más.',
    },
  },
  timeline: {
    instructions: 'Ordená los sucesos del más antiguo al más reciente.',
    oldest: 'Más antiguo',
    newest: 'Más reciente',
    listLabel: 'Sucesos para ordenar',
    attempt: (current: number, total: number) => `Intento ${current} de ${total}`,
    confirm: 'Confirmar orden',
    moveFirst: 'Cambiá algo del orden antes de volver a confirmar.',
    moveUp: (text: string) => `Subir: ${text}`,
    moveDown: (text: string) => `Bajar: ${text}`,
    moved: (text: string, position: number, total: number) => `${text}: posición ${position} de ${total}.`,
    stateLocked: 'En su lugar',
    stateWrong: 'No va ahí',
    confirmed: (attempt: number, correct: number, total: number) =>
      `Intento ${attempt}: ${correct} de ${total} en su lugar.`,
    solvedAnnouncement: '¡Ordenados!',
    lostAnnouncement: 'Se acabaron los intentos.',
    correctOrderTitle: 'El orden correcto',
    answerLabel: (first: string, last: string) => `de «${first}» a «${last}»`,
    noPuzzle: 'Con estos filtros no hay suficientes sucesos para armar el reto. Activá más series.',
    help: {
      goal: (count: number) =>
        `Ordená ${count} sucesos del más antiguo (arriba) al más reciente (abajo).`,
      move: 'Arrastrá un suceso desde su asa (las rayitas de la izquierda) o usá los botones de subir y bajar; con el teclado, los botones.',
      attempts: (total: number) =>
        `Tenés ${total} intentos. Al confirmar, los sucesos que están en su lugar quedan fijos y el resto se sigue moviendo.`,
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
      // Modos de puntaje: no se gana ni se pierde, se juega hasta el primer error.
      scoreTitle: 'Fin de la racha',
      scoreSummary: (score: number, streak: number) =>
        `${score === 0 ? 'No acertaste ninguna.' : `Acertaste ${score} ${plural(score, 'seguida', 'seguidas')}.`} Racha: ${streak} ${plural(streak, 'día', 'días')}.`,
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
      // Modos de puntaje.
      bestScore: 'Mejor puntaje',
      scoreDistribution: 'Aciertos seguidos por partida',
      scoreDistributionRow: (label: string, count: number) =>
        `${label} aciertos: ${count} ${plural(count, 'partida', 'partidas')}`,
    },
  },
  share: {
    header: (franchise: string, mode: string) => `AnimeGuess · ${franchise} · ${mode}`,
    filters: (words: string) => `Series: ${words}`,
    allSeries: 'todas',
    and: 'y',
    won: (attempts: number) => `Lo resolví en ${attempts} ${plural(attempts, 'intento', 'intentos')}`,
    lost: 'Hoy no lo resolví',
    score: (score: number) => `Racha de aciertos: ${score}`,
    omitted: '…',
  },
} as const;
