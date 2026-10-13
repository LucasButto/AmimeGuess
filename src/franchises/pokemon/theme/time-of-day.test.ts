import { describe, expect, it } from 'vitest';
import { timeOfDay } from './time-of-day';

describe('timeOfDay', () => {
  it('reparte las 24 horas en las cuatro franjas', () => {
    const byHour = Array.from({ length: 24 }, (_, hour) => timeOfDay(hour));
    expect(byHour.slice(0, 6)).toEqual(Array(6).fill('night'));
    expect(byHour.slice(6, 9)).toEqual(Array(3).fill('dawn'));
    expect(byHour.slice(9, 18)).toEqual(Array(9).fill('day'));
    expect(byHour.slice(18, 20)).toEqual(Array(2).fill('dusk'));
    expect(byHour.slice(20, 24)).toEqual(Array(4).fill('night'));
  });
});
