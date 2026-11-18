"""GOD OF LEGACY — REBORN: the arena's and the Samurai's runtime textures (made here; run with Python 3 + Pillow +
numpy, outputs committed). Written as WebP bytes in *.webp.bin files, which Godot does not import: the game decodes
them itself (scripts/util/tex_loader.gd) and builds their mipmaps, so their look and download size stay ours.
Usage: python3 make_textures.py <samurai dir with *_albedo_src.webp> <out env dir>"""
import io
import sys

import numpy as np
from PIL import Image

SRC, ENV = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(11)


def save(img, path, q=88):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=q, method=6)
    open(path, 'wb').write(b.getvalue())
    print(path, img.size, len(b.getvalue()) // 1024, 'KB')


def value_noise(n, cells, seed):
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    x = np.linspace(0, cells, n, endpoint=False)
    i0 = np.floor(x).astype(int)
    f = x - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
    b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
    return a * (1 - f)[:, None] + b * f[:, None]


def fbm(n, base, octaves, seed):
    out = np.zeros((n, n))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += value_noise(n, base * 2 ** o, seed + o) * amp
        tot += amp
        amp *= 0.5
    return out / tot


def flagstones(n=1024, grid=7):
    """Irregular, worn flagstones (a jittered-grid Voronoi, tileable) with dark mortar and moss in the joints."""
    pts = (np.stack(np.meshgrid(np.arange(grid), np.arange(grid), indexing='ij'), -1)
           + 0.15 + 0.7 * rng.random((grid, grid, 2))) / grid
    tint = rng.random((grid, grid))
    yy, xx = np.meshgrid(np.arange(n) / n, np.arange(n) / n, indexing='ij')
    f1 = np.full((n, n), 9.0)
    f2 = np.full((n, n), 9.0)
    cid = np.zeros((n, n))
    ci = np.floor(yy * grid).astype(int)
    cj = np.floor(xx * grid).astype(int)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            gi = ci + di
            gj = cj + dj
            p = pts[gi % grid, gj % grid]
            py = p[..., 0] + np.floor_divide(gi, grid)
            px = p[..., 1] + np.floor_divide(gj, grid)
            d = np.hypot(yy - py, xx - px)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            cid = np.where(closer, tint[gi % grid, gj % grid], cid)
            f1 = np.where(closer, d, f1)
    edge = (f2 - f1) * grid
    grain = fbm(n, 8, 5, 3)
    wear = fbm(n, 4, 4, 9)
    mortar = np.clip((0.09 - edge) / 0.05, 0, 1)
    bevel = np.clip((0.22 - edge) / 0.13, 0, 1) * (1 - mortar)
    base = np.stack([0.50 + 0.10 * cid, 0.47 + 0.08 * cid, 0.42 + 0.06 * cid], -1)
    col = base * (0.78 + 0.34 * grain[..., None]) * (0.9 + 0.12 * wear[..., None])
    col = col * (1 - 0.32 * bevel[..., None])
    moss = np.clip((fbm(n, 6, 4, 21) - 0.45) * 3.0, 0, 1) * mortar
    mortar_col = np.array([0.16, 0.15, 0.13]) * (0.8 + 0.4 * grain[..., None])
    moss_col = np.array([0.25, 0.33, 0.16]) * (0.7 + 0.5 * grain[..., None])
    col = col * (1 - mortar[..., None]) + mortar_col * mortar[..., None]
    col = col * (1 - moss[..., None]) + moss_col * moss[..., None]
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


def wall_blocks(n=512, rows=6, cols=3):
    """Weathered ashlar blocks in offset courses (tileable), for the ruins' walls, pillars and steps."""
    yy, xx = np.meshgrid(np.arange(n) / n, np.arange(n) / n, indexing='ij')
    r = np.floor(yy * rows)
    off = (r % 2) * 0.5 / cols
    u = (xx + off) * cols
    c = np.floor(u)
    fy = yy * rows - r
    fx = u - c
    jy = np.minimum(fy, 1 - fy) * n / rows
    jx = np.minimum(fx, 1 - fx) * n / cols
    mortar = np.clip((3.0 - np.minimum(jy, jx)) / 2.0, 0, 1)
    rand = np.random.default_rng(5).random((rows, cols + 1))
    t = rand[r.astype(int) % rows, c.astype(int) % (cols + 1)]
    grain = fbm(n, 8, 5, 31)
    chips = np.clip((fbm(n, 16, 3, 41) - 0.62) * 4, 0, 1)
    base = np.stack([0.56 + 0.08 * t, 0.53 + 0.07 * t, 0.48 + 0.05 * t], -1) * (0.75 + 0.35 * grain[..., None])
    base = base * (1 - 0.25 * chips[..., None])
    col = base * (1 - mortar[..., None]) + np.array([0.2, 0.19, 0.17]) * mortar[..., None]
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


def earth(n=512):
    g = fbm(n, 6, 5, 61)
    m = fbm(n, 3, 3, 71)
    col = np.stack([0.20 + 0.10 * g, 0.22 + 0.10 * g, 0.13 + 0.05 * g], -1)
    col = col * (1 - 0.4 * m[..., None]) + np.array([0.17, 0.14, 0.10]) * 0.4 * m[..., None]
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


save(flagstones(), ENV + '/flagstones.webp.bin', 86)
save(wall_blocks(), ENV + '/wall_blocks.webp.bin', 86)
save(earth(), ENV + '/earth.webp.bin', 82)
sam = Image.open(SRC + '/samurai_albedo_src.webp').convert('RGB').resize((1024, 1024), Image.LANCZOS)
save(sam, SRC + '/samurai_albedo.webp.bin', 90)
kat = Image.open(SRC + '/katana_albedo_src.webp').convert('RGB')
save(kat, SRC + '/katana_albedo.webp.bin', 90)
