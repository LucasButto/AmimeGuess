import type { VersusRoom } from './room';

/** Lo que el Worker recibe de Cloudflare: el espacio de nombres de las salas y las variables de `wrangler.jsonc`. */
export interface Env {
  readonly VERSUS_ROOM: DurableObjectNamespace<VersusRoom>;
  /** Los orígenes del sitio, separados por comas. */
  readonly ALLOWED_ORIGINS?: string;
}
