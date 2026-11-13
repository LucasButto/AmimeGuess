'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { franchises } from '@/franchises';
import { es } from '@/i18n/es';
import { LIMITS, MODALITIES, STATS_AGGREGATIONS, isValidName, type Modality } from '@/versus/config';
import { AddMatchSheet } from './AddMatchSheet';
import { createRoom } from './api';
import { loadCatalog } from './catalog';
import { describePartida } from './describe';
import {
  EMPTY_DRAFT,
  buildConfig,
  maxTimeMs,
  moveBlock,
  parseClock,
  remainingPartidas,
  removeBlock,
  resetBlockTime,
  setBlockCount,
  setBlockTime,
  totalPartidas,
  visibleOptions,
  type Block,
  type Draft,
} from './draft';
import { formatClock } from './format';
import { NumberField } from './NumberField';
import { isValidForSite } from './site';
import { readName, writeCredentials, writeName } from './storage';
import styles from './CreateRoom.module.scss';

const copy = es.versus.create;

/**
 * `/versus`: armar la sala. Modalidad → partidas (con sus filtros, ×N y tiempo límite) → opciones → apodo → Crear sala. Al
 * crearla valida que cada partida exista y alcance el pool, la manda al servidor y navega a la sala de espera. No toca los
 * filtros guardados de la persona.
 */
