"use client";

import { useEffect, useState } from "react";
import { AutocompleteOptions } from "@/components/Autocomplete";
import { PoolNounContext } from "@/components/FilterPanel";
import { Button } from "@/components/ui/Button";
import { ModeNav } from "@/components/game-shell/ModeNav";
import { useSkin } from "@/components/skin/context";
import { StatusMessage } from "@/components/StatusMessage";
import {
  GameFlagsContext,
  useStoredFlag,
  type GameToggle,
} from "@/components/game-shell/flags";
import type { ModeLink } from "@/components/game-shell/types";
import { AttemptRules } from "@/components/game-shell/AttemptRules";
import {
  entitiesOfMode,
  loadFranchiseData,
  withoutFlagged,
  type FranchiseData,
} from "@/franchises/data";
import { modePoolNoun, modePoolSize } from "@/franchises/pool";
import type { FranchiseConfig, ModeConfig } from "@/franchises/types";
import { es } from "@/i18n/es";
import { ClassicGame } from "@/modes/classic/ClassicGame";
import { ConnectionsGame } from "@/modes/connections/ConnectionsGame";
import { HigherLowerGame } from "@/modes/higher-lower/HigherLowerGame";
import { ImageRevealGame } from "@/modes/image-reveal/ImageRevealGame";
import { RevealListGame } from "@/modes/reveal-list/RevealListGame";
import { TextClueGame } from "@/modes/text-clue/TextClueGame";
import { TimelineGame } from "@/modes/timeline/TimelineGame";
import styles from "./ModeGame.module.scss";

interface ModeGameProps {
  franchise: FranchiseConfig;
  mode: ModeConfig;
  /** Todos los modos de la franquicia con su disponibilidad, para la navegación. */
  modes: readonly ModeLink[];
  /** `false` si el modo todavía no existe o no tiene contenido suficiente: muestra "Próximamente". Lo decide la página con los datos. */
  playable: boolean;
}

/**
 * Despacha el modo al motor que indica su config. Los motores que todavía no
 * existen, las franquicias que aún no tienen datos y los modos sin contenido
 * suficiente muestran "Próximamente".
 *
 * Los datos se cargan con import dinámico recién en el cliente. Por eso los
 * motores solo se montan después de la hidratación y pueden leer `window`,
 * `localStorage` y la hora sin producir diferencias con el HTML del servidor.
 */
export function ModeGame(props: ModeGameProps) {
  return (
    <AutocompleteOptions.Provider
      value={{ thumbnails: props.franchise.autocompleteThumbnails ?? true }}
    >
      <PoolNounContext.Provider
        value={modePoolNoun(props.franchise, props.mode)}
      >
        <AttemptRules.Provider value={{ base: props.mode.try ?? 8, adaptive: ['classic', 'image-reveal', 'text-clue', 'reveal-list'].includes(props.mode.engine) }}>
          <ModeEngine {...props} />
        </AttemptRules.Provider>
      </PoolNounContext.Provider>
    </AutocompleteOptions.Provider>
  );
}

