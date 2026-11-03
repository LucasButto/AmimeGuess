import { allFranchises } from '@/franchises';
import { themeCss, themeScope } from '@/franchises/theme';
import { DismissibleFooter } from '@/components/DismissibleFooter';
import { SiteFooter } from '@/components/SiteFooter';
import { TabBar } from '@/components/tabbar/TabBar';
import { TvRoom } from './TvRoom';
import styles from './page.module.scss';
import { loadHomeChannels } from './playable';

export default async function HomePage() {
  // Los canales: los modos que se pueden jugar de cada franquicia (de ahí sale el "N de M retos de hoy") y las que están
  // "Próximamente". Se calcula al generar la página.
  const channels = await loadHomeChannels();

  return (
    <div className={styles.room} data-hub="tv">
      <main className={styles.page}>
        {/* El tema de cada canal (también el de uno "Próximamente"), con alcance de tarjeta: el Home muestra las cuatro identidades a la vez y cada una conserva su tipografía. */}
        <style>{allFranchises.filter((franchise) => channels.some((channel) => channel.slug === franchise.slug)).map((franchise) => themeCss(franchise.theme, themeScope(franchise.slug))).join('\n')}</style>
        <TvRoom
          channels={channels.map(({ slug, name, modes, comingSoon }) => ({
            slug,
            name,
            comingSoon,
            modes: modes.map((mode) => mode.slug),
            modeNames: Object.fromEntries(modes.map((mode) => [mode.slug, mode.name])),
          }))}
        />
      </main>
      {/* Teléfono: el aviso legal está en la pestaña Más, así que el pie de la sala es solo de escritorio. */}
      <div className={styles.footerSlot}>
        <DismissibleFooter>
          <SiteFooter />
        </DismissibleFooter>
      </div>
      <TabBar current="home" />
    </div>
  );
}
