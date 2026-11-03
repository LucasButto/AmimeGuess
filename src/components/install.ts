'use client';

import { useSyncExternalStore } from 'react';

// Instalar la app (SPEC 9.3). Chrome y Android avisan con `beforeinstallprompt` una sola vez, al abrir la página, y el aviso
// hay que guardarlo para usarlo más tarde (desde la pestaña Más). Safari de iPhone no tiene esa señal: solo se puede explicar
// el camino (Compartir → Agregar a pantalla de inicio). Este módulo guarda el aviso y lo comparte con quien lo pida.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Escucha la señal de instalación desde que la página abre. Devuelve cómo dejar de escuchar. Se llama una vez, desde la raíz. */
export function listenForInstallPrompt(): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    installedNow = true;
    notify();
  };
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cómo se puede instalar en este dispositivo: ya instalada, con el aviso nativo, o solo con instrucciones (iPhone y el resto). */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'manual';

function snapshot(): InstallState {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || installedNow) return 'installed';
  if (deferred !== null) return 'prompt';
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'manual';
}

/** El estado de la instalación (`manual` en el servidor y antes de hidratar: es lo más neutro). */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => 'manual');
}

/** Abre el aviso nativo de instalación (solo si el estado es `prompt`). */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (event === null) return;
  deferred = null;
  notify();
  await event.prompt();
  await event.userChoice.catch(() => undefined);
}
