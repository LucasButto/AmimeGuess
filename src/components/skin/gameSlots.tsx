import type { ReactNode } from 'react';
import type { AttemptsMeterProps, ComparisonMediaProps, ModeFrameProps, RevealListItemProps, SkinData, SkinSlots } from '@/franchises/types';

export function SkinComparisonMedia({ skin, children, ...props }: ComparisonMediaProps & {
  readonly skin: Pick<SkinData, 'customComparisonMedia'> & { readonly slots: Pick<SkinSlots, 'ComparisonMedia'> };
  readonly children: ReactNode;
}) {
  const Media = skin.slots.ComparisonMedia;
  return skin.customComparisonMedia ? <Media {...props} /> : <>{children}</>;
}

export function SkinRevealListItem({ skin, children, ...props }: RevealListItemProps & {
  readonly skin: Pick<SkinData, 'customRevealListItems'> & { readonly slots: Pick<SkinSlots, 'RevealListItem'> };
  readonly children: ReactNode;
}) {
  const Item = skin.slots.RevealListItem;
  return skin.customRevealListItems ? <Item {...props} text={props.revealed ? props.text : undefined} /> : <>{children}</>;
}

type FrameSkin = Pick<SkinData, 'additionalModeFrames'> & { readonly slots: Pick<SkinSlots, 'ModeFrame'> };
type MeterSkin = Pick<SkinData, 'additionalAttemptsMeters'> & { readonly slots: Pick<SkinSlots, 'AttemptsMeter'> };

/** Sin opt-in devuelve exactamente los hijos, sin elemento ni atributo adicional. */
export function SkinGameFrame({ skin, ...props }: ModeFrameProps & { readonly skin: FrameSkin }) {
  const Frame = skin.slots.ModeFrame;
  return skin.additionalModeFrames?.includes(props.engine) ? <Frame {...props} /> : <>{props.children}</>;
}

/** Los montajes nativos de los motores siguen siendo independientes de esta extensión. */
export function SkinAttemptsMeter({ skin, engine, ...props }: AttemptsMeterProps & {
  readonly skin: MeterSkin;
  readonly engine: ModeFrameProps['engine'];
}) {
  const Meter = skin.slots.AttemptsMeter;
  return skin.additionalAttemptsMeters?.includes(engine) ? <Meter {...props} /> : null;
}

export function celebratesResult(won: boolean, scored: boolean, skin: Pick<SkinData, 'celebrateScoredResults'>): boolean {
  return won && (!scored || skin.celebrateScoredResults === true);
}

/** Sin prefijo conserva el número (incluido su tipo), como el listado original. */
export function revealListPosition(position: number, prefix?: string): string | number {
  return prefix ? `${prefix} ${position}` : position;
}
