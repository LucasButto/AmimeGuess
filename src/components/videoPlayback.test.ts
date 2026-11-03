import { describe, expect, it } from 'vitest';
import { nextPlayback, showsControl, type PlaybackState } from './videoPlayback';

describe('estado de reproducción de un clip', () => {
  it('arranca, se pausa y vuelve a arrancar', () => {
    let state: PlaybackState = 'idle';
    state = nextPlayback(state, 'playing');
    expect(state).toBe('playing');
    state = nextPlayback(state, 'paused');
    expect(state).toBe('paused');
    expect(nextPlayback(state, 'playing')).toBe('playing');
  });

  it('si el navegador no deja arrancarlo solo, queda bloqueado y un toque lo arranca', () => {
    const blocked = nextPlayback('idle', 'blocked');
    expect(blocked).toBe('blocked');
    expect(nextPlayback(blocked, 'playing')).toBe('playing');
  });

  it('un archivo que falló no vuelve a intentarse', () => {
    const failed = nextPlayback('playing', 'failed');
    expect(failed).toBe('failed');
    for (const event of ['playing', 'paused', 'blocked'] as const) expect(nextPlayback(failed, event)).toBe('failed');
  });

  it('el botón está con menos movimiento, bloqueado o en pausa; nunca con el clip andando ni si falló', () => {
    expect(showsControl('playing', false)).toBe(false);
    expect(showsControl('idle', false)).toBe(false);
    expect(showsControl('blocked', false)).toBe(true);
    expect(showsControl('paused', false)).toBe(true);
    expect(showsControl('playing', true)).toBe(true);
    expect(showsControl('idle', true)).toBe(true);
    expect(showsControl('failed', true)).toBe(false);
    expect(showsControl('failed', false)).toBe(false);
  });
});
