import { describe, expect, it } from 'vitest';
import { parseDexTemplate, pickWikidexText, wikidexDexText, wikidexUrl } from './wikidex.ts';

const PAGE = `Intro
== Descripción Pokédex ==
{{Pokédex
| generación = 9
| escarlata = Su sedoso pelaje se asemeja a las [[planta|plantas]].
| púrpura = Su cuerpo desprende una dulce fragancia.
| go = escarlata
}}

=== En el anime ===`;

describe('parseDexTemplate', () => {
  it('lee los campos de la plantilla', () => {
    const fields = parseDexTemplate(PAGE);
    expect(fields.get('escarlata')).toBe('Su sedoso pelaje se asemeja a las [[planta|plantas]].');
    expect(fields.get('go')).toBe('escarlata');
  });

  it('sin plantilla no hay campos', () => {
    expect(parseDexTemplate('nada').size).toBe(0);
  });
});

describe('pickWikidexText', () => {
  it('prefiere Escarlata y limpia los enlaces', () => {
    expect(pickWikidexText(parseDexTemplate(PAGE))).toEqual({
      text: 'Su sedoso pelaje se asemeja a las plantas.',
      version: 'scarlet',
    });
  });

  it('salta "no hay" y usa Leyendas Arceus', () => {
    const fields = new Map([
      ['leyendas Arceus', "Sus orbes '''negros''' brillan."],
      ['escarlata', 'no hay'],
      ['púrpura', 'no hay'],
    ]);
    expect(pickWikidexText(fields)).toEqual({ text: 'Sus orbes negros brillan.', version: 'legends-arceus' });
  });

  it('sigue las remisiones a otro juego', () => {
    const fields = new Map([
      ['escarlata', 'púrpura'],
      ['púrpura', 'Texto de Púrpura.'],
    ]);
    expect(pickWikidexText(fields)).toEqual({ text: 'Texto de Púrpura.', version: 'scarlet' });
  });

  it('usa la variante de España de {{n}} y {{NombreHaEs}}', () => {
    const fields = new Map([['escarlata', 'Llamas de hasta {{n|3,000|3000}} ºC. {{NombreHaEs|Nació ayer.|Nació antaño.}}']]);
    expect(pickWikidexText(fields)?.text).toBe('Llamas de hasta 3000 ºC. Nació antaño.');
  });

  it('con una viñeta por forma toma la primera, sin el rótulo', () => {
    const page = `{{Pokédex
| escarlata =
*'''Forma normal:''' Se protege con cristales.
*'''Forma astral:''' Otra cosa.
| púrpura = escarlata
}}`;
    expect(pickWikidexText(parseDexTemplate(page))).toEqual({ text: 'Se protege con cristales.', version: 'scarlet' });
  });

  it('salta el aviso de que una forma no tiene entrada en ese juego', () => {
    const page = `{{Pokédex
| leyendas Arceus = Texto de Hisui.
| escarlata = * '''Ursaluna:''' ''No hay entrada de Ursaluna en la Pokédex de Pokémon Escarlata''.
* '''Otra forma:''' Otra cosa.
}}`;
    expect(pickWikidexText(parseDexTemplate(page))).toEqual({ text: 'Texto de Hisui.', version: 'legends-arceus' });
  });

  it('descarta un texto con otra plantilla adentro', () => {
    expect(pickWikidexText(new Map([['escarlata', 'Texto con {{plantilla}}.']]))).toBeUndefined();
  });
});

describe('wikidexDexText', () => {
  it('una página que no existe no tiene texto', () => {
    expect(wikidexDexText({ error: { code: 'missingtitle', info: 'no existe' } })).toBeUndefined();
  });

  it('arma la URL de la API con la página codificada', () => {
    expect(wikidexUrl('Great Tusk')).toBe('https://www.wikidex.net/api.php?action=parse&page=Great+Tusk&prop=wikitext&redirects=1&format=json');
  });
});
