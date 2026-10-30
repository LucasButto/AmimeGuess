import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { Entity } from '../../../src/engine/types.ts';
import entities from '../../../data/pokemon/entities.json';
import {
  parseAnimData, resolveAnimation, directionCrop, opaqueBounds, PMD_TICK_MS,
  mapPokemonName, parseArtistNames, parseCredits, creditsFor, creditsForForm, withPmdPortraits,
  portraitUrl, buildPortraitIndex, sleepRecipe,
} from './pmd-core.ts';
import { processDirection, processShadow, processPortrait, sameVisiblePixels } from './pmd-images.ts';
import { PMD_REQUESTED, PMD_EXCLUDED, movementFor, presentationFor, PMD_GALAR, PMD_SERPENTINES } from './pmd-roster.ts';

const xml = (body: string) => `<AnimData><ShadowSize>1</ShadowSize><Anims>${body}</Anims></AnimData>`;
const walkXml = '<Anim><Name>Walk</Name><FrameWidth>2</FrameWidth><FrameHeight>2</FrameHeight><Durations><Duration>4</Duration><Duration>7</Duration></Durations></Anim>';
const sample: Entity = { id: 'sample', name: { es: 'Ejemplo' }, aliases: [], series: ['g1'], image: 'pokemon/sample', attrs: { numero: 1, tipo1: 'Planta' } };

describe('PMD AnimData', () => {
  it('requiere pose de sue?o real y elige Wake o Idle sin inventar animaciones', () => {
    const alias=(name:string)=>`<Anim><Name>${name}</Name><CopyOf>Walk</CopyOf></Anim>`;
    expect(sleepRecipe(parseAnimData(xml(walkXml+alias('Idle'))))).toBeNull();
    expect(sleepRecipe(parseAnimData(xml(walkXml+alias('Sleep')+alias('Idle'))))).toEqual({enter:null,sleep:'Sleep',wake:'Idle'});
    expect(sleepRecipe(parseAnimData(xml(walkXml+alias('Sleep')+alias('Wake')+alias('Idle'))))?.wake).toBe('Wake');
    expect(sleepRecipe(parseAnimData(xml(walkXml+alias('Sleep'))))).toBeNull();
  });
  it('preserva duraciones distintas y resuelve CopyOf sin inventar cuadros', () => {
    const data = parseAnimData(xml(walkXml + '<Anim><Name>Idle</Name><CopyOf>Walk</CopyOf></Anim>'));
    expect(data.shadowSize).toBe(1);
    expect(resolveAnimation(data, 'Idle')).toEqual({ name: 'Walk', width: 2, height: 2, ticks: [4, 7] });
    expect(resolveAnimation(data, 'HitGround')).toBeNull();
    expect(PMD_TICK_MS).toBe(20);
  });
  it('rechaza DTD, medidas, duraciones, duplicados y alias inválidos', () => {
    expect(() => parseAnimData('<!DOCTYPE AnimData>' + xml(walkXml))).toThrow();
    expect(() => parseAnimData(xml(walkXml.replace('<Duration>4', '<Duration>0')))).toThrow();
    expect(() => parseAnimData(xml(walkXml.replace('<FrameWidth>2', '<FrameWidth>-2')))).toThrow();
    expect(() => parseAnimData(xml(walkXml + walkXml))).toThrow();
    const cycle = parseAnimData(xml('<Anim><Name>A</Name><CopyOf>B</CopyOf></Anim><Anim><Name>B</Name><CopyOf>A</CopyOf></Anim>'));
    expect(() => resolveAnimation(cycle, 'A')).toThrow('Ciclo');
    const missing = parseAnimData(xml('<Anim><Name>A</Name><CopyOf>Missing</CopyOf></Anim>'));
    expect(() => resolveAnimation(missing, 'A')).toThrow('inexistente');
  });
  it('recorta este/oeste en filas 2/6 y soporta HitGround de una sola dirección', () => {
    const animation = resolveAnimation(parseAnimData(xml(walkXml)), 'Walk')!;
    expect(directionCrop(4, 16, animation, 'east')).toMatchObject({ top: 4, sourceRow: 2 });
    expect(directionCrop(4, 16, animation, 'west')).toMatchObject({ top: 12, sourceRow: 6 });
    expect(directionCrop(4, 2, animation, 'west')).toMatchObject({ top: 0, sourceRow: 0 });
    expect(() => directionCrop(4, 4, animation, 'east')).toThrow();
    expect(() => directionCrop(6, 16, animation, 'east')).toThrow();
  });
});

