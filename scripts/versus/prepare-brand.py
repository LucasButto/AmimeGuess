"""
Prepara los logos y los fondos de Retro Battle (el versus) a partir de los originales de data/versus/source/:

  logo-versus.webp        → public/img/versus/logo/versus.webp          (solo "VERSUS", recortado al contenido)
  logo-animeguess.webp    → public/img/versus/logo/animeguess.webp      (solo "AnimeGuess")
  logo-completo.webp      → public/img/versus/logo/versus-full.webp     (logo con alas, ráfaga y lema "Desafiá a tus amigos")
  fondo-escritorio.webp   → public/img/versus/backgrounds/arena-desktop.webp
  fondo-movil.webp        → public/img/versus/backgrounds/arena-mobile.webp

Los logos ya vienen con fondo transparente: solo se recortan al contenido (margen parejo). Los fondos se copian sin tocar los
píxeles (se muestran con `image-rendering: pixelated`). Uso:  python scripts/versus/prepare-brand.py   (necesita Pillow)
"""
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'data', 'versus', 'source')
OUT = os.path.join(ROOT, 'public', 'img', 'versus')

LOGOS = {
    'logo-versus.webp': 'logo/versus.webp',
    'logo-animeguess.webp': 'logo/animeguess.webp',
    'logo-completo.webp': 'logo/versus-full.webp',
}
BACKGROUNDS = {
    'fondo-escritorio.webp': 'backgrounds/arena-desktop.webp',
    'fondo-movil.webp': 'backgrounds/arena-mobile.webp',
}


def save(img, rel, lossless=False):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', lossless=lossless, quality=92, alpha_quality=100, method=6)
    print(rel, img.size, os.path.getsize(path) // 1024, 'KB')


def main():
    for name, rel in LOGOS.items():
        img = Image.open(os.path.join(SRC, name)).convert('RGBA')
        box = img.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        img = img.crop(box) if box else img
        pad = max(4, round(max(img.size) * 0.01))
        canvas = Image.new('RGBA', (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        canvas.alpha_composite(img, (pad, pad))
        save(canvas, rel)
    for name, rel in BACKGROUNDS.items():
        save(Image.open(os.path.join(SRC, name)).convert('RGB'), rel)


if __name__ == '__main__':
    main()
