import styles from './Switch.module.scss';

interface SwitchProps {
  label: string;
  /** Una línea que explica qué cambia. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Interruptor genérico: una casilla con `role="switch"`, su etiqueta y una ayuda, todo como área táctil. */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" role="switch" className={styles.input} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}
