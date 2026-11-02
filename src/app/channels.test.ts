import { describe, expect, it } from 'vitest';
import { channelProgress, nextPending, type Channel, type Progress } from './channels';

const channel = (slug: string, modes: string[], comingSoon = false): Channel => ({ slug, name: slug, modes, modeNames: {}, comingSoon });
const today = (solved: string[]) => ({ solved: new Set(solved), attempts: new Map<string, number>(), lost: new Set<string>() });

const channels = [channel('pokemon', ['clasico', 'silueta']), channel('naruto', ['clasico', 'frase']), channel('yugioh', [], true)];

describe('nextPending', () => {
  it('no sabe nada hasta que se leyó el progreso', () => {
    expect(nextPending(channels, null, 0)).toBeNull();
  });

  it('empieza por el canal que se ve y toma su primer modo sin resolver', () => {
    const progress: Progress = new Map([['pokemon', today(['clasico'])], ['naruto', today([])]]);
    expect(nextPending(channels, progress, 0)).toEqual({ channel: channels[0], mode: 'silueta' });
    expect(nextPending(channels, progress, 1)).toEqual({ channel: channels[1], mode: 'clasico' });
  });

  it('si el canal que se ve está completo, sigue con el próximo y da la vuelta', () => {
    const progress: Progress = new Map([['pokemon', today(['clasico', 'silueta'])], ['naruto', today(['clasico', 'frase'])]]);
    expect(nextPending(channels, progress, 0)).toBe('done');
    const partial: Progress = new Map([['pokemon', today([])], ['naruto', today(['clasico', 'frase'])]]);
    expect(nextPending(channels, partial, 1)).toEqual({ channel: channels[0], mode: 'clasico' });
  });

  it('los canales "Próximamente" no cuentan, ni arrancando en uno', () => {
    const progress: Progress = new Map([['pokemon', today([])], ['naruto', today([])]]);
    expect(nextPending(channels, progress, 2)).toEqual({ channel: channels[0], mode: 'clasico' });
  });
});

describe('channelProgress', () => {
  it('cuenta lo resuelto y marca completo solo con todos los modos', () => {
    const progress: Progress = new Map([['pokemon', today(['clasico'])]]);
    expect(channelProgress(channels[0], progress)).toMatchObject({ count: 1, done: false });
    expect(channelProgress(channels[0], new Map([['pokemon', today(['clasico', 'silueta'])]]))).toMatchObject({ count: 2, done: true });
  });

  it('mientras no se leyó el progreso no hay conteo; un canal sin modos nunca está completo', () => {
    expect(channelProgress(channels[0], null)).toMatchObject({ solved: null, count: 0, done: false });
    expect(channelProgress(channels[2], new Map([['yugioh', today([])]]))).toMatchObject({ done: false });
  });
});
