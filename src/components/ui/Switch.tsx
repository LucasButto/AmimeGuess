import styles from './Switch.module.scss';

interface SwitchProps {
  label: string;
  /** Una línea que explica qué cambia. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Interruptor genérico: un riel con su perilla (que se corre a la derecha al activarlo), con su etiqueta y, si hace falta,
 * una ayuda. Por debajo es una casilla con `role="switch"` (se opera igual con teclado y lector de pantalla); lo que se ve lo
 * dibuja el riel, con los tokens de los chips del tema. Todo como área táctil.
 */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" role="switch" className={styles.input} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}
