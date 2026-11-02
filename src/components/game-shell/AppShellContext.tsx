'use client';

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createSurrenderRegistry } from './surrenderRegistry';

const AppShellContext = createContext(false);
const SurrenderContext = createContext<ReturnType<typeof createSurrenderRegistry> | null>(null);
const emptySnapshot = () => null;
const emptySubscribe = () => () => {};

export function AppShellProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [registry] = useState(createSurrenderRegistry);
  return (
    <AppShellContext.Provider value={enabled}>
      <SurrenderContext.Provider value={registry}>{children}</SurrenderContext.Provider>
    </AppShellContext.Provider>
  );
}

export const useAppShell = () => useContext(AppShellContext);
export const useSurrenderRegistry = () => useContext(SurrenderContext);
export function useSurrenderAction() {
  const registry = useSurrenderRegistry();
  return useSyncExternalStore(registry?.subscribe ?? emptySubscribe, registry?.getSnapshot ?? emptySnapshot, emptySnapshot);
}
