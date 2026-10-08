# kit.py : the samurai's effect pieces (GPT sheets of separate pieces, tools/skills/gpt/kit/) → one texture atlas the game
#   animates in code (src/skills/SamuraiFx.ts): public/assets/final/skills/samurai/kit/kit.json + kit-<n>.webp
#   (a Phaser multi-atlas: every piece is a named frame of the one texture key).
# Each piece: its box on the sheet (the pieces whose middle falls in the box are taken whole — up to a margin past the box —
# so the glow of a neighbour that only reaches in is left out), the light split off the sheet's key colour
# (gpt_sheet.keyed), trimmed, scaled so its longer side is `size` px.
# python3 tools/skills/kit.py          (the samurai)
# python3 tools/skills/kit.py mage     (the book mage: tools/skills/gpt/mage/ → public/assets/final/skills/book_mage/kit/)
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gpt_sheet import keyed  # noqa: E402

G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
SRC = G + 'tools/skills/gpt/kit/'
OUT = G + 'public/assets/final/skills/samurai/kit/'
PAGE = 2048

# sheet: [(name, (x0, y0, x1, y1) box on the sheet, longer side in the atlas[, mode])] — mode 'box': everything inside the
# box (pieces that touch); 'solid': an opaque piece in light colours (dust) keyed by how much greener than red / blue a
# pixel is (the light-over-key split would read beige as half see-through pink)
SHEETS = {
    's1_cuts.png': [
        ('cut_thin', (0, 0, 359, 451), 320), ('cut_heavy', (359, 0, 748, 451), 320), ('cut_line', (748, 0, 1176, 451), 512), ('cut_x', (1176, 0, 1536, 451), 300),
        ('cut_rise', (0, 451, 327, 1024), 320), ('cut_ring', (327, 451, 763, 1024), 400), ('cut_split', (763, 451, 1176, 1024), 512), ('cut_fan', (1176, 451, 1536, 1024), 320)],
    's1b_s2_cuts_sparks.png': [  # (these pieces touch each other: cut straight along the boxes)
        ('spark_s', (0, 517, 302, 762), 200, 'box'), ('burst', (302, 517, 746, 762), 280, 'box'), ('burst_crit', (746, 517, 1158, 750), 320, 'box'), ('glint', (1158, 517, 1536, 762), 256, 'box'),
        ('shock_ring', (0, 762, 387, 1024), 384, 'box'), ('sun_rays', (387, 762, 772, 1024), 320, 'box'), ('launch_beam', (772, 785, 1140, 1024), 300, 'box'), ('vortex', (1140, 762, 1536, 1024), 300, 'box')],
    's3_ink.png': [
        ('ink_long', (0, 0, 447, 494), 512), ('ink_short', (447, 0, 785, 494), 384), ('ink_burst', (785, 0, 1158, 494), 320), ('ink_smoke', (1158, 0, 1536, 494), 300),
        ('crack', (0, 494, 400, 1024), 384), ('dust', (400, 494, 773, 1024), 256, 'solid'), ('dust_ring', (773, 494, 1187, 1024), 384, 'solid'), ('ink_spatter', (1187, 494, 1536, 1024), 192)],
    's4_sakura.png': [
        ('petal_1', (0, 0, 348, 470), 72), ('petal_2', (348, 0, 751, 470), 72), ('petal_3', (751, 0, 1150, 456), 72), ('petal_4', (1150, 0, 1536, 380), 64),
        ('blossom', (0, 470, 410, 1024), 128), ('blossom_cluster', (410, 470, 771, 1024), 192), ('branch_1', (771, 456, 1150, 1024), 360), ('branch_2', (1150, 380, 1536, 1024), 380)],
    's5_sigils.png': [('sigil_sakura', (0, 0, 720, 724), 512), ('sigil_dragon', (720, 0, 1450, 724), 512), ('halo_gold', (1450, 0, 2172, 724), 400)],
    's6b_dragon.png': [('dragon_head', (0, 0, 1020, 429), 420), ('dragon_claw', (1020, 0, 1536, 429), 220), ('dragon_body', (0, 429, 1536, 684), 1024), ('dragon_tail', (0, 684, 1536, 1024), 640)],
    's7_sun.png': [('sun_black', (0, 0, 678, 724), 400), ('sun_flare', (678, 0, 1480, 724), 440), ('sun_break', (1480, 0, 2172, 724), 400)],
    's8_banner.png': [('banner_cloth', (0, 0, 460, 1024), 440), ('banner_pole', (460, 0, 760, 1024), 512), ('katana', (760, 0, 1170, 1024), 400), ('katana_ghost', (1170, 0, 1536, 1024), 400)],
    's9_wind.png': [('tornado', (0, 0, 475, 1024), 520), ('petal_column', (475, 0, 794, 1024), 480), ('wind_ring', (794, 0, 1536, 523), 400), ('wind_lines', (794, 523, 1536, 1024), 400)],
    's10_birds.png': [('falcon_dive', (0, 0, 659, 724), 400), ('falcon_spread', (659, 0, 1477, 724), 440), ('swallow', (1477, 0, 2172, 724), 320)],
    's11_hits.png': [  # slash hits (upper-left → lower-right), the sword wave, the ground slash, the blade trail
        ('slash_hit', (0, 80, 370, 500), 300), ('slash_hit_heavy', (370, 80, 770, 500), 320), ('slash_hit_double', (770, 80, 1136, 500), 300), ('spark_spray', (1136, 80, 1536, 500), 300),
        ('wave_crescent', (0, 540, 404, 1024), 320), ('wave_break', (404, 540, 745, 1024), 300), ('ground_slash', (745, 540, 1150, 1024), 400), ('blade_trail', (1150, 540, 1536, 1024), 400)],
}