describe('PMD píxeles y anclaje', () => {
  it('optimiza filas sin cambiar colores, tamaño, orden, alfa ni tiempos', async () => {
    const raw = Buffer.alloc(4 * 16 * 4);
    for (let row = 0; row < 8; row++) for (let frame = 0; frame < 2; frame++) {
      const offset = (row * 2 * 4 + frame * 2) * 4;
      raw.set([row * 30, frame * 120, 50, 255], offset);
    }
    const source = await sharp(raw, { raw: { width: 4, height: 16, channels: 4 } }).png().toBuffer();
    const animation = resolveAnimation(parseAnimData(xml(walkXml)), 'Walk')!;
    for (const [direction, row] of [['east', 2], ['west', 6]] as const) {
      const result = await processDirection(source, animation, direction);
      const decoded = await sharp(result.image).ensureAlpha().raw().toBuffer();
      expect([...decoded.subarray(0, 4)]).toEqual([row * 30, 0, 50, 255]);
      expect(result.metadata).toMatchObject({ width: 4, height: 2, anchor: { x: 1, y: 5 }, sourceRow: row, totalDurationMs: 220 });
      expect(result.metadata.bbox).toEqual({ x: 0, y: 0, width: 1, height: 1 });
      expect(result.metadata.frames.map((frame) => frame.durationMs)).toEqual([80, 140]);
      expect(result.metadata.frames[1]).toMatchObject({ x: 2, y: 0, offset: { x: -1, y: -5 }, bbox: { x: 0, y: 0, width: 1, height: 1 } });
    }
  });
  it('bbox local incluye alfa parcial, acepta cuadros vacíos y no otras columnas', () => {
    const rgba = Buffer.alloc(4 * 2 * 4);
    rgba[(1 * 4 + 3) * 4 + 3] = 1;
    expect(opaqueBounds(rgba, 4, { x: 2, y: 0, width: 2, height: 2 })).toEqual({ x: 1, y: 1, width: 1, height: 1 });
    expect(opaqueBounds(rgba, 4, { x: 0, y: 0, width: 2, height: 2 })).toBeNull();
    expect(sameVisiblePixels(new Uint8Array([1, 2, 3, 0]), new Uint8Array([4, 5, 6, 0]))).toBe(true);
    expect(sameVisiblePixels(new Uint8Array([1, 2, 3, 255]), new Uint8Array([4, 5, 6, 255]))).toBe(false);
  });
  it('valida retratos 40×40, no vacíos, sin reescalar ni cuantizar', async () => {
    const source = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 33, g: 80, b: 190, alpha: 0.5 } } }).png().toBuffer();
    const result = await processPortrait(source);
    expect(await sharp(result).metadata()).toMatchObject({ width: 40, height: 40, format: 'png' });
    expect(sameVisiblePixels(await sharp(source).ensureAlpha().raw().toBuffer(), await sharp(result).ensureAlpha().raw().toBuffer())).toBe(true);
    await expect(processPortrait(await sharp(source).resize(20, 20).png().toBuffer())).rejects.toThrow('40×40');
    const empty = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(processPortrait(empty)).rejects.toThrow('vacío');
  });
});

