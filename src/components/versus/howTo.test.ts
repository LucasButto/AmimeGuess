import { describe, expect, it } from 'vitest';
import { showsHowTo, versusRulesText } from './howTo';

const clasico = { franchise: 'pokemon', mode: 'clasico' };
const silueta = { franchise: 'pokemon', mode: 'silueta' };

describe('showsHowTo', () => {
  it('la primera partida de la sala y las de desempate (sin anterior) la muestran', () => {
    expect(showsHowTo(clasico, undefined, false)).toBe(true);
  });

  it('cambiar de modo la muestra; repetir el mismo modo seguido, no', () => {
    expect(showsHowTo(silueta, clasico, false)).toBe(true);
    expect(showsHowTo(clasico, clasico, false)).toBe(false);
  });

  it('el mismo modo de otra franquicia es otro modo', () => {
    expect(showsHowTo({ franchise: 'naruto', mode: 'clasico' }, clasico, false)).toBe(true);
  });

  it('después de tocar Continuar no vuelve a aparecer (por ejemplo, al recargar la página)', () => {
    expect(showsHowTo(clasico, undefined, true)).toBe(false);
    expect(showsHowTo(silueta, clasico, true)).toBe(false);
  });
});

describe('versusRulesText', () => {
  it('Contrarreloj dice el tiempo límite de la partida y que corre al tocar Continuar', () => {
    const { intro, lines } = versusRulesText('timeAttack', { timeLimitMs: 130_000 }, { unlimited: true });
    expect(intro).toContain('2:10');
    expect(intro).toContain('Continuar');
    expect(lines).toEqual([]);
  });

  it('Carrera avisa que el reloj de la sala ya corre', () => {
    expect(versusRulesText('race', {}, { unlimited: true }).intro).toContain('ya está corriendo');
  });

  it('Menos intentos no tiene tiempo límite', () => {
    expect(versusRulesText('fewestAttempts', {}, {}).intro).toContain('sin tiempo límite');
  });

  it('Mayor o Menor: la meta de aciertos y los fallos perdonados, con lo que significan', () => {
    expect(versusRulesText('timeAttack', { timeLimitMs: 120_000 }, { unlimited: true, targetScore: 10 }).lines).toEqual(['Ganás al llegar a 10 aciertos; los errores no cuentan.']);
    expect(versusRulesText('race', {}, { unlimited: true, targetScore: 1 }).lines).toEqual(['Ganás al llegar a 1 acierto; los errores no cuentan.']);
    expect(versusRulesText('fewestAttempts', {}, { forgivenErrors: 3 }).lines).toEqual(['Se te perdonan 3 fallos: el siguiente error termina tu partida. Gana quien más aciertos suma.']);
    expect(versusRulesText('fewestAttempts', {}, { forgivenErrors: 0 }).lines).toEqual(['No se perdona ningún fallo: el primer error termina tu partida. Gana quien más aciertos suma.']);
  });

  it('Estadísticas en Contrarreloj y Carrera: el puntaje objetivo y que se arman todas las combinaciones que se quiera', () => {
    const { lines } = versusRulesText('timeAttack', { timeLimitMs: 180_000 }, { unlimited: true, targetTotal: 550 });
    expect(lines).toEqual(['Ganás al armar una combinación que supere 550 puntos (igualar no alcanza); podés armar todas las que quieras.']);
  });

  it('Estadísticas en Menos intentos: las oportunidades y cómo se cuentan (la mejor, la suma o el promedio)', () => {
    const lines = (attempts: number, statsAggregation: 'best' | 'sum' | 'average') => versusRulesText('fewestAttempts', {}, { fixedAttempts: attempts }, { statsAggregation }).lines;
    expect(lines(4, 'sum')).toEqual(['Tenés exactamente 4 oportunidades: 4 combinaciones de seis. Superar el total no termina antes.', 'Cuenta la suma de tus 4 combinaciones: gana quien junta más puntos.']);
    expect(lines(5, 'best')[1]).toBe('Cuenta tu mejor combinación de las 5: gana quien arma el total más alto.');
    expect(lines(3, 'average')[1]).toBe('Cuenta el promedio de tus 3 combinaciones (se ordena igual que la suma): gana el promedio más alto.');
    // Con una sola oportunidad la mejor, la suma y el promedio dan lo mismo: se dice una sola cosa.
    for (const aggregation of ['best', 'sum', 'average'] as const) {
      expect(lines(1, aggregation)).toEqual(['Tenés una sola oportunidad: una combinación de seis.', 'Cuenta el total de esa combinación: gana quien arma el más alto.']);
    }
    // Sin las opciones de la sala se cuenta como la mejor (lo de siempre).
    expect(versusRulesText('fewestAttempts', {}, { fixedAttempts: 3 }).lines[1]).toContain('mejor combinación');
  });
});
