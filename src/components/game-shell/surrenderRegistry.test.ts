import { describe, expect, it, vi } from 'vitest';
import { createSurrenderRegistry } from './surrenderRegistry';

describe('surrender registry', () => {
  it('opens the current confirmation and becomes unavailable on unmount', () => {
    const store = createSurrenderRegistry();
    const open = vi.fn();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.getSnapshot()).toBeNull();
    store.open();
    const unregister = store.register({ open, disabled: false });
    const snapshot = store.getSnapshot();
    expect(store.getSnapshot()).toBe(snapshot);
    store.open();
    expect(open).toHaveBeenCalledTimes(1);
    unregister();
    expect(store.getSnapshot()).toBeNull();
    store.open();
    expect(open).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.register({ open, disabled: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('honors disabled updates without invoking a previous action', () => {
    const store = createSurrenderRegistry();
    const oldOpen = vi.fn();
    const open = vi.fn();
    const cleanup = store.register({ open: oldOpen, disabled: false });
    store.register({ open, disabled: true });
    cleanup();
    expect(store.getSnapshot()?.disabled).toBe(true);
    store.open();
    expect(oldOpen).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    store.register({ open, disabled: false });
    store.open();
    expect(open).toHaveBeenCalledOnce();
  });

  it('survives effect cleanup/remount and keeps providers isolated', () => {
    const store = createSurrenderRegistry();
    const other = createSurrenderRegistry();
    const action = { open: vi.fn(), disabled: false };
    const cleanup = store.register(action);
    cleanup();
    const remountCleanup = store.register(action);
    cleanup();
    expect(store.getSnapshot()).not.toBeNull();
    expect(other.getSnapshot()).toBeNull();
    remountCleanup();
    remountCleanup();
    expect(store.getSnapshot()).toBeNull();
  });
});
