// Franja horaria del fondo de Pokémon (sesión 15, fase 8). Es solo decoración: usa la hora local del
// navegador para el color del cielo y nunca interviene en la elección del reto (SPEC 5 y 9.2).

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Amanecer de 6 a 9, día de 9 a 18, atardecer de 18 a 20 y noche de 20 a 6. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}
