import styles from './TvRoom.module.scss';

/** El emblema de la apertura de cada canal, dibujado en SVG/CSS propio. Decorativo. */
export function ChannelEmblem({ slug }: { slug: string }) {
  switch (slug) {
    case 'pokemon':
      // La Poké Ball en pixel art que aportó el usuario (fondo recortado).
      return <img className={styles.emblem} data-pixel src="/theme/hub/pokeball.png" width={260} height={260} alt="" aria-hidden="true" draggable={false} />;
    case 'dragon-ball':
      return (
        <svg className={styles.emblem} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <circle cx="16" cy="16" r="14" fill="#f08a1c" stroke="#1d1d1d" strokeWidth="2" />
          <circle cx="11" cy="10" r="4.5" fill="#ffd27a" opacity="0.85" />
          <circle cx="21" cy="22" r="5" fill="#c4600c" opacity="0.4" />
          {[[12, 12], [20, 12], [12, 20], [20, 20]].map(([x, y]) => (
            <path key={`${x}-${y}`} d={`m${x} ${y - 3.2} 1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3Z`} fill="#c8231b" />
          ))}
        </svg>
      );
    case 'naruto':
      // Un kunai en diagonal (imagen aportada por el usuario, fondo recortado).
      return <img className={`${styles.emblem} ${styles.kunai}`} src="/theme/hub/kunai.png" width={480} height={79} alt="" aria-hidden="true" draggable={false} />;
    default:
      // El reverso de una carta de Yu-Gi-Oh (el mismo del tema).
      return <img className={`${styles.emblem} ${styles.card}`} src="/theme/yugioh/card-back.webp" width={250} height={356} alt="" aria-hidden="true" draggable={false} />;
  }
}