def grid(cols, rows, names, sizes, w=1536, h=1024, x0=0, y0=0, mode=''):
    """Pieces in equal cells (left to right, top row first); a name None skips its cell."""
    cw, ch = w / cols, h / rows
    out = []
    for i, (n, z) in enumerate(zip(names, sizes)):
        if n is None: continue
        c, r = i % cols, i // cols
        out.append((n, (round(x0 + c * cw), round(y0 + r * ch), round(x0 + (c + 1) * cw), round(y0 + (r + 1) * ch)), z, *([mode] if mode else [])))
    return out


# The book mage's pieces (MageFx): blue-violet arcane light, ice, lightning, pages and paper cranes, sigils, time.
MAGE_SHEETS = {
    'm1_arcane.png': grid(4, 2, ['bolt_arcane', 'bolt_burst', 'wave_arc', 'ring_arc', 'spark_arc', 'hit_heavy', 'hit_crit', 'launch_arc'], [300, 280, 400, 384, 200, 300, 340, 300]),
    'm2_sigils_v1.png': grid(3, 2, ['sig_bind', 'sig_clock', 'sig_drain', 'sig_star', 'sig_gold', 'sig_disk'], [420, 460, 420, 512, 360, 320], mode='box'),
    'm3_ice.png': grid(4, 2, ['ice_spike', 'ice_cluster', None, 'ice_shatter', None, 'ice_ring', 'snowflake', 'ice_shards'], [300, 320, 0, 340, 0, 384, 200, 220]),
    'm4_lightning.png': grid(4, 2, ['bolt_long', 'bolt_diag', 'bolt_branch', 'storm_orb', 'storm_disc', 'stun_ring', 'bolt_impact', 'bolt_arc'], [440, 360, 360, 220, 420, 200, 300, 320]),
    'm6_pages_v1.png': grid(4, 2, ['page_1', 'page_2', 'page_3', 'page_4', 'page_group', 'book_open', 'book_ghost', 'book_giant'], [110, 110, 110, 100, 260, 300, 300, 420]),
    'm7_time_v1.png': grid(4, 2, ['singularity', 'vortex_pull', 'implosion', 'clock_face', 'time_shards', 'time_ripple', 'star_fall', 'star_impact'], [340, 340, 380, 512, 340, 384, 340, 384]),
    'm8_ward_blink.png': grid(4, 2, ['ward_dome', 'ward_break', 'blink_out', 'blink_in', 'aura_gold', 'buff_star', 'heal_motes', 'ghost_haze'], [340, 300, 300, 300, 380, 140, 220, 380], mode='box'),
    'm9_paper_ice.png': grid(4, 2, ['crane_up', 'crane_down', 'crane_big', 'page_cocoon', 'paper_burst', 'paper_scraps', 'ice_block', 'frost_mist'], [150, 150, 260, 300, 300, 200, 300, 260]),
    'm11_bolts_hand_runes.png': grid(4, 3, ['bolt_frost', 'bolt_storm', 'hand_open', 'hand_fist', 'shackles', 'time_blast', 'floor_frost', 'glow_streak', 'rune_cyan', 'rune_ice', 'rune_violet'], [300, 300, 300, 280, 300, 440, 384, 340, 110, 110, 110], mode='box')
        + [('rune_gold', (1152, 683, 1336, 1024), 110, 'box'), ('rune_blue', (1336, 683, 1536, 1024), 110, 'box')],
}
PROFILES = {'samurai': (G + 'tools/skills/gpt/kit/', G + 'public/assets/final/skills/samurai/kit/', None),
            'mage': (G + 'tools/skills/gpt/mage/', G + 'public/assets/final/skills/book_mage/kit/', MAGE_SHEETS)}

