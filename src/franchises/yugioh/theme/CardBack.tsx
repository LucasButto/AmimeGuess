import styles from './CardBack.module.scss';

/** Reverso aportado por el usuario; excepción de arte autorizada para este archivo. */
export function CardBack() {
  return (
    <img className={styles.art} src="/theme/yugioh/card-back.webp" alt="" aria-hidden="true"
      width={250} height={356} loading="eager" decoding="async" draggable={false} />
  );
}