describe('PMD selección y datos', () => {
  it('mapea todos los nombres y números, sin sustituir la forma base por otra', () => {
    const mapped = PMD_REQUESTED.map((entry) => mapPokemonName(entry.name, entities));
    expect(mapped).toHaveLength(375);
    expect(new Set(mapped.map((entry) => `${entry.number}/${entry.form}`)).size).toBe(375);
    const selected = PMD_REQUESTED.filter((entry) => !PMD_EXCLUDED.has(entry.name));
    expect(selected).toHaveLength(369);
    expect(PMD_EXCLUDED.size).toBe(6);
    expect(PMD_EXCLUDED.has('Falinks')).toBe(true);
    expect(mapPokemonName('Exeggutor de Alola', entities)).toMatchObject({ number: 103, dex: '0103', entityId: 'exeggutor', form: 'alola' });
    expect(mapPokemonName("Farfetch'd", entities).number).toBe(83);
    expect(mapPokemonName('Mr. Mime', entities).number).toBe(122);
    expect(() => mapPokemonName('No existe', entities)).toThrow();
    expect(movementFor('Cyclizar')).toBe('run');
    expect(movementFor('Diglett')).toBe('burrow');
    expect(movementFor('Porygon-Z')).toBe('hover');
    expect(PMD_REQUESTED.find((entry) => entry.name === 'Hoppip')?.zone).toBe('sky');
  });
  it('agrega sólo pmdPortrait y conserva arte oficial, atributos, IDs y series', () => {
    const result = withPmdPortraits([sample], new Set([1]));
    expect(result[0]).toEqual({ ...sample, attrs: { ...sample.attrs, pmdPortrait: '/img/pokemon/pmd/0001/normal.png' } });
    expect(sample.attrs).not.toHaveProperty('pmdPortrait');
    expect(withPmdPortraits([sample], new Set())[0].attrs.pmdPortrait).toBeNull();
  });
  it('indexa Normal/Happy/Sad sin sustituir emociones faltantes y cuenta cada ausencia', () => {
    expect(portraitUrl(1)).toBe('/img/pokemon/pmd/0001/normal.png');
    expect(portraitUrl(25, 'happy')).toBe('/img/pokemon/pmd/0025/happy.png');
    expect(portraitUrl(1025, 'sad')).toBe('/img/pokemon/pmd/1025/sad.png');
    const entries = [
      { number: 2, entityId: 'ivysaur', emotions: { normal: portraitUrl(2), happy: null, sad: portraitUrl(2, 'sad') } },
      { number: 1, entityId: 'bulbasaur', emotions: { normal: portraitUrl(1), happy: portraitUrl(1, 'happy'), sad: null } },
    ];
    const index = buildPortraitIndex(entries);
    expect(Object.keys(index.portraits)).toEqual(['0001', '0002']);
    expect(index.available).toEqual({ normal: 2, happy: 1, sad: 1 });
    expect(index.missing).toEqual({ normal: [], happy: [2], sad: [1] });
    expect(index.portraits['0002'].happy).toBeNull();
    expect(index.portraits['0001'].sad).toBeNull();
    expect(() => buildPortraitIndex([entries[0], entries[0]])).toThrow('repetido');
    expect(buildPortraitIndex([]).missing).toEqual({ normal: [], happy: [], sad: [] });
  });
});

describe('PMD créditos generados', () => {
  it('resuelve IDs de Discord sin perder artista, contacto o CHUNSOFT', () => {
    const artists = parseArtistNames('Name\tDiscord\tContact\nCHUNSOFT\tCHUNSOFT\thttps://example.org\nArtista\t<@!123>\thttps://artist.example\n');
    expect(artists.get('123')).toEqual({ id: '123', name: 'Artista', contact: 'https://artist.example' });
    expect(artists.get('CHUNSOFT')?.name).toBe('CHUNSOFT');
  });
  it('filtra aportes por recurso/emoción, preservando coautorías históricas y licencia original', () => {
    const records = parseCredits('2020-01-01\tCHUNSOFT\tOLD\tUnspecified\tWalk,Idle\n2024-01-01\t<@123>\tCUR\tCC_BY-NC_4\tWalk,Normal\n2024-01-02\t<@456>\tCUR\tCC_BY-NC_4\tHappy\n2024-01-03\t<@789>\tCUR\tCC_BY-NC_4\tSad\n');
    expect(creditsFor(records, ['Walk']).map((credit) => credit.artistId)).toEqual(['CHUNSOFT', '123']);
    expect(creditsFor(records, ['Normal'])).toEqual([records[1]]);
    expect(creditsFor(records, ['Happy'])).toEqual([records[2]]);
    expect(creditsFor(records, ['Sad'])).toEqual([records[3]]);
    expect(creditsFor(records, ['Walk'])[0].sourceLicense).toBe('Unspecified');
    expect(() => creditsFor(records, ['HitGround'])).toThrow('Faltan créditos');
    expect(() => parseCredits('registro roto')).toThrow();
  });
});


