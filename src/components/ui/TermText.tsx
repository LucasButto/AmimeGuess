import { Fragment } from 'react';
import { InfoTip } from './InfoTip';
import styles from './TermText.module.scss';

interface TermTextProps {
  /** El texto tal cual, con los valores separados por ", " o " / ". */
  text: string;
  /** Qué es cada valor, por su texto exacto. Sin esto (o con un valor que no está), el texto se muestra igual que siempre. */
  help?: Readonly<Record<string, string>>;
}

const SEPARATOR = /(, | \/ )/;

/**
 * Un texto hecho de valores separados por comas, donde cada valor que tiene descripción es un término: al pasar el
 * cursor, enfocarlo o tocarlo se abre un recuadro de ayuda (`InfoTip`) que empieza con el nombre del término ("Konoha: …"),
 * para que se note a cuál se refiere cuando hay varios juntos. El resto se lee como texto común.
 */
export function TermText({ text, help }: TermTextProps) {
  if (help === undefined) return <>{text}</>;
  const parts = text.split(SEPARATOR);
  return (
    <>
      {parts.map((part, index) => {
        // Los separadores van pegados al valor anterior (la coma) o sueltos (el espacio que sigue).
        if (index % 2 === 1) return part.startsWith(',') ? ' ' : <Fragment key={index}>{part}</Fragment>;
        const separator = parts[index + 1]?.startsWith(',') ? ',' : '';
        const content =
          help[part] === undefined ? (
            part
          ) : (
            <InfoTip text={`${part}: ${help[part]}`}>{part}</InfoTip>
          );
        return (
          <span key={index} className={styles.item} data-inline-targets="">
            {content}
            {separator}
          </span>
        );
      })}
    </>
  );
}
