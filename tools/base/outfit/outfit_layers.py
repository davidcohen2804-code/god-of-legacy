# outfit_layers.py : the starter outfit's colours and the skin tones offered at character creation:
#   src/data/outfit-colors.json   the colours of the shirt / pants / boots (names + swatches; the worn gear and the item icons
#                                 are recoloured into them: tools/base/naked_frames.py, tools/base/gear_icons.py)
#   src/data/skin-tones.json      the skin tones (names, swatches, per-channel gains; the game re-shades the skin with them)
#   The menus and the game draw the clothes as worn gear now (naked_frames.py); skin_w / toned below are the skin rule the
#   game follows (src/characters/Skin.ts).
import json, os, numpy as np
H = os.path.dirname(os.path.abspath(__file__)) + '/..'
# the colours offered: base tone of each, shaded like GPT's own folds and highlights
# skin tones (MapleStory's base set): the drawn skin x a gain per channel, shadows and shine kept (the game applies the same)
SKIN_BASE = (253, 212, 145)
SKINS = [('white', (252, 226, 204)), ('light', SKIN_BASE), ('tan', (236, 176, 116)), ('dark', (184, 124, 80))]
KNEE = 230.0                                                    # a lighter tone: shine rolls off softly into white (no flat white)


def toned(ce, gain):
  """The skin colour x the tone's gain per channel; where a channel is lightened, its top end eases into 255."""
  v = ce * gain
  soft = KNEE + (255 - KNEE) * (1 - np.exp(-np.clip(v - KNEE, 0, None) / (255 - KNEE)))
  return np.where((gain > 1) & (v > KNEE), soft, np.minimum(v, 255))


def skin_w(ce, al):
  """How much a pixel is skin (warm, light, opaque): 1 inside the skin, fading at its outline (no light rim on dark skin)."""
  R, G, B = ce[..., 0], ce[..., 1], ce[..., 2]; lum = 0.3 * R + 0.59 * G + 0.11 * B
  return np.clip((lum - 70) / 40, 0, 1) * ((R >= G) & (G >= B) & (R - B > 15)) * (al > 0.02)


COLORS = {
  'top': [('white', (236, 233, 226)), ('blue', (62, 112, 184)), ('red', (196, 64, 52))],
  'pants': [('denim', (60, 96, 168)), ('brown', (124, 84, 50)), ('black', (52, 52, 60))],
  'shoes': [('brown', (128, 78, 40)), ('black', (46, 42, 42)), ('red', (142, 44, 36))],
}


json.dump({k: [{'name': n, 'swatch': '#%02x%02x%02x' % c} for n, c in v] for k, v in COLORS.items()},
          open(H + '/../../src/data/outfit-colors.json', 'w'), indent=1)
json.dump([{'name': n, 'swatch': '#%02x%02x%02x' % c, 'gain': [round(c[i] / SKIN_BASE[i], 4) for i in range(3)]} for n, c in SKINS],
          open(H + '/../../src/data/skin-tones.json', 'w'), indent=1)
