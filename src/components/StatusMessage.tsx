import type { ReactNode } from 'react';
import styles from './StatusMessage.module.scss';

interface StatusMessageProps {
  /** `loading` avisa con `role="status"`, `error` con `role="alert"` y `empty` es un texto informativo. */
  kind: 'loading' | 'error' | 'empty';
  /** Título opcional, en negrita sobre el texto. */
  title?: string;
  children: ReactNode;
  /** Acción debajo del texto (un botón de reintentar, un link). */
  action?: ReactNode;
  /** El indicador de carga del tema (slot `Loader`), en lugar del anillo que gira. */
  loader?: ReactNode;
}

/**
 * Estados vacío, de carga y de error con un solo aspecto, para que ningún motor ni página resuelva el suyo.
 * El tipo no depende solo del color: el ícono y el texto también lo dicen.
 */
export function StatusMessage({ kind, title, children, action, loader }: StatusMessageProps) {
  return (
    <section
      className={styles.root}
      data-kind={kind}
      role={kind === 'loading' ? 'status' : kind === 'error' ? 'alert' : undefined}
    >
      {kind === 'loading' && loader ? (
        <span aria-hidden="true" className={styles.loader}>
          {loader}
        </span>
      ) : (
        <span aria-hidden="true" className={styles.icon}>
          {kind === 'error' ? '!' : kind === 'empty' ? '·' : ''}
        </span>
      )}
      <div className={styles.body}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <p>{children}</p>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </section>
  );
}
