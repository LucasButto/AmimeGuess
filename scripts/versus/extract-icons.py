"""
Recorta las hojas de íconos pixel art del versus (Retro Battle) en archivos PNG individuales con fondo transparente.

Entradas (en docs/versus/, fuera de git):
  - "Hoja de iconos pixel art competitivos.png"  → 75 íconos
  - "AnimeGuess_Abecedario_Arcade.png"            → 28 avatares octogonales (A-Z, ! y ?)

Las dos hojas ya vienen con el fondo transparente (el verde croma se quitó antes): acá solo se separa cada ícono por componentes
conectados y se queda únicamente con los píxeles que le pertenecen (así un vecino que roza la caja no se cuela). No se estira
nada: se conserva la proporción, con un margen transparente parejo.

Salidas (public/img/versus/):
  icons/<nombre>.png         128 px del lado mayor (usos chicos y medianos)
  icons/<nombre>-lg.png      320 px del lado mayor (solo los grandes: VS, trofeo, podio, laureles, explosión…)
  alphabet/<letra>.png       128 px (a-z, exclamation, question)
  Más src/components/versus/avatarColors.ts con el color de cada avatar.

Uso:  python scripts/versus/extract-icons.py      (necesita Pillow, numpy y scipy)
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'docs', 'versus')
OUT = os.path.join(ROOT, 'public', 'img', 'versus')

ICON_ROWS = [
    'trophy laurel crown-gold crown-silver crown-bronze medal-gold medal-silver medal-bronze star star-small badge-star belt checkered-flag stopwatch hourglass',
    'podium laurel-wide versus lightning fire wind-blue explosion lightning-blue swoosh-blue sparkles heart heart-half heart-broken',
    'player players players-group avatar-l avatar-b avatar-c add-player swap arrow-up arrow-down sort edit trash lock unlock',
    'search question info warning alert check close loading wifi wifi-off gamepad key-a key-b key-c mouse settings',
    'play pause stop rewind forward refresh shuffle home arrow-left arrow-right undo enter share sound mute fullscreen',
]
LARGE = {'trophy', 'laurel', 'laurel-wide', 'crown-gold', 'crown-silver', 'crown-bronze', 'medal-gold', 'medal-silver', 'medal-bronze', 'star', 'badge-star', 'belt',
         'checkered-flag', 'stopwatch', 'podium', 'versus', 'lightning', 'fire', 'wind-blue', 'explosion', 'lightning-blue', 'swoosh-blue', 'sparkles', 'heart'}
LETTERS = [*'abcdefghijklmnopqrstuvwxyz', 'exclamation', 'question']


def components(path, merge_px, min_area, joins=()):
    """Devuelve la imagen RGBA y, por componente, (caja, máscara completa). `joins`: pares (fila, columna) 1-based a unir."""
    im = Image.open(path).convert('RGBA')
    rgba = np.array(im)
    mask = rgba[:, :, 3] > 40
    f = 3
    small = ndi.binary_dilation(mask[::f, ::f], structure=np.ones((3, 3)), iterations=max(1, merge_px // f))
    lab_small, _ = ndi.label(small)
    lab = np.kron(lab_small, np.ones((f, f), dtype=lab_small.dtype))[: mask.shape[0], : mask.shape[1]]
    lab = lab * mask  # solo los píxeles reales
    found = []
    for index, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None:
            continue
        region = lab[sl] == index
        if int(region.sum()) < min_area:
            continue
        found.append({'ids': {index}, 'box': (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)})
    return rgba, lab, found


def rows_of(items, rows):
    items = sorted(items, key=lambda it: (it['box'][1] + it['box'][3]) / 2)
    ys = [(it['box'][1] + it['box'][3]) / 2 for it in items]
    gaps = sorted(sorted(range(1, len(ys)), key=lambda i: ys[i] - ys[i - 1], reverse=True)[: rows - 1])
    cuts = [0, *gaps, len(items)]
    return [sorted(items[cuts[r]: cuts[r + 1]], key=lambda it: it['box'][0]) for r in range(rows)]


def merge(a, b):
    return {'ids': a['ids'] | b['ids'], 'box': (min(a['box'][0], b['box'][0]), min(a['box'][1], b['box'][1]), max(a['box'][2], b['box'][2]), max(a['box'][3], b['box'][3]))}


def crop(rgba, lab, item):
    x0, y0, x1, y1 = item['box']
    sub = rgba[y0:y1, x0:x1].copy()
    keep = np.isin(lab[y0:y1, x0:x1], list(item['ids']))
    sub[~keep] = 0
    return Image.fromarray(sub, 'RGBA')


def fit(img, side, pad=0.04):
    """Escala sin deformar para que el lado mayor mida `side` px, con un margen transparente parejo."""
    margin = max(1, round(side * pad))
    inner = side - 2 * margin
    scale = inner / max(img.size)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    resized = img.resize(size, Image.LANCZOS)
    canvas = Image.new('RGBA', (size[0] + 2 * margin, size[1] + 2 * margin), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (margin, margin))
    return canvas


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def main():
    # --- íconos
    rgba, lab, found = components(os.path.join(DOCS, 'Hoja de iconos pixel art competitivos.png'), 15, 2000)
    rows = rows_of(found, 5)
    # El ícono de pantalla completa (fila 5) son cuatro esquinas que la separación partió en dos: se unen.
    last = rows[4]
    if len(last) == 17:
        last[15:17] = [merge(last[15], last[16])]
    names = [name for line in ICON_ROWS for name in line.split()]
    flat = [it for row in rows for it in row]
    if len(flat) != len(names):
        sys.exit(f'Se esperaban {len(names)} íconos y se detectaron {len(flat)}: revisar la separación.')
    for name, item in zip(names, flat):
        img = crop(rgba, lab, item)
        save(fit(img, 128), os.path.join(OUT, 'icons', f'{name}.png'))
        if name in LARGE:
            save(fit(img, 320), os.path.join(OUT, 'icons', f'{name}-lg.png'))
    print(f'{len(names)} íconos')

    # --- abecedario
    rgba, lab, found = components(os.path.join(DOCS, 'AnimeGuess_Abecedario_Arcade.png'), 12, 2000)
    rows = rows_of(found, 4)
    flat = [it for row in rows for it in row]
    if len(flat) != len(LETTERS):
        sys.exit(f'Se esperaban {len(LETTERS)} letras y se detectaron {len(flat)}.')
    colors = {}
    for name, item in zip(LETTERS, flat):
        img = crop(rgba, lab, item)
        save(fit(img, 128, 0.02), os.path.join(OUT, 'alphabet', f'{name}.png'))
        # El color del avatar: el promedio de los píxeles más saturados (el cuerpo del octógono, sin el borde claro ni la letra).
        arr = np.array(img).astype(float)
        opaque = arr[arr[:, :, 3] > 200][:, :3]
        mx, mn = opaque.max(axis=1), opaque.min(axis=1)
        sat = (mx - mn) / np.maximum(mx, 1)
        lit = (mx > 120) & (sat >= np.percentile(sat, 50))
        body = opaque[lit] if lit.sum() > 50 else opaque[sat >= np.percentile(sat, 55)]
        r, g, b = body.mean(axis=0)
        colors[name] = '#%02x%02x%02x' % (int(r), int(g), int(b))
    lines = ',\n'.join(f"  {name if name.isalpha() and len(name) == 1 else repr(name)}: '{value}'" for name, value in colors.items())
    ts = (
        "// Generado por scripts/versus/extract-icons.py: el color de cada avatar del abecedario arcade (A-Z, ! y ?).\n"
        "export const AVATAR_COLORS: Readonly<Record<string, string>> = {\n" + lines + ',\n};\n'
    )
    with open(os.path.join(ROOT, 'src', 'components', 'versus', 'avatarColors.ts'), 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(ts)
    print(f'{len(LETTERS)} avatares')


if __name__ == '__main__':
    main()
