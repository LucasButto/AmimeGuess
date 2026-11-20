import { describe, expect, it, vi } from 'vitest';
import { timeOfDay as dragonBall } from './dragon-ball/theme/time-of-day';
import { timeOfDay as naruto } from './naruto/theme/time-of-day';
import { timeOfDay as pokemon } from './pokemon/theme/time-of-day';
import { SKY_BOOT_SCRIPT } from './sky-boot';

/** Corre el script del <head> con una hora fija y devuelve los atributos que puso en <html>. */
function run(hour: number): Record<string, string> {
  const attributes: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value; } } };
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 20, hour, 30));
  try {
    new Function('document', SKY_BOOT_SCRIPT)(document);
  } finally {
    vi.useRealTimers();
  }
  return attributes;
}

describe('SKY_BOOT_SCRIPT', () => {
  it('marca en <html> la franja de cada piel, la misma que eligen sus fondos, a cualquier hora', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(run(hour), `hora ${hour}`).toEqual({
        'data-sky-pokemon': pokemon(hour),
        'data-sky-dragon-ball': dragonBall(hour),
        'data-sky-naruto': naruto(hour),
      });
    }
  });

  it('de noche no queda el día: a las 22 todas las pieles están en noche', () => {
    expect(Object.values(run(22))).toEqual(['night', 'night', 'night']);
  });
});
