import { franchises } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { themeCss, themeScope } from '@/franchises/theme';
import { DismissibleFooter } from '@/components/DismissibleFooter';
import { SiteFooter } from '@/components/SiteFooter';
import { TvRoom } from './TvRoom';
import styles from './page.module.scss';
import { modeStatus } from './[franchise]/[mode]/playable';

export default async function HomePage() {
  // Los modos que se pueden jugar de cada franquicia: de ahí sale el "N de M retos de hoy". Se calcula al generar la página.
  const cards = await Promise.all(
    franchises.map(async (franchise) => {
      const data = await loadFranchiseData(franchise.slug);
      const playable = franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable');
      return { franchise, modes: playable.map((mode) => mode.slug) };
    }),
  );

  return (
    <div className={styles.room} data-hub="tv">
      <main className={styles.page}>
        {/* El tema de cada franquicia, con alcance de tarjeta: el Home muestra las cuatro identidades a la vez. */}
        <style>{franchises.map((franchise) => themeCss(franchise.theme, themeScope(franchise.slug))).join('\n')}</style>
        <TvRoom channels={cards.map(({ franchise, modes }) => ({ slug: franchise.slug, name: franchise.name, modes }))} />
      </main>
      <DismissibleFooter>
        <SiteFooter />
      </DismissibleFooter>
    </div>
  );
}
