"""GOD OF LEGACY — REBORN: the arena's and the Samurai's runtime textures (made here; run with Python 3 + Pillow +
numpy, outputs committed). Written as WebP bytes in *.webp.bin files, which Godot does not import: the game decodes
them itself (scripts/util/tex_loader.gd) and builds their mipmaps, so their look and download size stay ours.
Usage: python3 make_textures.py <samurai dir with *_albedo_src.webp> <out env dir> [samurai region mask png]
The Samurai's atlas is recoloured to GPT's REBORN look (direction v1.1 / M1 review): dark charcoal armour, muted
crimson details, restrained gold, silver-ivory hair with a slight lavender undertone; the face and eyes are kept.
The region mask (R hair, G eyes, B face, in the atlas's layout) is the old project's spirit_samurai_ns_mask.png."""
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
    """Irregular, worn flagstones (a jittered-grid Voronoi, tileable) with mortar and moss in the joints. Kept low in
    contrast (M3, GPT: the floor must not compete with the fighters and their strikes)."""
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
    col = base * (0.86 + 0.2 * grain[..., None]) * (0.92 + 0.08 * wear[..., None])
    col = col * (1 - 0.16 * bevel[..., None])
    moss = np.clip((fbm(n, 6, 4, 21) - 0.45) * 3.0, 0, 1) * mortar
    mortar_col = np.array([0.3, 0.285, 0.26]) * (0.85 + 0.3 * grain[..., None])
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


def lacquer_wood(n=512):
    """Dark lacquered wood for the Training Automaton (GPT v1.2): a mahogany red-brown, dark but readable under the
    courtyard's moonlight, with clear wavy grain along the texture's vertical (darker late-wood lines, paler streaks)
    and a few knots; tileable. (M4 first pass was too dark to read as wood: its grain vanished.)"""
    yy, xx = np.meshgrid(np.arange(n) / n, np.arange(n) / n, indexing='ij')
    warp = fbm(n, 3, 3, 81) - 0.5
    rings = 0.5 + 0.5 * np.sin(2 * np.pi * (xx * 14 + warp * 2.2 + (fbm(n, 6, 2, 83) - 0.5) * 0.7))
    late = rings ** 4 # the dark late-wood lines
    streak = np.clip((fbm(n, 4, 3, 89) - 0.45) * 2.0, 0, 1)
    fine = fbm(n, 40, 2, 85)
    knots = np.clip((fbm(n, 5, 3, 87) - 0.66) * 4, 0, 1)
    pale = np.array([0.50, 0.27, 0.16])
    dark = np.array([0.20, 0.09, 0.055])
    k = np.clip(0.55 * late + 0.25 * (1 - streak) + 0.2 * fine + 0.45 * knots, 0, 1)[..., None]
    col = pale * (1 - k) + dark * k
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


save(flagstones(), ENV + '/flagstones.webp.bin', 86)
save(wall_blocks(), ENV + '/wall_blocks.webp.bin', 86)
save(earth(), ENV + '/earth.webp.bin', 82)
save(lacquer_wood(), ENV + '/../characters/automaton/wood_albedo.webp.bin', 88)
def _sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _hsv(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mx = img.max(-1)
    d = mx - img.min(-1)
    e = 1e-6
    h = np.where(mx == r, ((g - b) / (d + e)) % 6, np.where(mx == g, (b - r) / (d + e) + 2, (r - g) / (d + e) + 4))
    h = np.where(d < e, 0, h * 60.0) % 360
    return h, np.where(mx > e, d / (mx + e), 0), mx


def _rgb(h, s, v):
    h = (h % 360) / 60.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m, 0], out[m, 1], out[m, 2] = a[m], b[m], c[m]
    return out


def samurai_look(img, mask):
    """Soft colour classes (no hard edges between them): gold trim, red details, pale cloth, the rest armour; the
    hair from the mask; the face and eyes untouched."""
    a = np.asarray(img).astype(np.float32) / 255.0
    h, s, v = _hsv(a)
    hd = lambda c: np.minimum(np.abs(h - c) % 360, 360 - np.abs(h - c) % 360)
    full = lambda x: np.full_like(h, x)
    w_gold = (1 - _sstep(18, 32, hd(42))) * _sstep(0.2, 0.38, s) * _sstep(0.25, 0.45, v)
    w_red = (1 - _sstep(16, 34, hd(348))) * _sstep(0.28, 0.45, s)
    w_pale = _sstep(0.58, 0.78, v) * (1 - _sstep(0.28, 0.5, s)) * (1 - w_gold)
    w_arm = np.clip(1 - w_gold - w_red - w_pale, 0, 1)
    gold = _rgb(full(41), np.minimum(s * 0.85, 0.62), np.minimum(v * 0.92, 0.86))
    red = _rgb(full(348), np.minimum(s * 0.6, 0.5), np.minimum(v * 0.7, 0.58))
    pale = _rgb(full(35), full(0.07), 0.45 + 0.35 * v)
    arm = _rgb(full(255), 0.05 + 0.08 * s, np.minimum(0.07 + 0.42 * v ** 1.15, 0.48))
    tot = (w_gold + w_red + w_pale + w_arm + 1e-6)[..., None]
    out = (gold * w_gold[..., None] + red * w_red[..., None] + pale * w_pale[..., None] + arm * w_arm[..., None]) / tot
    # the surface map (glTF order: R occlusion, G roughness, B metallic): metallic gold trim, satin armour, matte
    # cloth and hair
    rough = 0.62 - 0.24 * w_gold + 0.14 * w_pale
    metal = 0.5 * w_gold
    if mask is not None:
        m = np.asarray(mask.convert('RGB').resize(img.size, Image.BILINEAR)).astype(np.float32) / 255.0
        hair = _rgb(full(266), full(0.08), np.minimum(0.46 + 0.34 * v, 0.8))
        out = out * (1 - m[..., 0:1]) + hair * m[..., 0:1]
        keep = np.clip(m[..., 1:2] + m[..., 2:3], 0, 1)
        out = out * (1 - keep) + a * keep
        rough = rough * (1 - m[..., 0]) + 0.74 * m[..., 0]
        metal = metal * (1 - m[..., 0]) * (1 - keep[..., 0])
    orm = np.stack([np.ones_like(rough), np.clip(rough, 0.2, 0.95), np.clip(metal, 0, 1)], -1)
    return (Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)),
            Image.fromarray((orm * 255).astype(np.uint8)))


MASK = Image.open(sys.argv[3]) if len(sys.argv) > 3 else None
sam = Image.open(SRC + '/samurai_albedo_src.webp').convert('RGB').resize((1024, 1024), Image.LANCZOS)
look, orm = samurai_look(sam, MASK)
save(look, SRC + '/samurai_albedo.webp.bin', 90)
save(orm.resize((512, 512), Image.BILINEAR), SRC + '/samurai_orm.webp.bin', 85)
kat = Image.open(SRC + '/katana_albedo_src.webp').convert('RGB')
save(kat, SRC + '/katana_albedo.webp.bin', 90)
