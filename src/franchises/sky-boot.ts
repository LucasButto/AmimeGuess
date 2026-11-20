// La franja horaria de los fondos (día, tarde, noche…) se marca en <html> antes de pintar, para que al cargar la página no
// se vea un instante el cielo de día y después el de la hora real. El servidor no sabe la hora del navegador: un script en
// el <head>, igual que el de las preferencias, pone `data-sky-<franquicia>` con la franja de cada piel, y los fondos se pintan
// con esos atributos (sus estilos no esperan a React). Es solo decoración: el reto nunca depende de la hora local.

import { timeOfDay as dragonBall } from './dragon-ball/theme/time-of-day';
import { timeOfDay as naruto } from './naruto/theme/time-of-day';
import { timeOfDay as pokemon } from './pokemon/theme/time-of-day';

/** La franja de cada piel según la hora: las mismas funciones que usan los fondos. */
const SKIES: Readonly<Record<string, (hour: number) => string>> = { pokemon, 'dragon-ball': dragonBall, naruto };

/** El atributo de <html> con la franja de una piel (`data-sky-pokemon="night"`). */
export const skyAttribute = (slug: string) => `data-sky-${slug}`;

/** Lo que hace el fondo al cambiar de franja con la página abierta: el mismo atributo que puso el script. */
export function markSky(slug: string, time: string): void {
  document.documentElement.setAttribute(skyAttribute(slug), time);
}

/** Script del <head>: la franja de cada piel con la hora local, antes del primer pintado. */
export const SKY_BOOT_SCRIPT = `try{var h=new Date().getHours(),d=document.documentElement;${Object.entries(SKIES)
  .map(([slug, fn]) => `d.setAttribute(${JSON.stringify(skyAttribute(slug))},(${fn.toString()})(h));`)
  .join('')}}catch(e){}`;
