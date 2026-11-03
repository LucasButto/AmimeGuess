export interface SurrenderAction {
  readonly open: () => void;
  readonly disabled: boolean;
}

/** Each cleanup belongs to one registration, never to a later game. */
export function createSurrenderRegistry() {
  let current: SurrenderAction | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    register(action: SurrenderAction) {
      const entry = { ...action };
      current = entry;
      notify();
      return () => {
        if (current !== entry) return;
        current = null;
        notify();
      };
    },
    open() {
      if (current && !current.disabled) current.open();
    },
  };
}
