/** Textos de interfaz (regla 8 de CLAUDE.md). Nada de texto visible dentro de los componentes. */

import type { ModeCardState, ThemeFont } from '@/franchises/types';

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
    progress: (solved: number, total: number) => `${solved} de ${total} ${plural(total, 'reto', 'retos')} de hoy`,
    progressDone: '¡Completaste todos los de hoy!',
  },
  franchise: {
    provisional: 'Página de la franquicia en construcción.',
    modesLabel: 'Modos de juego',
    intro: (name: string) => `Los retos diarios de ${name}.`,
    progress: (solved: number, total: number) => `${solved} de ${total} ${plural(total, 'reto', 'retos')} de hoy resueltos`,
    mainMode: 'Modo principal',
    solved: 'Resuelto hoy',
    pending: 'Pendiente',
    /** Nombre accesible de una tarjeta de modo: "Modo: estado". */
    cardLabel: (mode: string, state: ModeCardState) =>
      state === 'unknown' ? mode : `${mode}: ${state === 'solved' ? 'resuelto hoy' : 'pendiente'}`,
  },
  nav: {
    label: 'Volver',
    home: 'Inicio',
  },
  footer: {
    label: 'Aviso legal',
    notice:
      'AnimeGuess es un proyecto de fans, sin afiliación con los titulares de las marcas Pokémon, Dragon Ball, Naruto ni Yu-Gi-Oh. Las marcas, los personajes y las imágenes pertenecen a sus dueños.',
    credits: 'Créditos',
  },
  // Página /creditos (SPEC 10). Los nombres de las fuentes y sus direcciones viven acá con su descripción; la lista de
  // textos CC BY-SA sale de los datos (cada contenido guarda su página de origen en `payload.source`).
  credits: {
    title: 'Créditos',
    description: 'Fuentes de datos e imágenes, licencias y atribuciones de AnimeGuess.',
    intro:
      'AnimeGuess es un proyecto de fans, gratuito, sin publicidad y sin afiliación con los titulares de Pokémon, Dragon Ball, Naruto ni Yu-Gi-Oh. Esta página reconoce de dónde sale cada dato y cada imagen, y atribuye cada texto que se reutiliza.',
    sources: {
      title: 'Fuentes de datos e imágenes',
      text: 'Los datos se descargan una sola vez con los scripts del proyecto y se sirven desde este sitio: mientras jugás no se consulta ninguna de estas fuentes.',
      groups: [
        {
          franchise: 'Pokémon',
          items: [
            { name: 'PokéAPI', url: 'https://pokeapi.co', text: 'Especies, tipos, estadísticas, movimientos, descripciones de la Pokédex en español y arte oficial.' },
            { name: 'TCGdex', url: 'https://tcgdex.dev', text: 'Imágenes de las cartas del juego de cartas coleccionables.' },
            { name: 'WikiDex', url: 'https://www.wikidex.net', text: 'Descripciones de la Pokédex de Leyendas Arceus y de la novena generación (CC BY-SA, más abajo).' },
          ],
        },
        {
          franchise: 'Dragon Ball',
          items: [
            { name: 'Dragon Ball API', url: 'https://dragonball-api.com', text: 'Personajes, transformaciones, niveles de ki e imágenes.' },
            {
              name: 'Dragon Ball Wiki Hispano (Fandom)',
              url: 'https://dragonball.fandom.com/es',
              text: 'Series en las que aparece cada personaje, frases (CC BY-SA, más abajo) e imágenes de personajes, técnicas y transformaciones.',
            },
          ],
        },
        {
          franchise: 'Naruto',
          items: [
            {
              name: 'Dattebayo API',
              url: 'https://dattebayo-api.onrender.com',
              text: 'Personajes, jutsus, naturalezas, kekkei genkai, afiliaciones, ocupaciones, equipos y clanes.',
            },
            {
              name: 'Narutopedia (Fandom)',
              url: 'https://naruto.fandom.com',
              text: 'Datos de los jutsus, frases traducidas al español (CC BY-SA, más abajo) e imágenes de personajes y jutsus.',
            },
          ],
        },
        {
          franchise: 'Yu-Gi-Oh',
          items: [
            { name: 'YGOPRODeck', url: 'https://ygoprodeck.com', text: 'Datos de las cartas e ilustraciones.' },
            { name: 'YGOResources', url: 'https://db.ygoresources.com', text: 'Nombres y textos oficiales de las cartas en español.' },
            {
              name: 'Yugipedia',
              url: 'https://yugipedia.com',
              text: 'Datos de los duelistas (género, primera aparición y mazos) e imágenes de los duelistas. Su texto tiene licencia CC BY-SA.',
            },
            { name: 'Yu-Gi-Oh! Wiki (Fandom)', url: 'https://yugioh.fandom.com', text: 'Series en las que aparece cada duelista.' },
          ],
        },
      ],
    },
    reuse: {
      title: 'Textos reutilizados (CC BY-SA)',
      text: 'Estos textos vienen de wikis con licencia Creative Commons Atribución-CompartirIgual. Se reproducen con atribución a la página de la que salen; las frases de Narutopedia se tradujeron al español, y esas traducciones se comparten bajo la misma licencia.',
      license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/deed.es' },
      // Un nombre por sitio de origen (el host de `payload.source`). Un test exige que todo sitio de los datos esté acá.
      sites: {
        'www.wikidex.net': { name: 'WikiDex', what: (count: number) => `${count} ${plural(count, 'descripción', 'descripciones')} de la Pokédex` },
        'dragonball.fandom.com': { name: 'Dragon Ball Wiki Hispano', what: (count: number) => `${count} ${plural(count, 'frase', 'frases')}` },
        'naruto.fandom.com': {
          name: 'Narutopedia',
          what: (count: number) => `${count} ${plural(count, 'frase traducida', 'frases traducidas')} al español`,
        },
      } as Record<string, { name: string; what: (count: number) => string }>,
      summary: (site: string, what: string) => `${site} · ${what}`,
      pageCount: (title: string, count: number) => (count === 1 ? title : `${title} (${count})`),
    },
    fonts: {
      title: 'Tipografías',
      text: 'Todas tienen licencia libre y se sirven desde este sitio.',
      license: { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
      // Una por id de `ThemeFont`: al sumar una tipografía a un tema, el tipo obliga a acreditarla acá.
      items: {
        'press-start-2p': { name: 'Press Start 2P', url: 'https://fonts.google.com/specimen/Press+Start+2P' },
        'jersey-10': { name: 'Jersey 10', url: 'https://fonts.google.com/specimen/Jersey+10' },
        rubik: { name: 'Rubik', url: 'https://fonts.google.com/specimen/Rubik' },
        bangers: { name: 'Bangers', url: 'https://fonts.google.com/specimen/Bangers' },
        'kaushan-script': { name: 'Kaushan Script', url: 'https://fonts.google.com/specimen/Kaushan+Script' },
        cinzel: { name: 'Cinzel', url: 'https://fonts.google.com/specimen/Cinzel' },
      } satisfies Record<ThemeFont, { name: string; url: string }>,
    },
    trademarks: {
      title: 'Marcas',
      items: [
        'Pokémon: © Nintendo, Creatures Inc., GAME FREAK inc. y The Pokémon Company. Pokémon y los nombres de sus personajes son marcas de Nintendo.',
        'Dragon Ball: © Bird Studio / Shueisha y Toei Animation.',
        'Naruto: © Masashi Kishimoto / Shueisha, TV Tokyo y Pierrot.',
        'Yu-Gi-Oh!: © Kazuki Takahashi / Studio Dice / Shueisha, TV Tokyo y Konami.',
      ],
      text: 'Las imágenes de personajes, técnicas y cartas pertenecen a sus titulares, vengan de la fuente que vengan, y se usan sin fines comerciales, como parte de un juego de fans.',
    },
    art: {
      title: 'Arte y herramientas',
      items: [
        'El arte de la interfaz (fondos, íconos y marcos) es propio: no se usan logotipos, sprites ni tipografías oficiales.',
        'Las siluetas de las cartas de Yu-Gi-Oh se recortan del fondo con el modelo BiRefNet (licencia MIT), ejecutado en local.',
      ],
    },
  },
  notFound: {
    title: 'Página no encontrada',
    text: 'La página que buscás no existe o cambió de lugar.',
    home: 'Volver al inicio',
  },
  errorPage: {
    title: 'Algo salió mal',
    text: 'Se produjo un error inesperado. Probá de nuevo; si sigue pasando, volvé al inicio.',
    retry: 'Reintentar',
    home: 'Volver al inicio',
  },
  meta: {
    franchise: (name: string, modes: number) =>
      `Juegos diarios de ${name}: ${modes} ${plural(modes, 'modo', 'modos')} con un reto nuevo cada día, para jugar solo o comparar con amigos.`,
    mode: (mode: string, franchise: string) =>
      `Reto diario del modo ${mode} de ${franchise}. Un reto nuevo cada día, el mismo para quien tenga los mismos filtros.`,
    imageAlt: (name: string) => `${name} en AnimeGuess`,
  },
  mode: {
    comingSoon: 'Próximamente',
    provisional: 'Este modo todavía no está disponible.',
  },
  game: {
    loading: 'Cargando el reto…',
    loadError: 'No se pudieron cargar los datos. Probá de nuevo.',
    retry: 'Reintentar',
    copyLink: 'Copiar link',
    linkCopied: 'Link copiado',
    linkCopyFailed: 'No se pudo copiar el link',
  },
  filters: {
    // Interruptores de la partida (debajo de las series), en los modos donde cambian algo.
    filler: 'Relleno',
    manga: 'Arcos del manga',
    title: 'Filtros',
    hint: 'Apagá las series que no querés que aparezcan.',
    groupLabel: 'Filtrar por serie',
    // "171 personajes posibles"; sin nombre, solo "171 posibles".
    remaining: (count: number, noun?: { readonly one: string; readonly many: string }) =>
      `${count} ${noun ? `${plural(count, noun.one, noun.many)} ` : ''}${plural(count, 'posible', 'posibles')}`,
    // Lo que cuentan los modos que no adivinan entidades de la franquicia.
    nouns: {
      events: { one: 'suceso', many: 'sucesos' },
      groups: { one: 'grupo', many: 'grupos' },
    },
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
    // Al terminar de revelarse una fila, un único aviso la resume: "Pikachu: Tipo 1 correcto, Altura mayor, …".
    revealSummary: (name: string, parts: readonly string[]) => `${name}: ${parts.join(', ')}.`,
    cellSummary: { exact: 'correcto', partial: 'parcial', none: 'incorrecto', higher: 'mayor', lower: 'menor', hidden: 'oculto' },
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
        'zoom-silhouette':
          'Adiviná la respuesta del día a partir de un detalle ampliado de su silueta. Escribí un nombre y elegí una opción de la lista.',
      },
      stepsTitle: 'Pistas',
      steps: (total: number) =>
        `Cada intento fallido revela un poco más de la imagen, en ${total} pasos. Al acertar se ve completa.`,
      difficultyTitle: 'Dificultad',
      difficulty:
        'Podés apagar "Revelar con cada intento" para que la imagen no cambie hasta que aciertes, y "Mostrar colores" para verla en grises. Tus elecciones se recuerdan en este dispositivo.',
      // Con una silueta no hay colores que mostrar.
      difficultyNoColors:
        'Podés apagar "Revelar con cada intento" para que la imagen no cambie hasta que aciertes. Tu elección se recuerda en este dispositivo.',
    },
  },
  textClue: {
    inputLabel: 'Tu intento',
    clueTitle: 'La pista',
    hintsTitle: 'Pistas',
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
    hintsTitle: 'Más pistas',
    hintLocked: (remaining: number) =>
      `Se desbloquea con ${remaining} ${plural(remaining, 'intento fallido más', 'intentos fallidos más')}`,
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
    wrongOrder: 'Orden incorrecto. Cambiá algo y volvé a confirmar.',
    moveUp: (text: string) => `Subir: ${text}`,
    moveDown: (text: string) => `Bajar: ${text}`,
    moved: (text: string, position: number, total: number) => `${text}: posición ${position} de ${total}.`,
    stateLocked: 'En su lugar',
    confirmed: (attempt: number) => `Intento ${attempt}: orden incorrecto.`,
    solvedAnnouncement: '¡Ordenados!',
    lostAnnouncement: 'Se acabaron los intentos.',
    correctOrderTitle: 'El orden correcto',
    answerLabel: (first: string, last: string) => `de «${first}» a «${last}»`,
    noPuzzle: 'Con estos filtros no hay suficientes sucesos para armar el reto. Activá más series.',
    noPuzzleLevel: 'Con estos filtros no hay suficientes sucesos para esta dificultad. Activá más series o elegí una más fácil.',
    levelsLabel: 'Dificultad',
    levelNames: ['Fácil', 'Normal', 'Difícil'],
    level: (number: number) => `Dificultad ${number}`,
    levelCount: (count: number) => `${count} sucesos`,
    levelLocked: (name: string, needed: number, available: number) => `${name} necesita ${needed} sucesos y con estos filtros hay ${available}.`,
    orderHelpTopic: 'orden de los sucesos',
    help: {
      goal: (count: number) =>
        `Ordená ${count} sucesos del más antiguo (arriba) al más reciente (abajo).`,
      goalLevels: (counts: readonly number[]) =>
        `Ordená los sucesos del más antiguo (arriba) al más reciente (abajo). Elegí la dificultad: ${counts.join(', ')} sucesos. Cada una es un reto distinto del día, con su propia partida; las estadísticas y la racha cuentan todas juntas.`,
      attemptsLevels: (attempts: readonly number[]) =>
        `Tenés ${attempts.join(', ')} intentos según la dificultad. Al confirmar solo te decimos si el orden es correcto; no cuáles están bien. Al mover cualquiera, empezás de nuevo con la lista limpia.`,
      move: 'Arrastrá un suceso desde su asa (las rayitas de la izquierda) o usá los botones de subir y bajar; con el teclado, los botones.',
      attempts: (total: number) =>
        `Tenés ${total} intentos. Al confirmar solo te decimos si el orden es correcto; no cuáles están bien.`,
    },
  },
  connections: {
    instructions: 'Encontrá los 4 grupos de 4. Elegí 4 elementos que tengan algo en común y enviá.',
    gridLabel: 'Elementos para agrupar',
    solvedLabel: 'Grupos resueltos',
    unsolvedLabel: 'Los grupos que faltaban',
    mistakes: (left: number, total: number) => `Errores que podés cometer: ${left} de ${total}`,
    selectedCount: (count: number, total: number) => `${count} de ${total} elegidos`,
    submit: 'Enviar',
    clear: 'Deseleccionar todo',
    difficulties: ['Fácil', 'Media', 'Difícil', 'Muy difícil'],
    difficultyLabel: (name: string) => `Dificultad: ${name}`,
    oneAway: 'Casi: a uno de un grupo.',
    wrong: 'Esos cuatro no forman un grupo.',
    repeated: 'Ya probaste esa combinación.',
    foundAnnouncement: (name: string) => `Grupo encontrado: ${name}.`,
    wrongAnnouncement: (left: number) => `No es un grupo. Te ${plural(left, 'queda', 'quedan')} ${left} ${plural(left, 'error', 'errores')}.`,
    solvedAnnouncement: '¡Encontraste los cuatro grupos!',
    lostAnnouncement: 'Se acabaron los errores. Se muestran los grupos que faltaban.',
    noPuzzle: 'Con estos filtros no hay suficientes grupos para armar el tablero. Activá más series.',
    answerLabel: (names: readonly string[]) =>
      names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`,
    help: {
      goal: 'Hay 16 elementos que forman 4 grupos de 4. Tocá 4 que creas que van juntos y enviá.',
      result: 'Si acertás, el grupo se revela con su nombre. Si tres de los cuatro son de un mismo grupo, te avisamos que estás cerca.',
      mistakes: (total: number) =>
        `Podés equivocarte ${total} ${plural(total, 'vez', 'veces')}. Repetir una combinación que ya probaste no cuenta como error.`,
      unique: 'Cada elemento encaja en un solo grupo del tablero, aunque en otros juegos pueda estar en más de uno.',
      colors: 'Cada grupo tiene un color y un nivel de dificultad, de fácil a muy difícil.',
    },
  },
  shell: {
    modesLabel: 'Modos de juego',
    nextModes: 'Seguí jugando',
    nextModesLabel: 'Seguir con otro modo',
    // Modo infinito: partidas extra del mismo modo y los mismos filtros, sin esperar al reto de mañana.
    practice: {
      title: 'Modo infinito',
      intro: 'Seguí jugando este modo con los mismos filtros, sin esperar a mañana. No cuenta para tus estadísticas ni para tu racha.',
      start: 'Jugar en modo infinito',
      banner: 'No cuenta para tus estadísticas ni para tu racha.',
      next: 'Otra partida',
      back: 'Volver al reto de hoy',
      lostTitle: 'No salió',
      wonSummary: (attempts: number) => `Lo resolviste en ${attempts} ${plural(attempts, 'intento', 'intentos')}.`,
      lostSummary: 'Probá con otra partida.',
      scoreSummary: (score: number) =>
        score === 0 ? 'No acertaste ninguna.' : `Acertaste ${score} ${plural(score, 'seguida', 'seguidas')}.`,
    },
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
      // Título del resumen en los temas que nombran la respuesta al ganar.
      answerTitle: (label: string) => `¡Es ${label}!`,
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
  // Textos propios de la piel de Pokémon (sesión 15).
  // Textos de la piel de Dragon Ball (sesión 16): lo que se ve en sus tarjetas, su premio y sus efectos.
  dragonBallSkin: {
    capsuleSolved: (attempts: number) => `Resuelto en ${attempts} ${plural(attempts, 'intento', 'intentos')}`,
    capsuleSolvedToday: 'Resuelto hoy',
    capsulePending: 'Pendiente',
    wish: '¡Pedí un deseo!',
    ki: 'KI',
    // Antes de las semillas del ermitaño que marcan los intentos que quedan (línea de tiempo).
    attempts: 'Intentos',
    // Encabezado decorativo de la lente del rastreador (el campo del intento).
    scanning: 'Escaneando…',
    // El objetivo marcado en la lista de coincidencias del rastreador.
    locked: 'Objetivo fijado',
    // Lo que aparece un instante sobre cada celda del Clásico al revelarse, como en el manga.
    onomatopoeia: ['¡ZAS!', '¡PUM!', '¡DOOM!', '¡BAM!', '¡KRASH!', '¡FUUM!'],
  },
  pokemonSkin: {
    pokedexPending: 'Hoy: pendiente',
    pokedexSolved: (attempts: number) => `Resuelto en ${attempts} ${plural(attempts, 'intento', 'intentos')}`,
    pokedexSolvedToday: 'Resuelto hoy',
    play: 'Jugar',
    // Selector de Pokémon (reemplaza al campo de texto en los modos de adivinar).
    picker: {
      open: 'Elegir en la Pokédex',
      title: 'Pokédex',
      search: 'Buscar por nombre o número',
      placeholder: 'Pikachu, 25…',
      count: (count: number) => `${count} Pokémon`,
      available: (count: number) => `${count} Pokémon posibles`,
      empty: 'Ningún Pokémon coincide con esa búsqueda.',
      tried: 'ya probado',
      number: (value: number) => `N.º ${String(value).padStart(3, '0')}`,
      gridLabel: 'Pokémon',
    },
    statsTitle: 'Estadísticas base',
    // Medallero de la racha: desde la octava medalla, cuántos días más.
    medalsMore: (extra: number) => `+${extra}`,
    hp: 'PS',
    stats: {
      ps: 'PS',
      ataque: 'Ataque',
      defensa: 'Defensa',
      ataqueEspecial: 'At. Esp.',
      defensaEspecial: 'Def. Esp.',
      velocidad: 'Velocidad',
    },
  },
  // Ayudas de los botones ⓘ (SPEC 9.2): 140 caracteres como mucho y sin pistas sobre la respuesta.
  help: {
    button: (topic: string) => `Ayuda: ${topic}`,
    filters:
      'Las mismas series activas dan el mismo reto a todo el mundo. Cambiarlas cambia el reto de hoy.',
    hints: 'Cada pista se desbloquea sola después de una cantidad de intentos fallidos.',
    yesterday: 'La respuesta de ayer para esta misma combinación de series.',
    difficulty: 'Estas opciones solo cambian cómo ves la imagen. El reto y la respuesta del día son los mismos.',
    metric: 'La medida que se compara hoy. Cambia cada día y es la misma para todo el mundo.',
    filler: 'Si está activo, también sale el relleno: personajes y sucesos que están en el anime o en sus películas, pero no en el manga.',
    manga: 'Si está activo, también salen los arcos del manga aún sin adaptar al anime, como Moro y Granolah. Las películas siempre salen.',
    // Línea de tiempo de Dragon Ball: en qué orden van las series.
    timelineOrder: 'Los sucesos siguen la historia: Dragon Ball, Dragon Ball Z, Dragon Ball Daima, Dragon Ball Super y Dragon Ball GT, en ese orden.',
    // Columnas del Clásico de Dragon Ball.
    dragonBall: {
      genero: 'El género del personaje. Verde si es el mismo que el de la respuesta; rojo si no.',
      razas: 'Su raza (puede tener más de una). Verde si son las mismas que las de la respuesta; naranja si comparten alguna.',
      afiliaciones: 'Los grupos a los que pertenece. Verde si son los mismos que los de la respuesta; naranja si comparten alguno.',
      planeta: 'El planeta donde nació. Verde si es el mismo que el de la respuesta; rojo si no.',
      transformaciones: 'Las formas que alcanzó en las series activas. Verde si son las mismas; naranja si comparten alguna.',
      serieDebut: 'La serie en la que apareció por primera vez. La flecha indica si la respuesta debutó antes o después.',
      sagaDebut: 'La saga en la que apareció por primera vez. La flecha indica si la respuesta debutó antes o después.',
    },
    // Columnas del Clásico de Pokémon.
    pokemon: {
      tipo1: 'El primer tipo del Pokémon. Verde si es el mismo primer tipo que el de la respuesta; rojo si no.',
      tipo2: 'El segundo tipo, o "—" si tiene uno solo. Se compara con el segundo tipo de la respuesta.',
      generacion: 'La generación en la que apareció. La flecha indica si la de la respuesta es anterior o posterior.',
      colores: 'Sus colores. Verde si son los mismos que los de la respuesta; naranja si comparten alguno.',
      etapa: 'Su lugar en la cadena evolutiva: 1 si no evoluciona de otro. La flecha indica hacia dónde está la respuesta.',
      altura: 'La altura en metros. La flecha indica si la respuesta es más alta o más baja.',
      peso: 'El peso en kilos. La flecha indica si la respuesta pesa más o menos.',
      inicial: 'La primera letra del nombre. Verde si es la misma que la de la respuesta; rojo si no.',
      habitat: 'Dónde vive según los juegos de Kanto a Hoenn. Esta columna aparece solo con las generaciones 1 a 3.',
    },
  },
  settings: {
    button: 'Ajustes',
    title: 'Ajustes',
    legibleFont: 'Fuente legible',
    legibleFontHint: 'Cambia las letras del tema por una fuente de sistema, más fácil de leer.',
    sounds: 'Sonidos',
    soundsHint: 'Efectos cortos al jugar. Están apagados hasta que los prendas.',
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
