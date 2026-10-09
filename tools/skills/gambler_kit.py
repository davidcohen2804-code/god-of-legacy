"""Gambler effect pieces: cut the GPT sheets (tools/skills/src/gambler_<n>.png, a grid on flat green or black) into one
PNG per piece under public/assets/final/skills/gambler/kit/<name>.png.

Green sheets: the screen green is keyed out (soft edge, green spill pulled down). Black sheets: light pieces — the
brightness becomes the alpha (they are drawn with additive blending, so black = nothing).
Run: python3 tools/skills/gambler_kit.py [sheet ...]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'skills', 'src')
OUT = os.path.join(ROOT, 'public', 'assets', 'final', 'skills', 'gambler', 'kit')

# sheet -> (background, columns, rows, piece names in reading order, size the piece is kept at (longest side px))
SHEETS = {
    'cards': ('green', 4, 2, ['card_back', 'card_face', 'card_S', 'card_H', 'card_D', 'card_C', 'card_ace', 'card_joker'], 168),
    'casino': ('green', 4, 2, ['c_wheel', 'c_ball', 'c_die_a', 'c_die_b', 'c_coin_h', 'c_coin_t', 'c_chip', 'c_stack'], 420, False),
    'extra': ('black', 4, 2, ['x_lance', 'x_comet', 'x_grip', 'x_seal', 'x_erupt', 'x_aura', 'x_tornado', 'x_cross'], 380),
    'luck': ('black', 4, 2, ['j_slot', 'j_cherry', 'j_bell', 'j_star', 'j_clover', 'j_ring', 'j_fountain', 'j_jackpot'], 360),
    'staff': ('black', 4, 2, ['s_swing', 's_heavy', 's_disc', 's_thrust', 's_rise', 's_vault', 's_homerun', 's_crack'], 360),
    'kinetic': ('black', 4, 2, ['k_streak', 'k_charge', 'k_pop', 'k_blast', 'k_ring', 'k_beam', 'k_vortex', 'k_arcs'], 320),
}


# sheets cut by hand-placed boxes (x0, y0, x1, y1 on the 1536x1024 sheet): wide pieces that reach past their grid cell
BOXES = {
    'casino2': (420, {
        'r_sigil': (0, 215, 408, 465), 'r_spin': (408, 215, 775, 465), 'r_ball': (785, 225, 980, 415),
        'r_red': (975, 45, 1255, 465), 'r_card': (1258, 85, 1525, 465),
        'd_die': (20, 595, 305, 905), 'd_tumble': (305, 595, 595, 905), 'd_trail': (570, 705, 910, 875),
        'd_impact': (912, 585, 1205, 925), 'd_double': (1205, 565, 1530, 925)}),
    'fortune': (400, {
        'o_heads': (22, 125, 332, 475), 'o_spin': (332, 125, 612, 505), 'o_tails': (610, 125, 937, 485),
        'o_arc': (935, 105, 1218, 485), 'o_aura': (1236, 75, 1532, 505),
        'w_card': (15, 520, 308, 920), 'w_fan': (308, 565, 622, 835), 'w_stream': (608, 615, 922, 835),
        'w_banner': (918, 605, 1218, 845), 'w_royal': (1218, 520, 1532, 935)}),
    'grab': (400, {
        'g_hand': (8, 160, 388, 400), 'g_fist': (386, 145, 642, 440), 'g_tether': (640, 245, 978, 335),
        'g_cocoon': (992, 115, 1222, 450), 'g_shock': (1228, 135, 1532, 435),
        'g_crater': (0, 635, 372, 885), 'g_erupt': (370, 495, 702, 920), 'g_fuse': (700, 590, 952, 880),
        'g_crackle': (956, 598, 1202, 865), 'g_orbit': (1200, 625, 1532, 835)}),
}


def cut_boxes(name):
    keep, boxes = BOXES[name]
    im = np.array(Image.open(os.path.join(SRC, f'gambler_{name}.png')).convert('RGB'))
    rgba = key_black(im)
    a = rgba[..., 3].astype(np.float32)
    rgba[..., 3] = (np.clip((a - 16) / (255 - 16), 0, 1) ** 1.1 * 255).astype(np.uint8)  # the black's faint haze goes
    os.makedirs(OUT, exist_ok=True)
    for n, (x0, y0, x1, y1) in boxes.items():
        piece = Image.fromarray(rgba[y0:y1, x0:x1])
        bb = piece.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
        if bb: piece = piece.crop((max(0, bb[0] - 4), max(0, bb[1] - 4), min(piece.width, bb[2] + 4), min(piece.height, bb[3] + 4)))
        piece.thumbnail((keep, keep), Image.LANCZOS)
        piece.save(os.path.join(OUT, f'{n}.png'))
        print(name, n, piece.size)


def key_green(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    over = g - np.maximum(r, b)                       # how much greener than the other channels
    a = 1 - np.clip((over - 30) / 90, 0, 1)            # pure screen green -> 0
    g2 = np.where(over > 0, np.maximum(r, b), g)      # pull the green spill down on the edge
    out = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    return out


def key_black(rgb):
    f = rgb.astype(np.float32)
    a = f.max(axis=2)
    col = np.where(a[..., None] > 0, f * 255 / np.maximum(a[..., None], 1), 0)
    return np.dstack([col, a]).clip(0, 255).astype(np.uint8)


def cut(name):
    bg, cols, rows, names, keep, *rest = SHEETS[name]
    split = rest[0] if rest else True  # False: a wide piece (the roulette wheel) is never cut along the grid
    im = np.array(Image.open(os.path.join(SRC, f'gambler_{name}.png')).convert('RGB'))
    rgba = key_green(im) if bg == 'green' else key_black(im)
    H, W = rgba.shape[:2]
    os.makedirs(OUT, exist_ok=True)
    # every blob belongs to the grid cell its weight centre falls in (a piece may reach over its cell's border)
    a0 = rgba[..., 3] > (40 if bg == 'green' else 14)
    grp, ng = ndimage.label(ndimage.binary_dilation(a0, iterations=3))
    cen = ndimage.center_of_mass(a0, grp, range(1, ng + 1))
    cell_of = np.zeros(ng + 1, np.int32) - 1
    for k, (yy, xx) in enumerate(cen, start=1):
        if np.isnan(yy): continue
        cell_of[k] = int(min(rows - 1, yy // (H / rows)) * cols + min(cols - 1, xx // (W / cols)))
    owner = cell_of[grp]; owner[grp == 0] = -1
    # two pieces that touch (one blob much wider / taller than a cell): split along the grid instead
    yy, xx = np.mgrid[0:H, 0:W]
    grid = (np.minimum(rows - 1, yy // (H / rows)) * cols + np.minimum(cols - 1, xx // (W / cols))).astype(np.int32)
    for k, sl in enumerate(ndimage.find_objects(grp), start=1):
        if split and sl and ((sl[1].stop - sl[1].start) > 1.35 * W / cols or (sl[0].stop - sl[0].start) > 1.35 * H / rows):
            m = grp[sl] == k
            # its cores (the blob worn down until the pieces part), each pixel to the nearest core, each core to its cell
            for it in (4, 8, 12, 18, 26):
                core, nc = ndimage.label(ndimage.binary_erosion(m & a0[sl], iterations=it))
                csz = ndimage.sum(core > 0, core, range(1, nc + 1))
                big = [j + 1 for j in range(nc) if csz[j] > 0.04 * m.sum()]
                if len(big) >= 2: break
            if len(big) >= 2:
                seeds = np.where(np.isin(core, big), core, 0)
                _, (iy, ix) = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
                near = seeds[iy, ix]
                cc = {j: ndimage.center_of_mass(seeds == j) for j in big}
                to = {j: int(min(rows - 1, (cc[j][0] + sl[0].start) // (H / rows)) * cols + min(cols - 1, (cc[j][1] + sl[1].start) // (W / cols))) for j in big}
                sub = owner[sl]; sub[m] = np.vectorize(lambda j: to.get(j, -1))(near[m])
            else: # no clean cores: cut along the darkest winding path near each grid line inside the blob
                sub = owner[sl]; gy = grid[sl].copy()
                x0, y0 = sl[1].start, sl[0].start
                lum = rgba[sl][..., 3].astype(np.float64)
                for kc in range(1, cols):
                    gx = int(kc * W / cols) - x0
                    if not (0 < gx < lum.shape[1]): continue
                    lo, hi = max(0, gx - 90), min(lum.shape[1], gx + 90)
                    cost = lum[:, lo:hi] + 1; acc = cost[0].copy(); back = np.zeros(cost.shape, np.int8)
                    for yy_ in range(1, cost.shape[0]):
                        l = np.r_[np.inf, acc[:-1]]; r_ = np.r_[acc[1:], np.inf]; best = np.minimum(np.minimum(l, acc), r_)
                        back[yy_] = np.where(best == l, -1, np.where(best == r_, 1, 0)); acc = best + cost[yy_]
                    xx_ = int(np.argmin(acc)); path = np.zeros(cost.shape[0], int)
                    for yy_ in range(cost.shape[0] - 1, -1, -1): path[yy_] = lo + xx_; xx_ += int(back[yy_, xx_]) if yy_ else 0
                    cx_ = np.arange(lum.shape[1])[None, :]
                    left = cx_ < path[:, None]
                    rowcell = (np.minimum(rows - 1, (np.arange(lum.shape[0])[:, None] + y0) // (H / rows)) * cols).astype(np.int32)
                    band = (cx_ >= lo) & (cx_ < hi)
                    gy = np.where(band, np.where(left, rowcell + kc - 1, rowcell + kc), gy)
                sub[m] = gy[m]
    for i, nm in enumerate(names):
        m = owner == i
        ys, xs = np.where(m)
        sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        cell = rgba[sl].copy(); cell[..., 3] = np.where(m[sl], cell[..., 3], 0)
        a = cell[..., 3] > (40 if bg == 'green' else 14)
        lab, k = ndimage.label(a)
        if k:
            sz = ndimage.sum(a, lab, range(1, k + 1)); big = int(np.argmax(sz)) + 1
            # the piece: its largest blob and everything near it (a neighbour's sliver at the cell edge is left out)
            keepm = ndimage.binary_dilation(lab == big, iterations=6 if bg == 'green' else 28)
            ys, xs = np.where(keepm & a)
            cell = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
            if True:
                m = (keepm & a)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                cell[..., 3] = np.where(m, cell[..., 3], 0)
        p = Image.fromarray(cell)
        s = keep / max(p.size)
        p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS)
        p.save(os.path.join(OUT, f'{nm}.png'), optimize=True)
        print(name, nm, p.size)


if __name__ == '__main__' and any(a in BOXES for a in sys.argv[1:]):
    for a in sys.argv[1:]:
        if a in BOXES: cut_boxes(a)
    sys.exit(0)
if __name__ == '__main__':
    for n in (sys.argv[1:] or SHEETS):
        cut(n)
