#!/usr/bin/env python3
"""A painted tile into the 3D world's texture folder (docs/WORLD_3D_SPEC.md §1.7, tools/world3d/TEXTURES.md).

    python3 tools/world3d/tile.py <image> <kit> <name> [--strength 1.8] [--size 1024] [--no-normal] [--atlas]

Reads the image GPT painted (png / jpg / webp), squares and resizes it, makes the seams meet (a soft cross-fade over the
last 6 % of each edge, so a tile that nearly tiles tiles), writes `public/assets/world3d/tex/<kit>/<name>.webp` (quality
82) and its normal map `<name>_n.webp` (a Sobel of the tile's luminance, `--strength` as TEXTURES.md lists it), and a
2 × 2 preview `/tmp/claude-0/tiles/<kit>_<name>_2x2.jpg` to look at before trusting it. `--atlas` keeps transparency
and skips the seam blend and the normal map (leaf / flower / wisteria atlases on transparency).
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

def seam(img: Image.Image, k: float = 0.06) -> Image.Image:
    """Cross-fade the tile's opposite edges into each other so the wrap has no seam."""
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    h, w = a.shape[:2]; bw, bh = int(w * k), int(h * k)
    out = a.copy()
    # horizontal wrap: blend the left band with the pixels that will meet it (the right band, mirrored in position)
    for i in range(bw):
        t = 0.5 * (1 - i / bw)  # 0.5 at the very edge → 0 at the band's inner side
        out[:, i] = a[:, i] * (1 - t) + a[:, w - bw + i] * t
        out[:, w - 1 - i] = a[:, w - 1 - i] * (1 - t) + a[:, bw - 1 - i] * t
    a = out.copy()
    for j in range(bh):
        t = 0.5 * (1 - j / bh)
        out[j] = a[j] * (1 - t) + a[h - bh + j] * t
        out[h - 1 - j] = a[h - 1 - j] * (1 - t) + a[bh - 1 - j] * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def normal_map(img: Image.Image, strength: float) -> Image.Image:
    """A tangent-space normal map from the tile's luminance (Sobel), wrapping at the edges."""
    g = np.asarray(img.convert('L').filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0
    dx = (np.roll(g, -1, axis=1) - np.roll(g, 1, axis=1)) * 0.5
    dy = (np.roll(g, -1, axis=0) - np.roll(g, 1, axis=0)) * 0.5
    nx, ny, nz = -dx * strength * 4, dy * strength * 4, np.ones_like(g)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([(nx / n) * 0.5 + 0.5, (ny / n) * 0.5 + 0.5, (nz / n) * 0.5 + 0.5], axis=-1)
    return Image.fromarray((rgb * 255).astype(np.uint8))

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('image'); ap.add_argument('kit'); ap.add_argument('name')
    ap.add_argument('--strength', type=float, default=1.8); ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--no-normal', action='store_true'); ap.add_argument('--atlas', action='store_true')
    a = ap.parse_args()
    img = Image.open(a.image)
    if a.atlas:
        img = img.convert('RGBA').resize((a.size, a.size), Image.LANCZOS)
    else:
        img = img.convert('RGB')
        s = min(img.size); img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width - s) // 2 + s, (img.height - s) // 2 + s)).resize((a.size, a.size), Image.LANCZOS)
        img = seam(img)
    out_dir = os.path.join(ROOT, 'public', 'assets', 'world3d', 'tex', a.kit); os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, f'{a.name}.webp'), 'WEBP', quality=82, method=6)
    if not a.atlas and not a.no_normal:
        normal_map(img, a.strength).save(os.path.join(out_dir, f'{a.name}_n.webp'), 'WEBP', quality=88, method=6)
    prev_dir = '/tmp/claude-0/tiles'; os.makedirs(prev_dir, exist_ok=True)
    q = img.convert('RGB').resize((a.size // 2, a.size // 2)); grid = Image.new('RGB', (a.size, a.size))
    for i in range(2):
        for j in range(2): grid.paste(q, (i * a.size // 2, j * a.size // 2))
    grid.save(os.path.join(prev_dir, f'{a.kit}_{a.name}_2x2.jpg'), quality=85)
    print('wrote', os.path.join(out_dir, f'{a.name}.webp'), '(+ _n)' if not a.atlas and not a.no_normal else '', 'preview', os.path.join(prev_dir, f'{a.kit}_{a.name}_2x2.jpg'))
    return 0

if __name__ == '__main__':
    sys.exit(main())
