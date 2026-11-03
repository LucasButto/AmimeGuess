"""python scripts/design/recortar-iconos.py [pokemon|naruto|dragon-ball|yugioh|jeroglificos|bolas ...]

Recorta las hojas de iconos que aportó el usuario (data-src/<serie>/icons/): un archivo WebP con fondo transparente por icono.

Dos modos:
  color  fondo liso (crema o celeste): el fondo es lo conectado con el borde de la hoja y parecido al color del fondo; en el
         borde del dibujo se despega la mezcla con el fondo (color + alfa), así no queda halo claro.
  glifo  jeroglíficos oscuros sobre pergamino: alfa por luminosidad.
"""
import sys, os, json
import numpy as np
from PIL import Image
from collections import deque

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'
BASE = ROOT + 'data-src/'

POKEMON = ['pokedex', 'pokedex-plegable', 'rotom-dex', 'rotom-telefono', 'pokedex-portatil', 'pokereloj',
           'bicicleta', 'cana-de-pescar', 'flauta', 'prismaticos', 'comunicador', 'mochila',
           'caramelo-raro', 'pulverizador', 'cristal-amarillo', 'cuerda-huida', 'baya-azul', 'clefairy',
           'piedra-fuego', 'piedra-agua', 'piedra-trueno', 'piedra-hoja', 'piedra-lunar', 'corona',
           'huevo', 'fosil-espiral', 'fosil-domo', 'ambar', 'pluma-arcoiris', 'pluma-plateada',
           'pulsera-z', 'emblema-z', 'banda-dinamax', 'orbe-tera', 'gema-gris', 'flor-arcoiris']
NARUTO = ['pergamino-abierto', 'pergamino-cerrado', 'kunai', 'kunai-trifurcado', 'shuriken', 'fuma-shuriken',
          'senbon', 'nota-explosiva', 'bomba-humo', 'tronco', 'bolsa-ninja', 'cuchillas-anillo',
          'banda-konoha', 'banda-suna', 'banda-kiri', 'banda-kumo', 'banda-iwa', 'banda-oto',
          'banda-konoha-tachada', 'nube-akatsuki', 'mascara-anbu', 'mascara-tobi', 'mascara-blanca', 'calabaza-arena',
          'abanico', 'arma-vendada', 'katana', 'cascabeles', 'libro-icha-icha', 'ramen',
          'rasengan', 'chidori', 'sharingan', 'rinnegan', 'byakugan', 'abanico-uchiha']
DRAGONBALL = ['esfera-1', 'esfera-2', 'esfera-3', 'esfera-4', 'esfera-5', 'esfera-6',
              'esfera-7', 'radar-del-dragon', 'nube-voladora', 'baston-de-poder', 'bolsa-zeni', 'semilla-del-ermitano',
              'botella-roja', 'botella-azul', 'logo-capsule-corp', 'caparazon-de-tortuga', 'gafas-de-sol', 'gi-de-tortuga',
              'scouter', 'armadura-saiyan', 'nave-esferica', 'pendientes-potara', 'nave-pequena', 'espada-purpura',
              'casa-kame', 'shenlong', 'porunga', 'nave-freezer', 'lazo-red-ribbon', 'moto-bulma',
              'espada-cristal', 'abanico-bashosen', 'tarro-sellado', 'templo-de-kami', 'baston-azul', 'control-remoto']
YUGIOH = ['puzzle-del-milenio', 'ojo-del-milenio', 'anillo-del-milenio', 'baston-del-milenio', 'collar-del-milenio', 'balanza-del-milenio',
          'llave-del-milenio', 'duel-disk', 'duel-disk-azul', 'mazo', 'cartas-en-abanico', 'carta-monstruo',
          'carta-magica', 'carta-trampa', 'carta-reverso', 'dragon-blanco-ojos-azules', 'dragon-negro-ojos-rojos', 'kuriboh',
          'sombrero-mago-oscuro', 'baston-mago-oscuro', 'cuerno-azul', 'exodia', 'esqueleto-demonio', 'mago-del-tiempo',
          'olla-de-la-codicia', 'talisman-alado', 'espadas-de-luz', 'espejo-de-fuerza', 'remolino', 'libro-magico',
          'slifer', 'obelisco', 'ra', 'tablilla', 'estrellas', 'maletin']
