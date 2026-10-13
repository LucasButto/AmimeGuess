// Servidor de producción y navegador para los chequeos con Playwright (check:responsive y check:design).
//
// `startServer` levanta `next start` en un puerto libre (hace falta `npm run build` antes) o, con
// BASE_URL=http://…, usa un servidor ya levantado. `launchBrowser` usa el Chromium de Playwright si está
// instalado y, si no, el Chrome o el Edge del sistema.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');


function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl: string, child: ChildProcess | null, log: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`El servidor se cerró al arrancar:\n${log()}`);
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`El servidor no respondió en 60 s:\n${log()}`);
}

export async function startServer(): Promise<{ baseUrl: string; stop: () => void }> {
  if (process.env.BASE_URL) {
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '');
    await waitForServer(baseUrl, null, () => '');
    return { baseUrl, stop: () => {} };
  }

  if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No hay build de producción. Ejecutá `npm run build` y volvé a correr este comando.');
  }

  const port = await freePort();
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], { cwd: ROOT });
  let output = '';
  child.stdout.on('data', (chunk) => (output += String(chunk)));
  child.stderr.on('data', (chunk) => (output += String(chunk)));

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl, child, () => output);
  } catch (error) {
    child.kill();
    throw error;
  }
  return { baseUrl, stop: () => child.kill() };
}

/** El Chromium de Playwright si está instalado; si no, el Chrome o el Edge del sistema. */
export async function launchBrowser(): Promise<{ browser: Browser; label: string }> {
  const candidates = [
    { label: 'Chromium de Playwright', options: {} },
    { label: 'Google Chrome', options: { channel: 'chrome' } },
    { label: 'Microsoft Edge', options: { channel: 'msedge' } },
  ];
  for (const candidate of candidates) {
    try {
      return { browser: await chromium.launch({ headless: true, ...candidate.options }), label: candidate.label };
    } catch {
      // Se prueba el siguiente.
    }
  }
  throw new Error('No se encontró ningún navegador. Instalá uno con `npx playwright install chromium`.');
}
