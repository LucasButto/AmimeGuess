"""
Recorta la hoja de íconos de los modos de juego del versus (4 x 4, fondo transparente) en PNG individuales.

Entrada:  data/versus/source/iconos-modos.webp  (aportada por el usuario el 2026-11-13; origen y licencia: a confirmar)
Salidas:  public/img/versus/modes/<nombre>.png      128 px del lado mayor
          public/img/versus/modes/<nombre>-lg.png   320 px del lado mayor

Cada ícono se queda solo con los componentes conectados cuyo centro cae en su celda (así un vecino que roza no se cuela).
No se estira nada: se conserva la proporción, centrado en un lienzo cuadrado transparente.

Uso:  python scripts/versus/extract-mode-icons.py      (necesita Pillow, numpy y scipy)
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'data', 'versus', 'source', 'iconos-modos.webp')
OUT = os.path.join(ROOT, 'public', 'img', 'versus', 'modes')

NAMES = [
    ['classic', 'silhouette', 'description', 'card'],
    ['higher-lower', 'stats', 'quote', 'blur'],
    ['technique', 'transformation', 'timeline', 'moveset'],
    ['jutsu', 'eye', 'team', 'connections'],
]
SIZES = {'': 128, '-lg': 320}


def main() -> None:
    rgba = np.array(Image.open(SRC).convert('RGBA'))
    # Lo casi transparente (halo del recorte) se descarta.
    rgba[rgba[:, :, 3] < 24] = 0
    mask = rgba[:, :, 3] > 0
    height, width = mask.shape
    labels, count = ndi.label(mask, structure=np.ones((3, 3)))
    centers = ndi.center_of_mass(mask, labels, range(1, count + 1))
    sizes = ndi.sum(mask, labels, range(1, count + 1))
    os.makedirs(OUT, exist_ok=True)
    for row, names in enumerate(NAMES):
        for col, name in enumerate(names):
            y0, y1 = row * height / 4, (row + 1) * height / 4
            x0, x1 = col * width / 4, (col + 1) * width / 4
            keep = [index + 1 for index, (cy, cx) in enumerate(centers) if sizes[index] >= 12 and y0 <= cy < y1 and x0 <= cx < x1]
            own = np.isin(labels, keep)
            ys, xs = np.nonzero(own)
            box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
            icon = rgba.copy()
            icon[~own] = 0
            crop = Image.fromarray(icon).crop(box)
            side = max(crop.size)
            pad = round(side * 0.04)
            canvas = Image.new('RGBA', (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
            canvas.paste(crop, (pad + (side - crop.width) // 2, pad + (side - crop.height) // 2))
            for suffix, size in SIZES.items():
                canvas.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'{name}{suffix}.png'), optimize=True)
            print(name, box)


if __name__ == '__main__':
    main()