function ModeEngine({ franchise, mode, modes, playable }: ModeGameProps) {
  const classic = mode.engine === "classic" ? mode.classic : undefined;
  const imageReveal =
    mode.engine === "image-reveal" ? mode.imageReveal : undefined;
  const textClue = mode.engine === "text-clue" ? mode.textClue : undefined;
  const revealList =
    mode.engine === "reveal-list" ? mode.revealList : undefined;
  const higherLower =
    mode.engine === "higher-lower" ? mode.higherLower : undefined;
  const timeline = mode.engine === "timeline" ? mode.timeline : undefined;
  const connections =
    mode.engine === "connections" ? mode.connections : undefined;
  const [loaded, setLoaded] = useState<FranchiseData | "error" | null>(null);
  // Los interruptores de la partida, guardados por franquicia: con relleno y con los arcos del manga (los dos prendidos
  // por defecto: entra todo).
  const [fillerOn, setFillerOn] = useStoredFlag("filler", franchise.slug, true);
  const [mangaOn, setMangaOn] = useStoredFlag("manga", franchise.slug, true);
  const { Loader } = useSkin().skin.slots;
  // Cada reintento vuelve a pedir los datos (un fallo de red al bajar el chunk se arregla con otro intento).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!playable) return;
    let cancelled = false;
    loadFranchiseData(franchise.slug)
      .then((data) => {
        if (!cancelled) setLoaded(data ?? "error");
      })
      .catch(() => {
        if (!cancelled) setLoaded("error");
      });
    return () => {
      cancelled = true;
    };
  }, [playable, franchise.slug, attempt]);

  const comingSoon = (
    <div className={styles.soonPage}>
      <ModeNav franchise={franchise.slug} modes={modes} current={mode.slug} />
      <section className={styles.soon}>
        <h2 className={styles.soonTitle}>{es.mode.comingSoon}</h2>
        <p>{es.mode.provisional}</p>
      </section>
    </div>
  );

  if (!playable) return comingSoon;
  if (loaded === "error") {
    return (
      <StatusMessage
        kind="error"
        action={
          <Button
            onClick={() => {
              setLoaded(null);
              setAttempt((count) => count + 1);
            }}
          >
            {es.game.retry}
          </Button>
        }
      >
        {es.game.loadError}
      </StatusMessage>
    );
  }
  if (loaded === null) {
    return (
      <StatusMessage kind="loading" loader={<Loader />}>
        {es.game.loading}
      </StatusMessage>
    );
  }

  // Cada interruptor aparece solo si en este modo cambia algo (si deja afuera alguna respuesta o suceso posible).
  const changes = (flags: { skipFiller: boolean; skipMangaOnly: boolean }) =>
    modePoolSize(mode, withoutFlagged(loaded, flags), franchise.series) !==
    modePoolSize(mode, loaded, franchise.series);
  const toggles: GameToggle[] = [];
  if (changes({ skipFiller: true, skipMangaOnly: false })) {
    toggles.push({
      id: "filler",
      label: es.filters.filler,
      help: es.help.filler,
      on: fillerOn,
      onChange: setFillerOn,
    });
  }
  if (changes({ skipFiller: false, skipMangaOnly: true })) {
    toggles.push({
      id: "manga",
      label: es.filters.manga,
      help: es.help.manga,
      on: mangaOn,
      onChange: setMangaOn,
    });
  }
  const skipFiller =
    !fillerOn && toggles.some((toggle) => toggle.id === "filler");
  const skipMangaOnly =
    !mangaOn && toggles.some((toggle) => toggle.id === "manga");
  // Los datos sin lo que dejan afuera los interruptores; cada combinación es otra partida (`x`: sin relleno, `a`: sin los
  // arcos del manga, o sea, solo anime).
  const data = withoutFlagged(loaded, { skipFiller, skipMangaOnly });
  const flags = {
    toggles,
    variant: `${skipFiller ? "x" : ""}${skipMangaOnly ? "a" : ""}`,
  };
  const game = renderGame(data);
  return game === null ? (
    comingSoon
  ) : (
    <GameFlagsContext.Provider value={flags}>{game}</GameFlagsContext.Provider>
  );

  function renderGame(data: FranchiseData) {
    // Las entidades que se adivinan: las de un conjunto con nombre (las formas de Dragon Ball) o las principales.
    const entities = entitiesOfMode(data, mode.entitySet);

    if (imageReveal) {
      return (
        <ImageRevealGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={imageReveal}
          entities={entities}
          contents={data.contents}
        />
      );
    }

    if (revealList) {
      return (
        <RevealListGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={revealList}
          entities={entities}
          contents={data.contents}
        />
      );
    }

    if (higherLower) {
      return (
        <HigherLowerGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={higherLower}
          entities={entities}
        />
      );
    }

    if (timeline) {
      return (
        <TimelineGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={timeline}
          contents={data.contents}
        />
      );
    }

    if (connections) {
      return (
        <ConnectionsGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={connections}
          entities={entities}
          contents={data.contents}
        />
      );
    }

    if (textClue) {
      return (
        <TextClueGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={textClue}
          entities={entities}
          contents={data.contents}
        />
      );
    }

    if (classic) {
      return (
        <ClassicGame
          franchise={franchise}
          mode={mode}
          modes={modes}
          config={classic}
          entities={entities}
          contents={data.contents}
        />
      );
    }

    return null;
  }
}
