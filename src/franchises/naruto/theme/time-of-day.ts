// Franja horaria del fondo de Naruto (sesión 17). Igual que en Dragon Ball, es solo decoración: usa la hora local del
// navegador para elegir el cielo y nunca interviene en la elección del reto (SPEC 5 y 9.2). Hay tres versiones de la
// aldea (día, tarde y noche): el amanecer usa la misma luz anaranjada que el atardecer.

export type TimeOfDay = 'day' | 'dusk' | 'night';

/** Día de 8 a 18, tarde de 6 a 8 y de 18 a 20 (amanecer y atardecer) y noche de 20 a 6. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 8 && hour < 18) return 'day';
  if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 20)) return 'dusk';
  return 'night';
}
