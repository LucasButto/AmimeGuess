// El interruptor general del versus, en un módulo sin dependencias: el inicio y "Más" lo consultan sin cargar nada del versus
// (ni zod ni el protocolo). Sin `NEXT_PUBLIC_VERSUS_URL`, el versus no existe.

/** La dirección del servidor de salas (`wss://…` o `ws://localhost:8787`), o `undefined` si el versus está apagado. */
export function versusUrl(): string | undefined {
  // Next reemplaza esta variable al compilar: tiene que escribirse así, sin desestructurar `process.env`.
  const url = process.env.NEXT_PUBLIC_VERSUS_URL;
  return url ? url.replace(/\/$/, '') : undefined;
}

/** El interruptor general: sin la variable, el versus no aparece en ningún lado. */
export function versusEnabled(): boolean {
  return versusUrl() !== undefined;
}
