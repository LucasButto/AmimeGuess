// Formas exclusivas de Fusión: no modifica las especies ni los retos existentes.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { API_BASE, ROOT, getJson, getFile, mapPool } from './api.ts';
import { pokemonSchema } from './schemas.ts';
import { renderImage } from './images.ts';
import type { Entity } from '../../../src/engine/types.ts';

const base: Entity[] = JSON.parse(await readFile(path.join(ROOT, 'data/pokemon/entities.json'), 'utf8'));
const list = await getJson(`${API_BASE}/pokemon?limit=2000`, z.object({ results: z.array(z.object({ name: z.string(), url: z.string() })) }));
const entries = list.results.filter((entry) => !entry.name.includes('totem') && /-(mega|alola|galar|hisui|paldea)(?:-|$)/.test(entry.name));
const keys: Record<string, string> = { hp: 'ps', attack: 'ataque', defense: 'defensa', 'special-attack': 'ataqueEspecial', 'special-defense': 'defensaEspecial', speed: 'velocidad' };
const forms = await mapPool(entries, 4, async (entry) => {
  const data = await getJson(entry.url, pokemonSchema.extend({ species: z.object({ name: z.string() }) }));
  const rootName = data.species.name;
  const parent = base.find((entity) => entity.id === rootName);
  if (!parent) throw Error(`Falta especie base: ${rootName}`);
  const mega = entry.name.includes('-mega');
  const suffix = entry.name.slice(rootName.length + 1);
  const labels: Record<string, string> = { mega: 'Mega', 'mega-x': 'Mega X', 'mega-y': 'Mega Y', alola: 'de Alola', galar: 'de Galar', hisui: 'de Hisui', paldea: 'de Paldea' };
  const image = data.sprites.other?.['official-artwork']?.front_default;
  if (!image) throw Error(`Falta arte oficial: ${entry.name}`);
  await renderImage(entry.name, await getFile(image, `stat-forms/${entry.name}.png`), path.join(ROOT, 'public/img/pokemon/stat-forms'));
  return { ...parent, id: entry.name, name: { es: `${parent.name.es} ${labels[suffix] ?? suffix.replaceAll('-', ' ')}` }, aliases: [], series: parent.series, image: `pokemon/stat-forms/${entry.name}`, attrs: { ...parent.attrs, ...Object.fromEntries(data.stats.map((stat) => [keys[stat.stat.name], stat.base_stat])), statForm: mega ? 'mega' : 'regional' } };
});
await writeFile(path.join(ROOT, 'data/pokemon/stat-forms.json'), JSON.stringify(forms, null, 2) + '\n');
console.log(`Formas regionales y megas: ${forms.length}`);
