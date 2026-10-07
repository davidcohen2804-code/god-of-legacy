# Re-tone an additive FX sheet so it can be drawn with NORMAL blend and keep its colour on a bright warm floor.
# rgb -> normalised brightness, hue pulled toward the target colour, white core kept; alpha from luminance.
import sys, numpy as np, colorsys
from PIL import Image
src, dst, hexcol, pull = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
amul = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
rgb, al = a[..., :3], a[..., 3]
mx = rgb.max(-1, keepdims=True) + 1e-4
norm = rgb / mx                                    # pure colour, full brightness
lum = (rgb * [0.3, 0.59, 0.11]).sum(-1, keepdims=True) / mx  # whiteness 0..1
tc = np.array([int(hexcol[i:i+2], 16) for i in (0, 2, 4)], np.float32) / 255
white = np.clip((lum - 0.85) / 0.15, 0, 1) ** 1.5    # only the hottest core stays near white
col = norm * (1 - pull) + tc * pull
col = col * (1 - white) + np.minimum(1, tc * 0.45 + 0.6) * white
v = mx[..., 0]
out_a = np.clip(al * np.clip(v * 1.25, 0, 1) * amul, 0, 1)
shade = 0.55 + 0.45 * np.clip(v, 0, 1)[..., None]   # darker rim, bright centre: gives body on the floor
out = np.concatenate([np.clip(col * shade, 0, 1), out_a[..., None]], -1)
Image.fromarray((out * 255).astype(np.uint8)).save(dst)
