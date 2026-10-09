import { es } from '@/i18n/es';
import styles from './ConnectionsHelp.module.scss';
import { mistakesOf } from './logic';
import type { ConnectionsConfig } from './types';

interface ConnectionsHelpProps {
  config: ConnectionsConfig;
}

/** Lo que Conexiones aporta al "Cómo se juega": la meta, cómo se resuelve un grupo, los errores y los colores. */
export function ConnectionsHelp({ config }: ConnectionsHelpProps) {
  return (
    <div className={styles.root}>
      <p>{es.connections.help.goal}</p>
      <p>{es.connections.help.result}</p>
      <p>{es.connections.help.mistakes(mistakesOf(config))}</p>
      <p>{es.connections.help.unique}</p>
      <p>{es.connections.help.colors}</p>
    </div>
  );
}
