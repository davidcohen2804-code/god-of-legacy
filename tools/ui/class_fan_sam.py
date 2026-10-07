# class_fan_sam.py : the four heroes' silhouettes on the class fan (tools/ui/gpt_class_fan.png), made once with Segment
#   Anything (ViT-B, quantized ONNX: github.com/danielgatis/rembg/releases/download/v0.0.0/vit_b-{encoder,decoder}-quant.onnx)
#   from a box and a few points per piece. Writes tools/ui/class_fan_chars.png: 0 = no hero, 60 = the warrior (card 1),
#   120 = the book mage, 180 = the archer, 240 = the samurai. tools/ui/class_fan.py reads it.
# python3 tools/ui/class_fan_sam.py MODEL_DIR
import os, sys
import numpy as np, onnxruntime as ort, cv2
from PIL import Image
from scipy import ndimage

G = os.path.dirname(os.path.abspath(__file__)) + '/'
SRC = G + 'gpt_class_fan.png'
enc = ort.InferenceSession(sys.argv[1] + '/vit_b-encoder-quant.onnx', providers=['CPUExecutionProvider'])
dec = ort.InferenceSession(sys.argv[1] + '/vit_b-decoder-quant.onnx', providers=['CPUExecutionProvider'])

img = Image.open(SRC).convert('RGB')
W, H = img.size
k = 1024 / max(W, H)
a = np.array(img.resize((round(W * k), round(H * k)), Image.BILINEAR)).astype(np.float32)
a = (a - np.array([123.675, 116.28, 103.53], np.float32)) / np.array([58.395, 57.12, 57.375], np.float32)
pad = np.zeros((1024, 1024, 3), np.float32); pad[:a.shape[0], :a.shape[1]] = a
emb = enc.run(None, {'x': pad.transpose(2, 0, 1)[None]})[0]   # the whole picture at once (crops come out misplaced)

def piece(box, pos):
    """One piece: a box around it and points on it; the low-res answer fed back once."""
    coords = [[x * k, y * k] for x, y in pos] + [[box[0] * k, box[1] * k], [box[2] * k, box[3] * k]]
    feed = {'image_embeddings': emb, 'point_coords': np.array([coords], np.float32),
            'point_labels': np.array([[1] * len(pos) + [2, 3]], np.float32),
            'mask_input': np.zeros((1, 1, 256, 256), np.float32), 'has_mask_input': np.zeros(1, np.float32),
            'orig_im_size': np.array([H, W], np.float32)}
    _, _, low = dec.run(None, feed)
    feed['mask_input'] = low; feed['has_mask_input'] = np.ones(1, np.float32)
    return dec.run(None, feed)[0][0, 0] > 0

hsv = cv2.cvtColor(np.array(img)[..., ::-1], cv2.COLOR_BGR2HSV_FULL).astype(np.float32)
hue, sat = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255
xx = np.arange(W)[None, :].repeat(H, 0)
# the bow: without the leaves seen between its limbs
bow = piece([810, 70, 950, 530], [[898, 168], [884, 440]]) & ~((hue > 62) & (hue < 170) & (sat > 0.22))
lab, n = ndimage.label(bow); size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
bow = np.isin(lab, [i + 1 for i in range(n) if size[i] > 150])
HEROES = {
    1: piece([80, 210, 440, 700], [[248, 384], [227, 463]]) | piece([135, 225, 370, 362], [[256, 302], [320, 335]])
       | piece([60, 300, 300, 520], [[110, 400]]),                                        # warrior + sword + cape
    2: piece([330, 150, 650, 600], [[484, 268], [507, 352]]),                               # book mage
    3: piece([640, 120, 935, 560], [[767, 261], [767, 353]]) | bow
       | (piece([700, 190, 955, 290], [[920, 225]]) & (xx > 845)),                          # archer + bow + arrow
    4: piece([900, 160, 1180, 660], [[1093, 302], [1060, 435]]) | piece([1050, 560, 1270, 690], [[1180, 640]])
       | piece([920, 320, 1010, 540], [[960, 450]]),                                        # samurai + both ends of the cape
}
out = np.zeros((H, W), np.uint8)
for i in (2, 3, 4, 1):          # the warrior last: his sword lies over the others
    out[HEROES[i]] = i * 60
Image.fromarray(out, 'L').save(G + 'class_fan_chars.png')
print('heroes', {i: int(m.sum()) for i, m in HEROES.items()})
