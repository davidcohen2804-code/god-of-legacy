# wtone.py : the Warrior's five effect families (DFO's quality review) — each painted sheet re-toned into its family by a
#   gradient map on its own brightness, so any still frame names its family and the colour holds on the red planks
#   (the game draws these sheets with NORMAL blend). Originals are kept in tools/skills/orig/warrior/<id>__<file>.png.
#   STEEL white steel (the sword) · STONE rock + molten orange in the brightest (his weight) · IRON dark iron, cold
#   blue-white light (his grappling hand) · HOLY pale gold, white core (the Judge's verdicts) · CRIMSON deep red, black
#   smoke (his fury).
# python3 tools/skills/wtone.py            (every sheet in SHEETS, from the kept originals)
import os, shutil
import numpy as np
from PIL import Image

G = os.path.dirname(os.path.abspath(__file__)) + '/../../'
OUT = G + 'public/assets/final/skills/warrior/'
ORIG = G + 'tools/skills/orig/warrior/'
FAM = {  # dark, mid, hot stops (0..1 rgb), alpha gain, the knee (brightness where mid turns to hot)
    'STEEL':   ([0.42, 0.47, 0.58], [0.72, 0.79, 0.93], [1.00, 1.00, 1.00], 1.15, 0.6),
    'STONE':   ([0.24, 0.20, 0.17], [0.62, 0.55, 0.46], [1.00, 0.55, 0.14], 1.3, 0.88),
    'IRON':    ([0.14, 0.17, 0.23], [0.40, 0.55, 0.84], [0.86, 0.94, 1.00], 1.2, 0.6),
    'HOLY':    ([0.72, 0.58, 0.30], [1.00, 0.88, 0.56], [1.00, 1.00, 0.93], 1.1, 0.55),
    'CRIMSON': ([0.06, 0.01, 0.01], [0.62, 0.05, 0.04], [1.00, 0.55, 0.32], 1.35, 0.7),
}
SHEETS = {  # skill dir / file : family
    'warrior_basic/vfx': 'STEEL', 'dash_slash/vfx': 'STEEL', 'whirlwind/vfx': 'STEEL', 'lance_thrust/vfx': 'STEEL', 'sky_breaker/vfx': 'STEEL',
    'ground_breaker/vfx': 'STONE', 'leap_crash/vfx': 'STONE', 'earthsplitter/vfx': 'STONE',
    'iron_grip/vfx': 'IRON', 'judgment_hook/vfx': 'IRON', 'shield_charge/vfx': 'IRON',
    'war_cry/vfx': 'CRIMSON', 'sanctuary/vfx': 'HOLY',  # (sanctuary/vfx: War Cry's original sheet in HOLY — it used to borrow War Cry's) 'lions_maw/vfx': 'CRIMSON', 'blade_storm/storm': 'CRIMSON', 'blade_storm/erupt_a': 'CRIMSON', 'blade_storm/phantom': 'CRIMSON',
}


def tone(img, fam):
    d, m, h, gain, k = FAM[fam]; d, m, h = (np.array(x, np.float32) for x in (d, m, h))
    a = np.asarray(img.convert('RGBA')).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    if img.mode == 'RGB': al = np.ones_like(al)          # black-backed additive sheets: the light is the alpha
    l = rgb.max(-1)
    t = np.clip((rgb * [0.3, 0.59, 0.11]).sum(-1) ** 1.3, 0, 1)[..., None]  # the map follows luminance (gold is bright in red / green only: by max() every gold pixel was 'hot')
    col = np.where(t < k, d + (m - d) * (t / k), m + (h - m) * ((t - k) / (1 - k)))
    out_a = np.clip(al * np.clip(l * gain, 0, 1), 0, 1)
    return Image.fromarray((np.concatenate([np.clip(col, 0, 1), out_a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    for key, fam in SHEETS.items():
        sid, f = key.split('/'); src = OUT + key + '.png'; keep = ORIG + ('war_cry__vfx.png' if key == 'sanctuary/vfx' else f'{sid}__{f}.png')
        if not os.path.exists(keep): shutil.copy(src, keep)
        tone(Image.open(keep), fam).save(src, optimize=True)
        print(key, fam)
