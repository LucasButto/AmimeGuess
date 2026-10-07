import { describe, expect, it } from 'vitest';
import { DAY_MS, EPOCH_MS, getDay, msUntilNextDay } from './day';

describe('getDay', () => {
  it('el día 0 empieza a medianoche de Argentina: 2026-01-01T03:00:00Z', () => {
    expect(EPOCH_MS).toBe(Date.parse('2026-01-01T03:00:00Z'));
    expect(getDay(new Date('2026-01-01T03:00:00.000Z'))).toBe(0);
  });

  it('un milisegundo antes del inicio todavía es el día anterior', () => {
    expect(getDay(new Date('2026-01-01T02:59:59.999Z'))).toBe(-1);
  });

  it('cambia de día exactamente a las 00:00 de Argentina', () => {
    expect(getDay(new Date('2026-01-02T02:59:59.999Z'))).toBe(0);
    expect(getDay(new Date('2026-01-02T03:00:00.000Z'))).toBe(1);
  });

  it('es el mismo número en todo el mundo: solo importa el instante', () => {
    // Medianoche en Buenos Aires, Tokio y Los Ángeles son tres instantes distintos.
    expect(getDay(new Date('2026-03-10T00:00:00-03:00'))).toBe(getDay(new Date('2026-03-10T03:00:00Z')));
    expect(getDay(new Date('2026-03-10T00:00:00+09:00'))).toBe(getDay(new Date('2026-03-09T15:00:00Z')));
    expect(getDay(new Date('2026-03-10T00:00:00-03:00'))).toBe(68);
  });

  it('cuenta un día por cada 86.400.000 ms', () => {
    expect(getDay(new Date(EPOCH_MS + 365 * DAY_MS))).toBe(365);
    expect(getDay(new Date(EPOCH_MS + 365 * DAY_MS - 1))).toBe(364);
  });

  it('también funciona antes de la época', () => {
    expect(getDay(new Date(EPOCH_MS - DAY_MS))).toBe(-1);
    expect(getDay(new Date(EPOCH_MS - DAY_MS - 1))).toBe(-2);
  });
});

describe('msUntilNextDay', () => {
  it('justo en el reinicio falta un día entero', () => {
    expect(msUntilNextDay(new Date(EPOCH_MS))).toBe(DAY_MS);
  });

  it('un milisegundo antes del reinicio falta 1 ms', () => {
    expect(msUntilNextDay(new Date(EPOCH_MS + DAY_MS - 1))).toBe(1);
  });

  it('a mitad del día falta la mitad', () => {
    expect(msUntilNextDay(new Date(EPOCH_MS + DAY_MS / 2))).toBe(DAY_MS / 2);
  });

  it('al sumarle lo que falta se llega al día siguiente', () => {
    const now = new Date('2026-06-15T13:27:41.123Z');
    const next = new Date(now.getTime() + msUntilNextDay(now));
    expect(getDay(next)).toBe(getDay(now) + 1);
    expect(getDay(new Date(next.getTime() - 1))).toBe(getDay(now));
  });
});
