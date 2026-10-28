import { typeBadgeFile, type TypeName } from './extras-art';
import styles from './TypeBadge.module.scss';

/** Una imagen CSS compartida y cacheable, sin img ni SVG por celda. */
export function TypeBadge({ type, compact = false }: { type: TypeName; compact?: boolean }) {
  return <span className={styles.badge} data-type={typeBadgeFile(type)} data-compact={compact} aria-hidden="true" />;
}
