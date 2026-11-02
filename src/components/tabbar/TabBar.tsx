import Link from 'next/link';
import { es } from '@/i18n/es';
import styles from './TabBar.module.scss';

export type TabId = 'home' | 'challenges' | 'stats' | 'more';

const TABS: ReadonlyArray<{ id: TabId; href: string; label: string; icon: string }> = [
  { id: 'home', href: '/', label: es.tabs.home, icon: 'M12 3 2 12h3v9h5v-6h4v6h5v-9h3z' },
  { id: 'challenges', href: '/retos', label: es.tabs.challenges, icon: 'M3 4h4v4H3zm6 1h12v2H9zM3 10h4v4H3zm6 1h12v2H9zM3 16h4v4H3zm6 1h12v2H9z' },
  { id: 'stats', href: '/estadisticas', label: es.tabs.stats, icon: 'M3 13h5v8H3zm7-9h5v17h-5zm7 5h5v12h-5z' },
  { id: 'more', href: '/mas', label: es.tabs.more, icon: 'M3 10h5v4H3zm6.5 0h5v4h-5zM16 10h5v4h-5z' },
];

/**
 * La barra de pestañas del teléfono (SPEC 9.3): Inicio, Retos, Estadísticas y Más, fija abajo, en el inicio, los hubs y las
 * propias pestañas, nunca en la pantalla de juego. Por debajo de `lg` solamente: desde ahí no existe. Los colores son los de
 * la barra superior de la franquicia (los hubs) o los del sitio. `current` es la pestaña que se está viendo: un hub cuenta
 * como Inicio. Sin JavaScript propio: son enlaces comunes.
 */
export function TabBar({ current }: { current: TabId }) {
  return (
    <nav className={styles.bar} aria-label={es.tabs.label} data-tab-bar>
      <ul className={styles.list}>
        {TABS.map((tab) => (
          <li key={tab.id} className={styles.item}>
            <Link className={styles.tab} href={tab.href} aria-current={tab.id === current ? 'page' : undefined} data-tab={tab.id}>
              <span className={styles.iconWrap}>
                <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
                  <path d={tab.icon} fill="currentColor" />
                </svg>
              </span>
              <span className={styles.label}>{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