JEROGLIFICOS = ['ankh', 'ojo-de-horus', 'escarabajo-alado', 'halcon', 'ibis', 'cobra',
                'faraon-sentado', 'loto', 'sol', 'cetro-y-gancho', 'cartucho', 'piramides',
                'esfinge', 'pluma-de-maat', 'escarabajo', 'papiro', 'anubis', 'gato-bastet',
                'barca', 'mano', 'vara', 'arpa', 'vasija', 'serpiente',
                'pajaro', 'toro', 'carnero', 'leon', 'escriba', 'ofrenda',
                'isis', 'djed', 'cayado', 'boca', 'agua', 'plumas-dobles']
# Las 38 Poké Balls de la hoja anterior (las que no se reconocen llevan su fila y columna).
BOLAS = {(1, 1): 'poke', (1, 2): 'super', (1, 3): 'ultra', (1, 4): 'master', (1, 5): 'safari', (1, 6): 'rapida',
         (2, 1): 'nivel', (2, 2): 'cebo', (2, 3): 'pesada', (2, 4): 'amor', (2, 5): 'amistad', (2, 6): 'luna',
         (3, 2): 'premier', (4, 1): 'buceo', (4, 2): 'lujo', (4, 3): 'sanadora', (4, 4): 'ocaso', (4, 5): 'veloz', (4, 6): 'cronometro'}

SHEETS = [
    ('pokemon/icons/hoja-objetos.webp', 'pokemon', POKEMON, 'color', 'icons/pokemon/', 'objetos'),
    ('naruto/icons/hoja-objetos.webp', 'naruto', NARUTO, 'color', 'icons/naruto/', 'objetos'),
    ('dragon-ball/icons/hoja-objetos.webp', 'dragon-ball', DRAGONBALL, 'color', 'icons/dragon-ball/', 'objetos'),
    ('yugioh/icons/hoja-objetos.webp', 'yugioh', YUGIOH, 'color', 'icons/yugioh/', 'objetos'),
    ('yugioh/icons/hoja-jeroglificos.webp', 'yugioh', JEROGLIFICOS, 'glifo', 'icons/yugioh/jeroglificos/', 'jeroglificos'),
]


def dilate(m, n=1):
    for _ in range(n):
        d = m.copy()
        d[1:, :] |= m[:-1, :]; d[:-1, :] |= m[1:, :]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
        d[1:, 1:] |= m[:-1, :-1]; d[:-1, :-1] |= m[1:, 1:]; d[1:, :-1] |= m[:-1, 1:]; d[:-1, 1:] |= m[1:, :-1]
        m = d
    return m


def flood(passable):
    h, w = passable.shape
    out = np.zeros((h, w), bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not out[y, x]: out[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not out[y, x]: out[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; dq.append((ny, nx))
    return out


def alpha_color(a, tol, band=2, hole_tol=6):
    """RGBA de una hoja de fondo liso."""
    h, w, _ = a.shape
    edge = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    D = np.abs(a - bg).max(axis=2)
    outside = flood(D < tol)
    # Huecos encerrados (el aire entre los cordones, el lazo de la caña): pedazos del color exacto del fondo, más grandes que
    # una mota. Lo claro del dibujo (blancos, cremas) se aparta del fondo por más de `hole_tol`, así que no se toca.
    inner = (D < 16) & ~outside
    seen = np.zeros((h, w), bool)
    holes = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.where(inner)):
        if seen[y0, x0]: continue
        seen[y0, x0] = True
        dq = deque([(y0, x0)]); pts = [(y0, x0)]
        while dq:
            y, x = dq.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and inner[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; dq.append((ny, nx)); pts.append((ny, nx))
        # Un hueco de verdad tiene mucho píxel clavado en el color del fondo (el ruido de la hoja lo salpica de claros apenas distintos).
        if hole_tol > 0 and len(pts) >= 40 and sum(D[q] < hole_tol for q in pts) >= 0.3 * len(pts):
            for q in pts: holes[q] = True
    outside = outside | holes
    near = dilate(outside, band)
    bandpx = near & ~outside
    # Borde: cada píxel de mezcla toma el color del trazo más fuerte que tenga cerca (el contorno) y su opacidad es cuánto
    # se aparta del fondo en proporción a ese trazo: sin halo claro y sin comer el contorno.
    bestD = np.where(outside, -1, D).astype(float)
    bestC = a.astype(float).copy()
    for dy in range(-band, band + 1):
        for dx in range(-band, band + 1):
            if dy == 0 and dx == 0: continue
            shD = np.roll(np.roll(np.where(outside, -1, D), dy, 0), dx, 1)
            shC = np.roll(np.roll(a, dy, 0), dx, 1)
            better = shD > bestD
            bestD = np.where(better, shD, bestD)
            bestC = np.where(better[..., None], shC, bestC)
    mix = bandpx & (bestD >= 60)
    alpha = np.ones((h, w))
    alpha[outside] = 0
    alpha[mix] = np.clip(D[mix] / bestD[mix], 0, 1)
    rgb = a.astype(float).copy()
    rgb[mix] = bestC[mix]
    return np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), ~outside


def alpha_glyph(a):
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    alpha = np.clip((170 - L) / (170 - 100), 0, 1)
    rgb = np.zeros(a.shape, np.uint8); rgb[...] = (48, 33, 25)
    return np.dstack([rgb, (alpha * 255).astype(np.uint8)]), alpha > 0.25


def runs(v, gap, minlen):
    out, start = [], None
    for i, on in enumerate(v):
        if on and start is None: start = i
        if not on and start is not None: out.append([start, i - 1]); start = None
    if start is not None: out.append([start, len(v) - 1])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] <= gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] >= minlen]


