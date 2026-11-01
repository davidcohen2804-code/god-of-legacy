# Split the approved illustration into its parts: a marker-based watershed grows each part's seed strokes out to the
# drawn outlines; a shared outline goes to the part in front (the illustration's own layering).
# Usage: segment_base.py <seeds.json> <out labels.png> [preview.png]
import json, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

cfg = json.load(open(sys.argv[1])); OUT = sys.argv[2]; PREV = sys.argv[3] if len(sys.argv) > 3 else None
src = np.array(Image.open(cfg['illustration']).convert('RGB')).astype(np.float32)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
alpha = np.clip(1.0 - ((np.minimum(r, b) - g) - 70.0) / 80.0, 0.0, 1.0)
fg = np.clip(np.where(alpha[..., None] > 0.02, (src - (1 - alpha[..., None]) * np.array([255.0, 0, 255.0])) / np.maximum(alpha[..., None], 0.02), 0), 0, 255)
names = list(cfg['seeds'].keys()); order = cfg['order']
markers = np.zeros(alpha.shape, np.int32)
for i, n in enumerate(names, start=1):
    for stroke in cfg['seeds'][n]:
        pts = np.array(stroke, np.int32).reshape(-1, 1, 2)
        if len(stroke) == 1: cv2.circle(markers, tuple(stroke[0]), 2, i, -1)
        else: cv2.polylines(markers, [pts], False, i, thickness=3)
inside = alpha > 0.5
markers[~inside] = 0
bg = len(names) + 1
markers[ndimage.binary_erosion(~inside, iterations=3)] = bg  # the magenta around the figure
img8 = np.clip(fg * alpha[..., None] + 255 * (1 - alpha[..., None]) * np.array([0, 0, 0]), 0, 255).astype(np.uint8)
lab = cv2.watershed(cv2.cvtColor(img8, cv2.COLOR_RGB2BGR), markers.copy())
lab[lab == bg] = 0
# ridge pixels (-1) and the soft rim: the nearest labelled pixel
unl = (lab <= 0) & (alpha > 0.02)
if unl.any():
    known = (lab > 0)
    _, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
    lab = np.where(unl, lab[iy, ix], lab)
lab[alpha <= 0.02] = 0
# manual overrides (a boundary with no drawn line between two parts, e.g. a shirt's shoulder and its sleeve)
idx0 = {n: i for i, n in enumerate(names, start=1)}
for ov in cfg.get('overrides', []):
    m = np.zeros(lab.shape, np.uint8); cv2.fillPoly(m, [np.array(ov['poly'], np.int32)], 1)
    lab[(m > 0) & (lab > 0)] = idx0[ov['part']]
# a shared outline belongs to the part in front: dark pixels of a part that touch a part further in front go to it
dark = (fg.max(axis=2) < 80) & (alpha > 0.3)
rank = {n: k for k, n in enumerate(order)}
idx_of = {n: i for i, n in enumerate(names, start=1)}
for _ in range(3):
    changed = 0
    for front in order:
        fi = idx_of[front]
        near = ndimage.binary_dilation(lab == fi, iterations=1)
        for back in order[rank[front] + 1:]:
            bi = idx_of[back]
            move = near & (lab == bi) & dark
            lab[move] = fi; changed += int(move.sum())
    if not changed: break
Image.fromarray(lab.astype(np.uint8)).save(OUT)
json.dump({'labels': {n: i for i, n in enumerate(names, start=1)}}, open(OUT.rsplit('.', 1)[0] + '.json', 'w'))
if PREV:
    rng = np.random.default_rng(3); pal = rng.integers(60, 255, (len(names) + 2, 3)); pal[0] = 0
    over = (0.45 * fg + 0.55 * pal[lab]).astype(np.uint8); over[lab == 0] = 30
    edges = ndimage.morphological_gradient(lab, size=3) > 0
    over[edges & (lab > 0)] = 255
    Image.fromarray(over).save(PREV)
print({n: int((lab == i).sum()) for i, n in enumerate(names, start=1)})
