import credits from '../../../data/pokemon/pmd-credits.json';
import manifest from '../../../public/theme/pokemon/pmd/manifest.json';
import { es } from '@/i18n/es';
import { pmdAttributions } from './pmd-attributions';
import styles from './PmdCredits.module.scss';

/** Server-only usage from the credits page; native details need no client bundle or requests. */
export function PmdCredits() {
  const text = es.credits.pmd;
  const { artists, forms } = pmdAttributions(credits, manifest);
  return (
    <section className={styles.section} aria-labelledby="creditos-pmd">
      <h2 id="creditos-pmd" className={styles.heading}>{text.title}</h2>
      <p>{text.text}</p>
      <p>{text.licenseText}</p>
      <ul className={styles.links}>
        <li><a className={styles.link} href={credits.licenseUrl} rel="license noopener noreferrer">{text.license}</a></li>
        <li><a className={styles.link} href={credits.repository} rel="noopener noreferrer">{text.repository}</a></li>
        <li><a className={styles.link} href={text.website.url} rel="noopener noreferrer">{text.website.name}</a></li>
      </ul>
      <p className={styles.snapshot}>
        {text.snapshot}{': '}
        <a className={styles.link} href={`${credits.repository}/tree/${credits.snapshot}`} rel="noopener noreferrer"><code>{credits.snapshot}</code></a>
      </p>
      <details className={styles.details}>
        <summary className={styles.summary}>{text.artists(artists.length)}</summary>
        <p className={styles.explanation}>{text.artistsText}</p>
        <ul className={styles.artists}>
          {artists.map(artist => <li key={artist.id} data-pmd-artist={artist.id}>{artist.name}</li>)}
        </ul>
      </details>
      <details className={styles.details}>
        <summary className={styles.summary}>{text.forms(forms.length)}</summary>
        <p className={styles.explanation}>{text.formsText}</p>
        <ul className={styles.forms}>
          {forms.map(form => (
            <li key={form.id} data-pmd-form={form.id}>
              <h3 className={styles.formTitle}>{form.name}{' · '}{text.formLabels[form.form] ?? form.form}</h3>
              <ul className={styles.variants}>
                {form.variants.map(variant => <li key={variant.name}>
                  <strong>{text.variantLabels[variant.name] ?? variant.name}{': '}</strong>
                  {variant.artists.map(artist => artist.name).join(', ')}
                </li>)}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