def touches(lab, a, b, ba, bb, reach=18):
    """¿Algún píxel de la pieza `a` está a menos de `reach` px de la pieza `b`? (por píxel, no por caja: un bastón en diagonal
    tiene una caja enorme y vacía)"""
    y0 = max(min(ba[0], bb[0]) - reach, 0); y1 = max(ba[1], bb[1]) + reach + 1
    x0 = max(min(ba[2], bb[2]) - reach, 0); x1 = max(ba[3], bb[3]) + reach + 1
    sub = lab[y0:y1, x0:x1]
    return bool((dilate(sub == a, reach) & (sub == b)).any())


def run(src, series, names, mode, outdir, tag, ncols=6, extra=None):
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    if mode == 'glifo':
        rgba, fg = alpha_glyph(a)
    else:
        rgba, fg = alpha_color(a, tol=extra.get('tol', 34) if extra else 34, hole_tol=extra.get('hole', 6) if extra else 6)
    H, W = fg.shape
    cell = W / ncols
    # Componentes de lo que no es fondo (unidos con un margen de 6 px: las piezas sueltas de un icono van juntas); cada una
    # se asigna a la celda de la grilla donde cae su centro.
    grown = dilate(fg, 2)
    lab = np.zeros((H, W), np.int32)
    comps = []
    for y0 in range(H):
        for x0 in np.flatnonzero(grown[y0] & (lab[y0] == 0)):
            if lab[y0, x0]: continue
            n = len(comps) + 1
            lab[y0, x0] = n
            dq = deque([(y0, x0)]); pts = [(y0, x0)]
            while dq:
                y, x = dq.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and grown[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; dq.append((ny, nx)); pts.append((ny, nx))
            comps.append(pts)
    cells = {}
    boxes = []
    for pts in comps:
        ys = [q[0] for q in pts]; xs = [q[1] for q in pts]
        boxes.append((min(ys), max(ys), min(xs), max(xs), len(pts)))
    order = sorted(range(len(boxes)), key=lambda i: -boxes[i][4])
    root = {}
    for i in order:
        y0, y1, x0, x1, n = boxes[i]
        root[i] = i
        # Una pieza se une a la más grande que tenga a menos de 18 px (las olas de la barca, el destello suelto de un
        # icono): así sigue a su icono aunque su centro caiga en la celda de al lado.
        for j in order:
            if j == i or boxes[j][4] * 0.35 <= n: continue
            by0, by1, bx0, bx1, _ = boxes[j]
            dy = max(by0 - y1, y0 - by1, 0); dx = max(bx0 - x1, x0 - bx1, 0)
            if (dy * dy + dx * dx) ** 0.5 <= 18 and touches(lab, i + 1, j + 1, (y0, y1, x0, x1), (by0, by1, bx0, bx1)):
                # Si cae en otra celda que el icono grande, tiene que estar pegada al borde que comparten (la ola que se
                # derrama a la celda de abajo); un icono entero dentro de su propia celda (un bastón fino) no se une a nadie.
                own = (int(((y0 + y1) / 2) // cell), int(((x0 + x1) / 2) // cell))
                par = (int(((by0 + by1) / 2) // cell), int(((bx0 + bx1) / 2) // cell))
                if own != par:
                    near_edge = (par[0] < own[0] and y0 - own[0] * cell < 25) or (par[0] > own[0] and (own[0] + 1) * cell - y1 < 25)                         or (par[1] < own[1] and x0 - own[1] * cell < 25) or (par[1] > own[1] and (own[1] + 1) * cell - x1 < 25)
                    if not near_edge: continue
                root[i] = root[j]
                break
    for i in order:
        y0, y1, x0, x1, n = boxes[root[i]]
        if root[i] == i and n < 40: continue
        cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
        cells.setdefault((int(cy // cell), int(cx // cell)), []).append(i + 1)
    print(tag, 'celdas', len(cells), 'componentes', len(comps))
    os.makedirs(ROOT + 'public/' + outdir, exist_ok=True)
    big = Image.fromarray(rgba, 'RGBA')
    count = 0
    for (ri, ci), ids in sorted(cells.items()):
        idx = ri * ncols + ci
        if idx >= len(names): continue
        mask = np.isin(lab, ids) & fg
        ys, xs = np.where(mask)
        by0, by1, bx0, bx1 = ys.min(), ys.max(), xs.min(), xs.max()
        w, h = bx1 - bx0 + 1, by1 - by0 + 1
        side = max(w, h) + 8
        piece = rgba[by0:by1 + 1, bx0:bx1 + 1].copy()
        piece[..., 3] = np.where(mask[by0:by1 + 1, bx0:bx1 + 1], piece[..., 3], 0)
        tile = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        tile.alpha_composite(Image.fromarray(piece, 'RGBA'), ((side - w) // 2, (side - h) // 2))
        tile.save(ROOT + 'public/' + outdir + names[idx] + '.webp', lossless=True, method=6)
        count += 1
    print(tag, 'iconos', count)

def tronco_boton():
    """El tronco acostado y alargado del botón Inicio de Naruto (public/theme/naruto/tronco-boton.webp): el ícono del tronco
    girado un cuarto de vuelta, sin las hojas de abajo y con el tramo del medio estirado a lo largo de la veta (2,4 veces):
    los extremos (la punta redondeada y el corte con anillos) no se tocan, así el contorno empalma sin saltos."""
    r = Image.open(ROOT + 'public/icons/naruto/tronco.webp').convert('RGBA').rotate(-90, expand=True)
    rows = (15, 141)
    h = rows[1] - rows[0]
    parts = [r.crop((4, rows[0], 30, rows[1])), r.crop((30, rows[0], 120, rows[1])).resize((216, h), Image.LANCZOS), r.crop((120, rows[0], 206, rows[1]))]
    out = Image.new('RGBA', (sum(p.width for p in parts), h), (0, 0, 0, 0))
    x = 0
    for part in parts:
        out.alpha_composite(part, (x, 0)); x += part.width
    out.save(ROOT + 'public/theme/naruto/tronco-boton.webp', lossless=True, method=6)
    print('tronco-boton', out.size)



if __name__ == '__main__':
    which = sys.argv[1:] or ['pokemon', 'naruto', 'dragon-ball', 'yugioh', 'jeroglificos', 'bolas', 'tronco']
    for f, series, names, mode, outdir, label in SHEETS:
        key = 'jeroglificos' if label == 'jeroglificos' else series
        if key in which:
            run(BASE + f, series, names, mode, outdir, series + ':' + label)
    if 'bolas' in which:
        # Las 38 Poké Balls de la hoja de bolas (sin quitar huecos: el celeste del fondo se parece al de las bolas de agua).
        names = [BOLAS.get((i // 6 + 1, i % 6 + 1), f'bola-f{i // 6 + 1}c{i % 6 + 1}') for i in range(38)]
        run(BASE + 'pokemon/icons/hoja-pokebolas.webp', 'pokemon', names, 'color', 'icons/pokemon/pokebolas/', 'bolas', extra={'hole': 0})
    if 'tronco' in which:
        tronco_boton()
