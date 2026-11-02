import { describe, expect, it } from 'vitest';
import { allFranchises } from './index';
import { appShellEnabled, modeSchema, modeSettings, sectionSchema, visibleFranchises } from './visibility';

const enabledRules = () => modeSettings.map((section) => ({ ...section, status: true, modes: section.modes.map((mode) => ({ ...mode, status: true })) }));

describe('data/mode.json', () => {
  it('acepta appShell booleano u omitido y rechaza otros tipos', () => {
    const section = { slug: 'test', name: 'Test', status: true, modes: [] };
    expect(sectionSchema.parse(section)).toEqual(section);
    for (const appShell of [true, false]) expect(sectionSchema.parse({ ...section, appShell }).appShell).toBe(appShell);
    for (const appShell of ['true', 1, null]) expect(sectionSchema.safeParse({ ...section, appShell }).success).toBe(false);
  });

  it('activa appShell solo si la sección existe, está activa y lo habilita explícitamente', () => {
    const section = { slug: 'test', name: 'Test', status: true, modes: [] };
    expect(appShellEnabled('test', [{ ...section, appShell: true }])).toBe(true);
    expect(appShellEnabled('test', [{ ...section, appShell: false }])).toBe(false);
    expect(appShellEnabled('test', [section])).toBe(false);
    expect(appShellEnabled('test', [{ ...section, status: false, appShell: true }])).toBe(false);
    expect(appShellEnabled('inexistente', [{ ...section, appShell: true }])).toBe(false);
  });

  it('con la configuración real, el diseño de app está prendido solo en Pokémon', () => {
    for (const franchise of allFranchises) expect(appShellEnabled(franchise.slug)).toBe(franchise.slug === 'pokemon');
  });

  it('todos los modos tienen try positivo y cambiarlo modifica la configuración pública', () => {
    for (const section of modeSettings) for (const mode of section.modes) expect(Number.isInteger(mode.try) && mode.try > 0).toBe(true);
    const rules = enabledRules();
    rules.find((section) => section.slug === 'pokemon')!.modes.find((mode) => mode.slug === 'clasico')!.try = 13;
    expect(visibleFranchises(allFranchises, rules).find((section) => section.slug === 'pokemon')!.modes.find((mode) => mode.slug === 'clasico')!.try).toBe(13);
    for (const value of [0, -1, 1.5, '8', undefined]) expect(modeSchema.safeParse({ slug: 'test', name: 'Test', status: true, try: value }).success).toBe(false);
  });
  it('enumera cada franquicia y cada modo configurado, sin duplicados', () => {
    expect(modeSettings.map((entry) => entry.slug).sort()).toEqual(allFranchises.map((entry) => entry.slug).sort());
    for (const config of allFranchises) {
      const section = modeSettings.find((entry) => entry.slug === config.slug)!;
      expect(section.modes.map((mode) => mode.slug).sort()).toEqual(config.modes.map((mode) => mode.slug).sort());
      expect(typeof section.status).toBe('boolean');
      expect(section.modes.every((mode) => typeof mode.status === 'boolean')).toBe(true);
    }
    expect(typeof modeSettings.find((entry) => entry.slug === 'pokemon')!.speedTest).toBe('boolean');
  });

  it('oculta una franquicia completa y todos sus modos sin modificar las configs', () => {
    const rules = enabledRules();
    rules.find((entry) => entry.slug === 'pokemon')!.status = false;
    const visible = visibleFranchises(allFranchises, rules);
    expect(visible.some((entry) => entry.slug === 'pokemon')).toBe(false);
    expect(visible).toHaveLength(3);
    expect(allFranchises[0].modes).toHaveLength(8);
  });

  it('oculta un solo modo y conserva sus vecinos en el registro público', () => {
    const rules = enabledRules();
    rules.find((entry) => entry.slug === 'pokemon')!.modes.find((mode) => mode.slug === 'clasico')!.status = false;
    const pokemon = visibleFranchises(allFranchises, rules).find((entry) => entry.slug === 'pokemon')!;
    expect(pokemon.modes.some((mode) => mode.slug === 'clasico')).toBe(false);
    expect(pokemon.modes.some((mode) => mode.slug === 'silueta')).toBe(true);
    expect(pokemon.modes).toHaveLength(7);
  });

  it('permite desactivar todas las secciones', () => {
    expect(visibleFranchises(allFranchises, modeSettings.map((entry) => ({ ...entry, status: false })))).toEqual([]);
  });
});
