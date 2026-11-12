'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { useSkin } from '@/components/skin/context';
import { InfoTip } from '@/components/ui/InfoTip';
import { TermText } from '@/components/ui/TermText';
import type { Entity } from '@/engine/types';
import styles from './ClueNames.module.scss';

interface Portrait {
  name: string;
  image?: string;
  pixelSource?: string;
}

interface Catalog {
  names: Map<string, Portrait>;
  exact: Map<string, Portrait | null>;
  pattern: RegExp;
}

const CluePortraits = createContext<Catalog | null>(null);

export function CluePortraitProvider({ entities, children }: { entities: readonly Entity[]; children: ReactNode }) {
  const { cluePortraits } = useSkin().skin;
  const catalog = useMemo(() => {
    if (!cluePortraits) return null;
    const names = new Map<string, Portrait>();
    const exact = new Map<string, Portrait | null>();
    const inlineAliases = new Set<string>();

    function register(portrait: Portrait, aliases: readonly string[]) {
      if ((!portrait.pixelSource && !portrait.image) || names.has(portrait.name)) return;
      names.set(portrait.name, portrait);
      // En frases, acepta nombres cortos y apodos numerados con su mayúscula original.
      for (const alias of aliases) {
        if (/^\p{Lu}[\p{L}\p{M}\d-]+(?: \d+)?$/u.test(alias)) inlineAliases.add(alias);
      }
      for (const value of [portrait.name, ...aliases]) {
        const key = value.toLocaleLowerCase('es');
        if (!exact.has(key)) exact.set(key, portrait);
        else if (exact.get(key) !== portrait) exact.set(key, null);
      }
    }

    for (const entity of entities) {
      register({ name: entity.name.es, image: entity.image, pixelSource: cluePortraits.pixelSource?.(entity) }, entity.aliases);
    }
    for (const { name, image, aliases = [] } of cluePortraits.additional ?? []) {
      register({ name, image }, aliases);
    }

    for (const name of inlineAliases) {
      const portrait = exact.get(name.toLocaleLowerCase('es'));
      if (portrait && !names.has(name)) names.set(name, portrait);
    }

    if (names.size === 0) return null;
    const alternatives = [...names.keys()]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const word = '[\\p{L}\\p{M}\\p{N}]';
    return { names, exact, pattern: new RegExp(`(?<!${word})(?:${alternatives})(?!${word})`, 'gu') };
  }, [cluePortraits, entities]);

  return <CluePortraits.Provider value={catalog}>{children}</CluePortraits.Provider>;
}

/** Se monta con texto ya visible para conservar el desbloqueo de las pistas. */
export function ClueNames({ text, help }: { text: string; help?: Readonly<Record<string, string>> }) {
  const catalog = useContext(CluePortraits);
  if (!catalog || help) return <TermText text={text} help={help} />;

  const exact = catalog.names.get(text) ?? catalog.exact.get(text.toLocaleLowerCase('es'));
  if (exact) return <PortraitName portrait={exact}>{text}</PortraitName>;

  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(catalog.pattern)) {
    const name = match[0];
    parts.push(text.slice(end, match.index), <PortraitName key={match.index} portrait={catalog.names.get(name)!}>{name}</PortraitName>);
    end = match.index + name.length;
  }
  return <>{parts}{text.slice(end)}</>;
}

function PortraitName({ portrait, children }: { portrait: Portrait; children: string }) {
  const preview = portrait.pixelSource
    ? <img src={portrait.pixelSource} alt="" width={40} height={40} decoding="async" draggable={false}
        className={`${styles.portrait} ${styles.pixel}`} />
    : portrait.image && <ContentImage stem={portrait.image} alt="" sizes="7.5rem" className={styles.portrait} />;
  return (
    <span data-inline-targets="" data-clue-name="">
      <InfoTip text={portrait.name} preview={preview}>{children}</InfoTip>
    </span>
  );
}
