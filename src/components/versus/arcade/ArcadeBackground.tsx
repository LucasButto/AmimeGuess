import styles from './ArcadeBackground.module.scss';

/**
 * La arena nocturna de Retro Battle (pixel art): una imagen para el teléfono y otra para pantallas anchas
 * (`public/img/versus/backgrounds/`), con un velo oscuro para que los paneles y el texto se lean. Es solo decoración
 * (`aria-hidden`) y no se anima: cubre la ventana y queda fija mientras la página se desplaza.
 */
export function ArcadeBackground() {
  return (
    <div className={styles.root} aria-hidden="true" data-arcade-background>
      <div className={styles.image} />
      <div className={styles.shade} />
    </div>
  );
}
