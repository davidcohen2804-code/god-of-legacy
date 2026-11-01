# Keying for drawings on a flat magenta ground (#FF00FF): alpha from how far a pixel is from the ground colour toward
# the figure, with the magenta spill taken out of the edge pixels (un-premultiplied against the ground).
import numpy as np
from PIL import Image

GROUND = np.array([255.0, 0.0, 255.0])


def key(path_or_img):
    im = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    # magenta-ness: min(r, b) - g  (ground ~250, skin/hair/cloth far lower)
    m = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    alpha = np.clip((215.0 - m) / 120.0, 0, 1)
    al = alpha[..., None]
    fg = np.where(al > 0.01, (a - (1 - al) * GROUND) / np.maximum(al, 0.01), 0)
    return alpha, np.clip(fg, 0, 255)


def rgba(alpha, fg):
    return Image.fromarray(np.dstack([fg, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
