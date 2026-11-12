import { describe, expect, it } from 'vitest';
import { PRACTICE_FROM } from '../components/game-shell/practice';
import { VERSUS_FROM, VERSUS_SPAN, isVersusDay, versusDay } from './seed';

describe('días de versus', () => {
  it('misma semilla e índice dan el mismo día', () => {
    expect(versusDay('a1b2c3d4', 1)).toBe(versusDay('a1b2c3d4', 1));
    // Vector fijo: si cambia, las salas abiertas dejarían de coincidir entre el sitio y el servidor.
    expect(versusDay('a1b2c3d4', 1)).toBe(2_304_071_942);
  });

  it('caen siempre dentro del rango de versus, lejos de los días reales y de los de práctica', () => {
    expect(VERSUS_FROM).toBeGreaterThan(PRACTICE_FROM + 1_000_000_000);
    for (let seed = 0; seed < 300; seed++) {
      for (let index = 1; index <= 12; index++) {
        const day = versusDay(`seed-${seed}`, index);
        expect(isVersusDay(day)).toBe(true);
        expect(day).toBeLessThan(VERSUS_FROM + VERSUS_SPAN);
      }
    }
  });

  it('una partida ×3 (índices 1, 2 y 3) tiene tres días distintos, y los desempates siguen la numeración', () => {
    for (let seed = 0; seed < 500; seed++) {
      const days = [1, 2, 3, 11, 12].map((index) => versusDay(`room-${seed}`, index));
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('semillas distintas dan días distintos', () => {
    expect(versusDay('room-a', 1)).not.toBe(versusDay('room-b', 1));
  });

  it('isVersusDay solo acepta enteros del rango', () => {
    expect(isVersusDay(VERSUS_FROM)).toBe(true);
    expect(isVersusDay(VERSUS_FROM + VERSUS_SPAN - 1)).toBe(true);
    expect(isVersusDay(VERSUS_FROM + VERSUS_SPAN)).toBe(false);
    expect(isVersusDay(VERSUS_FROM - 1)).toBe(false);
    expect(isVersusDay(320)).toBe(false);
    expect(isVersusDay(PRACTICE_FROM + 5)).toBe(false);
    expect(isVersusDay(VERSUS_FROM + 0.5)).toBe(false);
  });
});
