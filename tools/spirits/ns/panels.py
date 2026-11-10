# The costume's skirt below the waist sorted into its panels (test only): front left / front right (their own pieces),
# the shell round the legs cut into left / rear / right, the sash's tails; the legs (the hakama, the greaves) apart.
#   import panels; lab = panels.classify(P, I)   -> per-face label
import numpy as np
LEG = {'l': (np.array([0.10, 0.90, -0.055]), np.array([0.135, 0.435, -0.07])), 'r': (np.array([-0.10, 0.90, -0.055]), np.array([-0.135, 0.435, -0.07]))}
NAMES = ['none', 'leg_l', 'leg_r', 'panel_l', 'panel_r', 'panel_b', 'front_l', 'front_r', 'sash_l', 'sash_r']
def leg_dist(c, s):
    a, b = LEG[s]; t = np.clip((a[1] - c[:, 1]) / (a[1] - b[1]), 0, 1.3)
    ax = a[None, :] + t[:, None] * (b - a)[None, :]
    return np.hypot(c[:, 0] - ax[:, 0], c[:, 2] - ax[:, 2])
def pants_r(y):
    # the hakama's radius round its leg's axis: puffed at the knee (its gathered foot), slimmer up the thigh
    return np.interp(y, [0.30, 0.40, 0.46, 0.55, 0.70, 0.90], [0.075, 0.105, 0.118, 0.112, 0.100, 0.100])
def classify(P, I, ytop=0.84):
    c = P[I].mean(1); lab = np.zeros(len(I), int)
    low = (c[:, 1] < ytop) & (c[:, 1] > 0.30)
    dl, dr = leg_dist(c, 'l'), leg_dist(c, 'r'); d = np.minimum(dl, dr)
    onleg = d < pants_r(c[:, 1]) + 0.012
    lab[low & onleg & (dl <= dr)] = 1; lab[low & onleg & (dr < dl)] = 2
    sh = low & ~onleg
    front = sh & (c[:, 2] > 0.075)
    # the sash's tails: the crimson pieces hanging in front of the front panels (narrow, in front)
    lab[front & (c[:, 0] >= 0)] = 6; lab[front & (c[:, 0] < 0)] = 7
    back = sh & ~front
    ang = np.degrees(np.arctan2(c[:, 0], -(c[:, 2] + 0.05)))      # 0 = straight behind, +90 = his left
    lab[back & (np.abs(ang) <= 32)] = 5
    lab[back & (ang > 32)] = 3; lab[back & (ang < -32)] = 4
    return lab
