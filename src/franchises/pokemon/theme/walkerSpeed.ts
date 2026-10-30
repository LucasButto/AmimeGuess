/** Multiplicador de reloj de los caminantes: solo lo mueve el botón de pruebas (desarrollo). */
let speed = 1;
export const getWalkerSpeed = () => speed;
export const setWalkerSpeed = (value: number) => { if ([0.5, 1, 2, 3].includes(value)) speed = value; };
