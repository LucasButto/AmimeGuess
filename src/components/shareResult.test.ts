import { describe, expect, it, vi } from 'vitest';
import { shareOrCopy } from './shareResult';

describe('shareOrCopy', () => {
  it('usa navigator.share con el texto cuando existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = vi.fn().mockResolvedValue(true);
    expect(await shareOrCopy('mi resultado', copy, { share })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'mi resultado' });
    expect(copy).not.toHaveBeenCalled();
  });

  it('copia cuando el navegador no tiene navigator.share', async () => {
    const copy = vi.fn().mockResolvedValue(true);
    expect(await shareOrCopy('mi resultado', copy, {})).toBe('copied');
    expect(copy).toHaveBeenCalledWith('mi resultado');
  });

  it('si la persona cierra el menú (AbortError) no copia', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    const copy = vi.fn().mockResolvedValue(true);
    expect(await shareOrCopy('x', copy, { share })).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });

  it('si compartir falla por otra razón, copia', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('sin permiso', 'NotAllowedError'));
    const copy = vi.fn().mockResolvedValue(true);
    expect(await shareOrCopy('x', copy, { share })).toBe('copied');
    expect(copy).toHaveBeenCalledWith('x');
  });

  it('avisa si tampoco se pudo copiar', async () => {
    const copy = vi.fn().mockResolvedValue(false);
    expect(await shareOrCopy('x', copy, {})).toBe('failed');
  });
});