MARGIN = 40           # how far past its box a piece may reach (its own glow)
BODY_SLICES = 8       # the dragon body is also cut into this many frames along its length (the game chains them)


def solid_key(sheet):
    """Premultiplied RGBA of a sheet keyed as opaque pieces on green: alpha from the green excess over red / blue."""
    rgb = np.asarray(Image.open(sheet).convert('RGB')).astype(np.float32) / 255
    b = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    K = np.median(b, 0)
    ex = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
    a = np.clip(1 - ex / max(1e-3, K[1] - max(K[0], K[2])), 0, 1)
    a = np.where(a < 0.06, 0, a)
    col = np.clip((rgb - (1 - a[..., None]) * K) / np.maximum(a[..., None], 1e-3), 0, 1)
    lum = col @ np.array([0.3, 0.55, 0.15], np.float32)               # dust: its brightness in one warm beige (no green or pink cast)
    col = np.clip(lum[..., None] * np.array([1.08, 0.97, 0.84], np.float32), 0, 1)
    return np.dstack([col * a[..., None], a])


def cut(pm, box, mode=''):
    a = pm[..., 3]
    if mode == 'box':
        x0, y0, x1, y1 = box
        sub = pm[y0:y1, x0:x1].copy()
        h, w = sub.shape[:2]                                    # soft edges where the box cuts through a neighbour's light
        ry = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / 14, 0, 1)
        rx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / 14, 0, 1)
        sub *= (ry[:, None] * rx[None, :])[..., None]
        ys, xs = np.nonzero(sub[..., 3] > 0.03)
        if not len(ys): return None
        return sub[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
    lab, n = ndimage.label(a > 0.02, structure=np.ones((3, 3)))
    if not n: return None
    idx = np.arange(1, n + 1)
    mass = ndimage.sum(a, lab, idx)
    cy = ndimage.sum(a * np.arange(a.shape[0])[:, None], lab, idx) / np.maximum(mass, 1e-6)
    cx = ndimage.sum(a * np.arange(a.shape[1])[None, :], lab, idx) / np.maximum(mass, 1e-6)
    x0, y0, x1, y1 = box
    keep = idx[(cx >= x0) & (cx < x1) & (cy >= y0) & (cy < y1)]
    m = np.isin(lab, keep)
    win = np.zeros_like(m)
    win[max(0, y0 - MARGIN):y1 + MARGIN, max(0, x0 - MARGIN):x1 + MARGIN] = True
    m &= win
    ys, xs = np.nonzero(m & (a > 0.03))
    if not len(ys): return None
    t, b, l, r = max(0, ys.min() - 4), ys.max() + 5, max(0, xs.min() - 4), xs.max() + 5
    return pm[t:b, l:r] * m[t:b, l:r, None]


def scaled(piece, size):
    h, w = piece.shape[:2]
    k = size / max(h, w)
    im = Image.fromarray((piece * 255).round().clip(0, 255).astype(np.uint8), 'RGBA')   # premultiplied
    if k < 1: im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    q = np.asarray(im).astype(np.float32) / 255
    al = q[..., 3:4]
    out = np.concatenate([np.where(al > 0, q[..., :3] / np.maximum(al, 1e-4), 0), al], 2)
    out = (out * 255).round().clip(0, 255).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return out


def pack(items):
    """Shelf packing, tallest first, into PAGE x PAGE pages: [(page, x, y)] in the order given."""
    order = sorted(range(len(items)), key=lambda i: -items[i].shape[0])
    pos, pages = [None] * len(items), [[0, 0, 0]]  # per page: shelf x, shelf y, shelf height
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
    global SRC, OUT, SHEETS
    prof = PROFILES[sys.argv[1] if len(sys.argv) > 1 else 'samurai']
    SRC, OUT = prof[0], prof[1]
    if prof[2]: SHEETS = prof[2]
    names, pieces = [], []
    for sheet, specs in SHEETS.items():
        pm, K = keyed(SRC + sheet)
        solid = None
        for name, box, size, *mode in specs:
            mode = mode[0] if mode else ''
            if mode == 'solid' and solid is None: solid = solid_key(SRC + sheet)
            p = cut(solid if mode == 'solid' else pm, box, mode)
            if p is None: raise SystemExit(f'{sheet}: nothing in {name} {box}')
            names.append(name); pieces.append(scaled(p, size))
    pos, n = pack(pieces)
    os.makedirs(OUT, exist_ok=True)
    pages = [np.zeros((PAGE, PAGE, 4), np.uint8) for _ in range(n)]
    frames = [[] for _ in range(n)]
    for name, im, (pi, x, y) in zip(names, pieces, pos):
        h, w = im.shape[:2]
        pages[pi][y:y + h, x:x + w] = im
        fr = lambda fn, fx, fy, fw, fh: {'filename': fn, 'frame': {'x': fx, 'y': fy, 'w': fw, 'h': fh}, 'rotated': False, 'trimmed': False,
                                         'spriteSourceSize': {'x': 0, 'y': 0, 'w': fw, 'h': fh}, 'sourceSize': {'w': fw, 'h': fh}}
        frames[pi].append(fr(name, x, y, w, h))
        if name == 'dragon_body':   # slices along its length
            for k in range(BODY_SLICES):
                a, b = round(k * w / BODY_SLICES), round((k + 1) * w / BODY_SLICES)
                frames[pi].append(fr(f'dragon_body_{k}', x + a, y, b - a, h))
        print(f'{name:16} {w:4}x{h:<4} page {pi}')
    used = []
    for pi, pg in enumerate(pages):
        ys = np.nonzero(pg[..., 3].any(1))[0]
        hh = int(min(PAGE, 2 ** int(np.ceil(np.log2(ys.max() + 2))))) if len(ys) else 2
        img = Image.fromarray(pg[:hh], 'RGBA')
        img.save(OUT + f'kit-{pi}.webp', 'WEBP', quality=92, method=6, alpha_quality=100)
        used.append({'image': f'kit-{pi}.webp', 'format': 'RGBA8888', 'size': {'w': PAGE, 'h': hh}, 'scale': 1, 'frames': frames[pi]})
        print(f'page {pi}: {PAGE}x{hh}', f'{os.path.getsize(OUT + f"kit-{pi}.webp") / 1024:.0f} KB')
    json.dump({'textures': used, 'meta': {'app': 'tools/skills/kit.py'}}, open(OUT + 'kit.json', 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()