describe('PMD decisiones de vuelo y fuentes', () => {
  it('preserva Walk como valor por defecto y usa las formas aprobadas', () => {
    expect(presentationFor('Swellow', 'sky')).toMatchObject({zone:'sky',locomotion:'Shoot'});
    expect(presentationFor('Charizard', 'ground')).toMatchObject({zone:'sky',locomotion:'Walk',sourceForm:'0005'});
    expect(presentationFor('Diglett', 'ground')).toMatchObject({sourceForm:'0003',locomotion:'Idle',movement:'burrow'});
    expect(presentationFor('Dugtrio', 'ground')).toMatchObject({sourceForm:'0002',locomotion:'Idle'});
    for (const p of PMD_GALAR) {
      expect(entities.some(e=>e.id===p.entityId)).toBe(false);
      expect(presentationFor(p.name,p.zone)).toMatchObject({sourceForm:'0001',form:'galar',locomotion:'Walk'});
    }
    expect(presentationFor('Zapdos de Galar','ground').movement).toBe('run');
  });
  it('incluye los autores del tracker sin inventar registros ni licencias', () => {
    const records=parseCredits('2024-01-01\t<@123>\tCUR\tCC_BY-NC_4\tHover\n2024-01-02\t<@456>\tOLD\tUnspecified\tWalk\n');
    expect(creditsForForm(records,['Hover'],{primary:'<@!456>',secondary:['123'],total:2})).toEqual(records);
    expect(()=>creditsForForm(records,['Hover'],{primary:'missing',secondary:[],total:1})).toThrow('tracker');
  });
  it('decodifica la sombra RGB nativa sin cambiar filas, anclas ni duraciones', async () => {
    const animation=resolveAnimation(parseAnimData(xml(walkXml)),'Walk')!;
    const raw=Buffer.alloc(4*16*4);
    for(let row=0;row<8;row++) {
      raw.set([0,255,0,255],row*2*4*4);
      raw.set([255,0,0,255],row*2*4*4+4);
      raw.set([0,0,255,255],row*2*4*4+8);
    }
    const source=await sharp(raw,{raw:{width:4,height:16,channels:4}}).png().toBuffer();
    for(const direction of ['east','west'] as const) for(const size of [0,1,2]) {
      const output=await processShadow(source,animation,direction,size);
      const pixels=await sharp(output.image).ensureAlpha().raw().toBuffer();
      expect([pixels[3],pixels[7],pixels[11]]).toEqual([160,size>0?160:0,size>1?160:0]);
      expect(output.metadata).toMatchObject({sourceRow:direction==='east'?2:6,totalDurationMs:220,anchor:{x:1,y:5}});
    }
  });
});


it('recorta f1/f0 a 120 ms, conservando pixeles, ancla y bbox solo de los cuadros elegidos', async () => {
  const animation={name:'FlapAround',width:2,height:2,ticks:[2,2,2]};
  const raw=Buffer.alloc(6*16*4);
  for(let row=0;row<8;row++) {
    raw.set([10,20,30,255],(row*2*6)*4);
    raw.set([40,50,60,255],(row*2*6+2)*4);
    raw.set([70,80,90,255],((row*2+1)*6+5)*4);
  }
  const source=await sharp(raw,{raw:{width:6,height:16,channels:4}}).png().toBuffer();
  for(const direction of ['east','west'] as const) {
    const result=await processDirection(source,animation,direction,{indices:[1,0],durationMs:120});
    expect(result.metadata).toMatchObject({width:4,height:2,anchor:{x:1,y:5},bbox:{x:0,y:0,width:1,height:1},referenceBbox:{x:0,y:0,width:2,height:2},totalDurationMs:240});
    expect(result.metadata.frames.map(f=>f.sourceIndex)).toEqual([1,0]);
    expect(result.metadata.frames.map(f=>[f.x,f.durationMs,f.ticks])).toEqual([[0,120,6],[2,120,6]]);
    const pixels=await sharp(result.image).ensureAlpha().raw().toBuffer();
    expect([...pixels.subarray(0,4)]).toEqual([40,50,60,255]);
    expect([...pixels.subarray(8,12)]).toEqual([10,20,30,255]);
    const markers=Buffer.alloc(6*16*4);
    for(let row=0;row<8;row++)for(let frame=0;frame<3;frame++)markers.set([0,255,0,255],(row*2*6+frame*2)*4);
    const shadowSource=await sharp(markers,{raw:{width:6,height:16,channels:4}}).png().toBuffer();
    const shadow=await processShadow(shadowSource,animation,direction,2,{indices:[1,0],durationMs:120});
    expect(shadow.metadata.anchor).toEqual(result.metadata.anchor);
    expect(shadow.metadata.frames.map(f=>[f.sourceIndex,f.durationMs])).toEqual([[1,120],[0,120]]);
    expect(shadow.metadata.totalDurationMs).toBe(240);
    expect(shadow.metadata.width).toBe(4);
  }
});

it('las formas serpentinas se declaran explicitamente, sin clasificar por densidad', () => {
  expect(Object.keys(PMD_SERPENTINES).sort()).toEqual(['arbok','dragonair','dratini','ekans','onix','rayquaza','serperior','seviper','snom']);
  for(const [id,reason]of Object.entries(PMD_SERPENTINES)) {
    expect(entities.some(e=>e.id===id)).toBe(true);
    expect(reason.length).toBeGreaterThan(20);
  }
  for(const id of ['hatterene','gastly','haunter','lugia','dialga','palkia','spinda']) expect(PMD_SERPENTINES[id]).toBeUndefined();
});
