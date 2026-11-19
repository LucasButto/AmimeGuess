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

  it('suma las reglas del modo: meta de aciertos, fallos perdonados, objetivo y combinaciones', () => {
    expect(versusRulesText('timeAttack', { timeLimitMs: 120_000 }, { unlimited: true, targetScore: 10 }).lines).toEqual(['Meta: 10 aciertos']);
    expect(versusRulesText('fewestAttempts', {}, { forgivenErrors: 3 }).lines).toEqual(['Fallos perdonados: 3']);
    expect(versusRulesText('timeAttack', { timeLimitMs: 180_000 }, { unlimited: true, targetTotal: 500 }).lines).toEqual(['Objetivo: más de 500']);
    expect(versusRulesText('fewestAttempts', {}, { fixedAttempts: 3 }).lines).toEqual(['Hacés exactamente 3 combinaciones.']);
  });
});
