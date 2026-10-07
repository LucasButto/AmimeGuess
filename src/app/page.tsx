import Link from 'next/link';
import { franchises } from '@/franchises';
import { es } from '@/i18n/es';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{es.home.title}</h1>
        <p className={styles.subtitle}>{es.home.subtitle}</p>
      </header>
      <ul className={styles.grid} aria-label={es.home.franchisesLabel}>
        {franchises.map((franchise) => (
          <li key={franchise.slug}>
            <Link className={styles.card} href={`/${franchise.slug}`}>
              {franchise.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
