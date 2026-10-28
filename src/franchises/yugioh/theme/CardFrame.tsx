import type { ReactNode } from 'react';
import type { CardFrameType } from './modeCards';
import styles from './CardFrame.module.scss';

interface CardFrameProps {
  frame: CardFrameType;
  mini?: boolean;
  primary?: boolean;
  name?: ReactNode;
  level?: ReactNode;
  illustration: ReactNode;
  scales?: ReactNode;
  copy?: ReactNode;
  status?: ReactNode;
  stamp?: ReactNode;
  holo?: ReactNode;
}

/** Geometría única para la carta del menú y la miniatura de los filtros. */
export function CardFrame({ frame, mini = false, primary = false, name, level, illustration, scales, copy, status, stamp, holo }: CardFrameProps) {
  return <span className={styles.frame} data-frame={frame} data-mini={mini} data-primary={primary}>
    <span className={styles.surface} />
    <span className={styles.name} data-card-name>{name}</span>
    {!mini && <span className={styles.attribute} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="10" /><path d={frame === 'spell' ? 'm12 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z' : frame === 'trap' ? 'M7 7h10v10H7ZM12 4v16M4 12h16' : 'M12 11c-7 0-6-8 0-8s7 8 0 8ZM12 11v10M6 15h12'} /></svg>
    </span>}
    <span className={styles.level} aria-hidden="true">{level}</span>
    <span className={styles.window}>
      <span className={styles.art}>{illustration}{holo}</span>
      {frame === 'link' && <svg className={styles.arrows} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="m43 4 7 9 7-9ZM43 96l7-9 7 9ZM4 43l9 7-9 7ZM96 43l-9 7 9 7ZM3 3h17L3 20ZM97 3H80l17 17ZM3 97h17L3 80ZM97 97H80l17-17Z" /></svg>}
      {frame === 'maximum' && <span className={styles.segments} aria-hidden="true"><span /><span /><span /></span>}
      {stamp}
    </span>
    {frame === 'pendulum' && <span className={styles.scales}>{scales}</span>}
    <span className={styles.paper} data-card-paper>
      <span className={styles.copy}>{copy}</span>
      <span className={styles.status} data-card-status>{status}</span>
    </span>
  </span>;
}
