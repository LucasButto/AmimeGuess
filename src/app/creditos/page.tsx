import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { franchises } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { themeFonts } from '@/franchises/theme';
import { es } from '@/i18n/es';
import { attributionsOf } from './attributions';
import styles from './page.module.scss';

export const metadata: Metadata = { title: es.credits.title, description: es.credits.description };

/**
 * Créditos (SPEC 10): fuentes de datos e imágenes, el texto CC BY-SA atribuido página por página, las tipografías
 * con su licencia y los titulares de las marcas. Se genera al compilar; la lista de textos sale de los datos.
 */
export default async function CreditsPage() {
  const all = await Promise.all(franchises.map((franchise) => loadFranchiseData(franchise.slug)));
  const sites = attributionsOf(all.flatMap((data) => data?.contents ?? []));
  const fonts = [...new Set(franchises.flatMap((franchise) => themeFonts(franchise.theme)))].map((id) => es.credits.fonts.items[id]);
  const { sources, reuse, trademarks, art } = es.credits;

  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>{es.credits.title}</h1>
          <p className={styles.lead}>{es.credits.intro}</p>
        </header>

        <section className={styles.section} aria-labelledby="creditos-fuentes">
          <h2 id="creditos-fuentes" className={styles.heading}>
            {sources.title}
          </h2>
          <p>{sources.text}</p>
          <div className={styles.groups}>
            {sources.groups.map((group) => (
              <section key={group.franchise} className={styles.group} aria-label={group.franchise}>
                <h3 className={styles.groupTitle}>{group.franchise}</h3>
                <ul className={styles.sources}>
                  {group.items.map((item) => (
                    <li key={item.url}>
                      <a className={styles.link} href={item.url} rel="noopener noreferrer">
                        {item.name}
                      </a>
                      <p className={styles.muted}>{item.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="creditos-textos">
          <h2 id="creditos-textos" className={styles.heading}>
            {reuse.title}
          </h2>
          <p>{reuse.text}</p>
          <p>
            <a className={styles.link} href={reuse.license.url} rel="license noopener noreferrer">
              {reuse.license.name}
            </a>
          </p>
          {sites.map((site) => {
            const named = reuse.sites[site.host];
            return (
              <details key={site.host} className={styles.details}>
                <summary className={styles.summary}>
                  {reuse.summary(named.name, named.what(site.count))}
                </summary>
                <ul className={styles.pages}>
                  {site.pages.map((page) => (
                    <li key={page.url}>
                      <a className={styles.link} href={page.url} rel="noopener noreferrer">
                        {reuse.pageCount(page.title, page.count)}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>

        <section className={styles.section} aria-labelledby="creditos-tipografias">
          <h2 id="creditos-tipografias" className={styles.heading}>
            {es.credits.fonts.title}
          </h2>
          <p>{es.credits.fonts.text}</p>
          <p>
            <a className={styles.link} href={es.credits.fonts.license.url} rel="license noopener noreferrer">
              {es.credits.fonts.license.name}
            </a>
          </p>
          <ul className={styles.inline}>
            {fonts.map((font) => (
              <li key={font.url}>
                <a className={styles.link} href={font.url} rel="noopener noreferrer">
                  {font.name}
                </a>
                {'license' in font && (
                  <>
                    {' ('}
                    <a className={styles.link} href={font.license.url} rel="license noopener noreferrer">
                      {font.license.name}
                    </a>
                    {')'}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="creditos-marcas">
          <h2 id="creditos-marcas" className={styles.heading}>
            {trademarks.title}
          </h2>
          <ul className={styles.list}>
            {trademarks.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={styles.muted}>{trademarks.text}</p>
        </section>

        <section className={styles.section} aria-labelledby="creditos-arte">
          <h2 id="creditos-arte" className={styles.heading}>
            {art.title}
          </h2>
          <ul className={styles.list}>
            {art.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ul className={styles.sources}>
            {art.externalItems.map((item) => (
              <li key={item.name}>
                {'url' in item ? (
                  <a className={styles.link} href={item.url} rel="noopener noreferrer">
                    {item.name}
                  </a>
                ) : item.name}
                <p className={styles.muted}>{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