export function CreateRoom() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const nameId = useId();
  const modalityId = useId();

  // El último apodo usado (se lee después de hidratar: el servidor no lo conoce).
  useEffect(() => {
    const saved = readName();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo guardado solo existe en el navegador: leerlo al renderizar rompería la hidratación.
    if (saved) setDraft((current) => (current.name === '' ? { ...current, name: saved } : current));
  }, []);

  const blocks = draft.blocks;
  const total = totalPartidas(blocks);
  const timed = draft.modality === 'timeAttack';
  const shown = visibleOptions(draft.modality, blocks);
  const anyOption = Object.values(shown).some(Boolean);
  const nameValid = isValidName(draft.name.trim());
  const ready = blocks.length > 0 && nameValid && !busy;
  const hint = blocks.length === 0 ? copy.needPartida : !nameValid ? copy.needName : null;

  const setBlocks = (next: readonly Block[]) => setDraft((current) => ({ ...current, blocks: next }));
  const setOption = <K extends keyof Draft['options']>(key: K, value: Draft['options'][K]) => setDraft((current) => ({ ...current, options: { ...current.options, [key]: value } }));

  async function submit() {
    if (!ready) return;
    const config = buildConfig({ ...draft, name: draft.name.trim() });
    if (!config.ok) {
      setError(copy.errors.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const catalog = await loadCatalog(config.config.partidas.map((partida) => partida.franchise));
      if (!isValidForSite(config.config, catalog)) {
        setError(copy.errors.invalid);
        return;
      }
      const result = await createRoom(config.config, draft.name.trim());
      if (!result.ok) {
        setError(result.reason === 'quota' ? copy.errors.quota : result.reason === 'invalid' ? copy.errors.invalid : copy.errors.generic);
        return;
      }
      writeName(draft.name.trim());
      writeCredentials(result.code, { playerId: result.playerId, token: result.token });
      router.push(`/versus/sala?c=${result.code}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      <section className={styles.modality} aria-labelledby={modalityId}>
        <h2 className={styles.heading} id={modalityId}>{copy.modality.title}</h2>
        <div className={styles.cards} role="radiogroup" aria-labelledby={modalityId}>
          {MODALITIES.map((modality: Modality) => (
            <button
              key={modality}
              type="button"
              role="radio"
              aria-checked={draft.modality === modality}
              className={styles.card}
              onClick={() => setDraft((current) => ({ ...current, modality }))}
            >
              <span className={styles.cardName}>{es.versus.modality[modality]}</span>
              <span className={styles.cardText}>{copy.modality[modality]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.partidas} aria-labelledby="vs-partidas">
          <div className={styles.partidasHead}>
            <h2 className={styles.heading} id="vs-partidas">{copy.partidas.title}</h2>
            <p className={styles.counts} role="status">
              <span>{copy.partidas.count(total, LIMITS.partidas.max)}</span>
              {timed && blocks.length > 0 && <span>{copy.partidas.maxTime(formatClock(maxTimeMs(blocks)))}</span>}
            </p>
          </div>

          {blocks.length === 0 ? (
            <p className={styles.empty}>{copy.partidas.empty}</p>
          ) : (
            <ol className={styles.blocks}>
              {blocks.map((block, index) => {
                const info = describePartida(block.partida);
                const edited = block.partida.timeEdited === true;
                return (
                  <li key={block.id} className={styles.block}>
                    <div className={styles.blockHead}>
                      <p className={styles.blockTitle}>
                        <strong>{info.franchise} · {info.mode}</strong>
                        {block.count > 1 && <span className={styles.times}>{copy.partidas.repeats(block.count)}</span>}
                      </p>
                      <p className={styles.blockMeta}>{[info.variant, info.filters].filter(Boolean).join(' · ')}</p>
                    </div>

                    {timed && (
                      <div className={styles.timeRow}>
                        <NumberField
                          label={copy.time.inputLabel(info.full)}
                          value={block.partida.timeLimitMs}
                          min={LIMITS.timeLimitMs.min}
                          max={LIMITS.timeLimitMs.max}
                          step={LIMITS.timeLimitMs.step}
                          format={formatClock}
                          parse={parseClock}
                          lessLabel={copy.time.less}
                          moreLabel={copy.time.more}
                          onChange={(value) => setBlocks(setBlockTime(blocks, block.id, value))}
                          compact
                        />
                        <div className={styles.timeNotes}>
                          <span className={styles.timeLabel}>{copy.time.label}</span>
                          {block.extraSeconds > 0 && !edited && <span className={styles.note}>{copy.time.extra(block.extraSeconds, block.partida.series.length)}</span>}
                          {edited && <button type="button" className={styles.link} onClick={() => setBlocks(resetBlockTime(blocks, block.id))}>{copy.time.reset}</button>}
                        </div>
                      </div>
                    )}

                    <div className={styles.blockTools}>
                      <NumberField
                        label={copy.partidas.repeatsLabel(info.full)}
                        value={block.count}
                        min={1}
                        max={block.count + remainingPartidas(blocks)}
                        onChange={(value) => setBlocks(setBlockCount(blocks, block.id, value))}
                        format={(value) => `×${value}`}
                        parse={(text) => (/^\s*×?\s*\d+\s*$/.test(text) ? Number(text.replace('×', '')) : null)}
                        compact
                      />
                      <div className={styles.moves}>
                        <button type="button" className={styles.tool} aria-label={copy.partidas.moveUp(info.full)} disabled={index === 0} onClick={() => setBlocks(moveBlock(blocks, block.id, -1))}><span aria-hidden="true">↑</span></button>
                        <button type="button" className={styles.tool} aria-label={copy.partidas.moveDown(info.full)} disabled={index === blocks.length - 1} onClick={() => setBlocks(moveBlock(blocks, block.id, 1))}><span aria-hidden="true">↓</span></button>
                        <button type="button" className={styles.tool} data-danger aria-label={copy.partidas.remove(info.full)} onClick={() => setBlocks(removeBlock(blocks, block.id))}><span aria-hidden="true">✕</span></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={styles.addRow}>
            <Button
              variant="secondary"
              disabled={remainingPartidas(blocks) <= 0 || franchises.length === 0}
              onClick={() => {
                setSheetKey((key) => key + 1);
                setAdding(true);
              }}
            >
              {copy.partidas.add}
            </Button>
            {remainingPartidas(blocks) <= 0 && <p className={styles.note}>{copy.partidas.full}</p>}
          </div>
        </section>

        <div className={styles.side}>
          {anyOption && (
            <section className={styles.options} aria-labelledby="vs-options">
              <h2 className={styles.heading} id="vs-options">{copy.options.title}</h2>
              {shown.higherLowerTarget && (
                <NumberField label={copy.options.higherLowerTarget} value={draft.options.higherLowerTarget} min={LIMITS.higherLowerTarget.min} max={LIMITS.higherLowerTarget.max} hint={copy.options.higherLowerTargetHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => setOption('higherLowerTarget', value)} />
              )}
              {shown.higherLowerForgiven && (
                <NumberField label={copy.options.higherLowerForgiven} value={draft.options.higherLowerForgiven} min={LIMITS.higherLowerForgiven.min} max={LIMITS.higherLowerForgiven.max} hint={copy.options.higherLowerForgivenHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => setOption('higherLowerForgiven', value)} />
              )}
              {shown.statsTarget && (
                <NumberField label={copy.options.statsTarget} value={draft.options.statsTarget} min={LIMITS.statsTarget.min} max={LIMITS.statsTarget.max} step={LIMITS.statsTarget.step} hint={copy.options.statsTargetHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => setOption('statsTarget', value)} />
              )}
              {shown.statsAggregation && (
                <div className={styles.aggregation}>
                  <p className={styles.fieldLabel} id="vs-aggregation">{copy.options.statsAggregation}</p>
                  <div className={styles.chips} role="group" aria-labelledby="vs-aggregation">
                    {STATS_AGGREGATIONS.map((value) => (
                      <Chip key={value} pressed={draft.options.statsAggregation === value} onClick={() => setOption('statsAggregation', value)}>{copy.options.aggregation[value]}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className={styles.nameBox} aria-labelledby={nameId}>
            <h2 className={styles.heading} id={nameId}>{copy.name.label}</h2>
            <input
              className={styles.nameInput}
              type="text"
              value={draft.name}
              maxLength={LIMITS.name.max}
              autoComplete="nickname"
              aria-labelledby={nameId}
              aria-describedby="vs-name-hint"
              aria-invalid={draft.name !== '' && !nameValid}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <p className={styles.note} id="vs-name-hint">{draft.name !== '' && !nameValid ? copy.name.invalid : copy.name.hint}</p>
          </section>
        </div>
      </div>

      <div className={styles.bar} data-versus-bar>
        <div className={styles.barInner}>
          <p className={styles.barText} role="status">{error ?? hint ?? ''}</p>
          <Button variant="primary" disabled={!ready} onClick={() => void submit()}>{busy ? copy.submitting : copy.submit}</Button>
        </div>
      </div>

      <AddMatchSheet
        key={sheetKey}
        open={adding}
        onClose={() => setAdding(false)}
        remaining={remainingPartidas(blocks)}
        nextId={() => `b${++counter.current}`}
        onAdd={(block) => setDraft((current) => ({ ...current, blocks: [...current.blocks, { ...block, count: Math.min(block.count, remainingPartidas(current.blocks)) }] }))}
      />
    </div>
  );
}

