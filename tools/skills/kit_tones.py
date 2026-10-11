# kit_tones.py : the samurai's effect pieces in the other tones of the class (steel, gold, sakura, rose, fire, blood) — so
#   every skill can carry its own colour (SamuraiFx: `<piece>@<tone>`) while the painted pieces stay the crimson originals.
#   Reads the built atlas (public/assets/final/skills/samurai/kit/kit.json + its pages), turns each listed piece's colours
#   (its main hue moved to the tone's, the spread of hues inside it kept, white light kept white) and packs them on their own
#   page (kit-tones-<n>.webp), added to kit.json. kit.py runs it after every rebuild of the samurai's atlas.
# python3 tools/skills/kit_tones.py
import json, os, sys
import numpy as np, cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
OUT = G + 'public/assets/final/skills/samurai/kit/'
PAGE = 2048

# tone: (hue it turns to (deg), saturation factor, value gamma (<1 lighter), hue spread kept)
TONES = {
    'steel': (214, 0.16, 0.9, 0.0),    # cold white steel: the light of the blade itself
    'gold': (43, 0.92, 0.95, 0.5),     # gold: the sheath's click, the halo, the sun, the moon of the sword wave
    'sakura': (342, 0.46, 0.72, 0.5),  # cherry-blossom pink
    'rose': (328, 0.72, 0.85, 0.5),    # the mirage's rose haze
    'fire': (22, 1.0, 0.95, 0.6),      # the falcon's fire
    'blood': (354, 1.0, 1.6, 0.4),     # dark blood red (ink cuts)
}
# piece: tones it is made in (exactly what SamuraiFx asks for: `tn(piece, tone)`)
HIT = ['steel', 'gold', 'rose', 'sakura', 'fire']   # the hit marks: in every skill's tone
PIECES = {
    'slash_hit': HIT, 'slash_hit_heavy': HIT, 'slash_hit_double': ['steel'], 'burst_crit': HIT, 'burst': HIT, 'spark_s': HIT, 'spark_spray': HIT,
    'cut_thin': ['steel', 'gold', 'sakura', 'fire'], 'cut_rise': ['steel', 'sakura'], 'cut_heavy': ['rose'], 'cut_line': ['steel', 'gold', 'rose', 'blood'],
    'cut_x': ['steel'], 'cut_ring': ['steel'], 'glint': ['steel', 'rose'], 'katana': ['steel'], 'katana_ghost': ['steel', 'gold'],
    'blade_trail': ['steel', 'gold', 'rose'], 'shock_ring': ['steel', 'gold', 'rose', 'sakura', 'fire'], 'launch_beam': ['gold', 'fire'], 'launch_streaks': ['gold', 'fire'],
    'wave_crescent': ['gold'], 'wave_break': ['gold'], 'wind_ring': ['steel'], 'timer_ring': ['rose'], 'aura_crimson': ['rose'],
    'petal_storm': ['sakura'], 'petal_ring': ['sakura'], 'petal_column': ['sakura'], 'vortex': ['sakura'], 'sun_rays': ['fire', 'gold'],
    'falcon_dive': ['fire'], 'falcon_spread': ['fire'],
    'dragon_head': ['gold'], 'dragon_body': ['gold'], 'dragon_tail': ['gold'], 'dragon_claw': ['gold'], 'sigil_dragon': ['gold'],
}


def dominant(h, w):
    ang = np.radians(h); x, y = (np.cos(ang) * w).sum(), (np.sin(ang) * w).sum()
    return float(np.degrees(np.arctan2(y, x)) % 360)


def tone(px, name):
    """px: straight RGBA uint8. Its main hue moved to the tone's; near-white light stays white."""
    hue, sat, gam, spread = TONES[name]
    rgb = np.ascontiguousarray(px[..., :3])
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    h, s, v = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255, hsv[..., 2] / 255
    w = (px[..., 3] / 255) * s * v
    dom = dominant(h[w > 0.05], w[w > 0.05]) if (w > 0.05).any() else 0
    d = ((h - dom + 180) % 360) - 180
    nh = (hue + d * spread) % 360
    ns = np.clip(s * sat, 0, 1)
    nv = np.clip(np.power(v, gam), 0, 1)
    if name == 'blood':                                    # its white-hot core goes dark red too
        ns = np.maximum(ns, 0.85); nv = nv * 0.78
    out = np.dstack([nh * 256 / 360, ns * 255, nv * 255]).round().clip(0, 255).astype(np.uint8)
    res = cv2.cvtColor(out, cv2.COLOR_HSV2RGB_FULL)
    if name != 'blood':
        keep = (s < 0.06)[..., None]                       # white light: as it was
        res = np.where(keep, rgb, res)
    o = np.dstack([res, px[..., 3]])
    o[o[..., 3] == 0] = 0
    return o


def pack(items):
    order = sorted(range(len(items)), key=lambda i: -items[i].shape[0])
    pos, pages = [None] * len(items), [[0, 0, 0]]
    for i in order:
        h, w = items[i].shape[:2]
        for pi, pg in enumerate(pages):
            if pg[0] + w + 2 > PAGE: pg[0], pg[1], pg[2] = 0, pg[1] + pg[2] + 2, 0
            if pg[1] + h + 2 <= PAGE: break
        else:
            pages.append([0, 0, 0]); pi, pg = len(pages) - 1, pages[-1]
        pos[i] = (pi, pg[0] + 1, pg[1] + 1)
        pg[0] += w + 2; pg[2] = max(pg[2], h)
    return pos, len(pages)


def main():
    meta = json.load(open(OUT + 'kit.json'))
    base = [t for t in meta['textures'] if not t['image'].startswith('kit-tones')]
    src = {}
    for t in base:
        img = np.asarray(Image.open(OUT + t['image']).convert('RGBA'))
        for f in t['frames']:
            r = f['frame']; src[f['filename']] = img[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
    names, pieces = [], []
    for piece, tones in PIECES.items():
        if piece not in src: raise SystemExit(f'no piece {piece} in the atlas')
        for tn in tones:
            names.append(f'{piece}@{tn}'); pieces.append(tone(src[piece], tn))
    pos, n = pack(pieces)
    for old in os.listdir(OUT):
        if old.startswith('kit-tones'): os.remove(OUT + old)
    pages = [np.zeros((PAGE, PAGE, 4), np.uint8) for _ in range(n)]
    frames = [[] for _ in range(n)]
    for name, im, (pi, x, y) in zip(names, pieces, pos):
        h, w = im.shape[:2]
        pages[pi][y:y + h, x:x + w] = im
        frames[pi].append({'filename': name, 'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                           'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}})
    tex = []
    for pi, pg in enumerate(pages):
        ys = np.nonzero(pg[..., 3].any(1))[0]
        hh = int(min(PAGE, 2 ** int(np.ceil(np.log2(ys.max() + 2))))) if len(ys) else 2
        Image.fromarray(pg[:hh], 'RGBA').save(OUT + f'kit-tones-{pi}.webp', 'WEBP', quality=92, method=6, alpha_quality=100)
        tex.append({'image': f'kit-tones-{pi}.webp', 'format': 'RGBA8888', 'size': {'w': PAGE, 'h': hh}, 'scale': 1, 'frames': frames[pi]})
        print(f'tones page {pi}: {PAGE}x{hh}', f'{os.path.getsize(OUT + f"kit-tones-{pi}.webp") / 1024:.0f} KB')
    meta['textures'] = base + tex
    json.dump(meta, open(OUT + 'kit.json', 'w'), separators=(',', ':'))
    print(len(names), 'toned pieces')


if __name__ == '__main__':
    main()
