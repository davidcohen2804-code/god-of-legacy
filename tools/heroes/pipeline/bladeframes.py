#!/usr/bin/env python3
"""bladeframes.py <video> <cls> <act> <i,j,...> [--sheet out.jpg]: clipframes.py for weapon moves.

The usual key loses a sword in the fast frames of a strike: the blade is thin (the key's opening erases it),
see-through (PixVerse's motion blur) or split from the hand by a 1-px gap (only the largest piece is kept). Here the
body is keyed as usual and the blade is put back:
  - every thin part that reaches out of the body's edge (colour distance from the fitted background > 16, not red
    cloth) is blade evidence;
  - when the key kept most of it (a crisp painted blade cut off by a gap), the painted pixels are joined back;
  - when it is a faint smear, a clean katana is painted along it (its curve fitted to the evidence, steel with a
    bright cutting edge on the outer curve, the point drawn) — ART_STYLE §8: the smear is the effect's job.
Frames are placed like clipframes.py: ONE transform from frame 0 (the standing ref: height 509, feet y=700, hips x=384),
on a 1024 x 768 canvas (the usual 768 cuts a blade held out in front).
Frame indices are 0-based video frames. --despill for a hero with no green in the palette (the samurai); --mirror for a
clip where PixVerse turned him round to face left (the game mirrors the hero anyway when he faces left)."""
import sys, os, glob, tempfile, subprocess, argparse
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gkey import key
from integrate import hip_x

ROOT = '/home/claude/god-of-legacy'
STEEL = np.array([150, 143, 142]); SPINE = np.array([104, 98, 100]); EDGE = np.array([236, 230, 228]); LINE = np.array([52, 47, 50])


def bg_model(a):
    H, W, _ = a.shape; r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bgm = (g - np.maximum(r, b)) > 18
    s = 4; ys, xs = np.where(bgm[::s, ::s]); ys *= s; xs *= s
    yy, xx = np.mgrid[0:H, 0:W]
    def basis(x, y): return np.stack([np.ones_like(x), x / W, y / H, (x / W) ** 2, (y / H) ** 2, x * y / (W * H)], -1).astype(np.float32)
    X = basis(xs, ys); G = basis(xx, yy); bg = np.zeros_like(a)
    for c in range(3): bg[..., c] = G @ np.linalg.lstsq(X, a[ys, xs, c], rcond=None)[0]
    return bg


def body_of(k):
    m = k[..., 3] > 40; lab, n = ndimage.label(m)
    if n <= 1: return m
    sz = ndimage.sum(m, lab, range(1, n + 1)); return lab == (int(np.argmax(sz)) + 1)


def line_in(c, w):
    """The straightest run inside a piece where the blade merged with a smear: the strongest Hough line (weighted by the
    colour distance), the pixels within 3.5 px of it, the longest stretch along it with no gap over 6 px."""
    ys, xs = np.where(c); W = w[ys, xs]; best = None
    for ang in np.arange(0, 180, 1.0):
        th = np.deg2rad(ang); rho = xs * np.cos(th) + ys * np.sin(th); r0 = rho.min()
        h = np.convolve(np.bincount(np.round(rho - r0).astype(int), weights=W), np.ones(7), 'same'); i = int(h.argmax())
        if best is None or h[i] > best[0]: best = (h[i], th, i + r0)
    _, th, r = best
    on = np.abs(xs * np.cos(th) + ys * np.sin(th) - r) <= 3.5
    t = (-xs * np.sin(th) + ys * np.cos(th))[on]; o = np.argsort(t); ts = t[o]
    cut = np.where(np.diff(ts) > 6)[0]; starts = np.r_[0, cut + 1]; ends = np.r_[cut, len(ts) - 1]
    k = int(np.argmax(ts[ends] - ts[starts])); keep = np.zeros(len(ts), bool); keep[starts[k]:ends[k] + 1] = True
    sel = np.where(on)[0][o[keep]]; m = np.zeros_like(c); m[ys[sel], xs[sel]] = True
    return m


def blade_evidence(a, bg, body, lmax):
    """The one blade: the best thin, steel-coloured, nearly straight piece that starts at the body (the hands), reaches
    well out of it and is no longer than a blade — PixVerse's swing trails (curved arcs), cloth tatters and the green
    rim round the body are left out."""
    d = np.sqrt(((a - bg) ** 2).sum(2)); diff = a - bg
    cand = (d > 16) & ~ndimage.binary_dilation(body, iterations=2)
    lab, n = ndimage.label(cand, structure=np.ones((3, 3)))
    reach = ndimage.binary_dilation(body, iterations=10)
    dist = ndimage.distance_transform_edt(~body)
    best, best_score = None, 0
    for j in range(1, n + 1):
        c = lab == j; sz = c.sum()
        if sz < 30 or not (c & reach).any(): continue
        ys, xs = np.where(c); P = np.stack([xs, ys], 1).astype(float); Q = P - P.mean(0)
        ev, V = np.linalg.eigh(np.cov(Q.T)); el = np.sqrt(ev[1] / max(ev[0], 1e-3))
        if el < 4:                                                   # the blade merged with a smear: its straight run
            c = line_in(c, d)
            if c.sum() < 30: continue
            ys, xs = np.where(c); P = np.stack([xs, ys], 1).astype(float); Q = P - P.mean(0)
            ev, V = np.linalg.eigh(np.cov(Q.T)); el = np.sqrt(ev[1] / max(ev[0], 1e-3))
        u = V[:, 1]; t = Q @ u; L = t.max() - t.min()
        if el < 4 or L < 50 or L > lmax: continue
        strong = c & (d > 25)
        if strong.sum() < 15: continue
        dd = diff[strong]; red = (dd[:, 0] - dd[:, 2]).mean()
        if red > 40: continue                                        # red cloth
        s_ = Q @ np.array([-u[1], u[0]]); q = np.polyfit(t, s_, 2)
        if abs(q[0]) * (L / 2) ** 2 > 0.12 * L: continue             # a curved arc: a swing trail
        if dist[c].max() < 0.25 * lmax: continue                     # the green rim hugging the body: a blade reaches out
        e0, e1 = P[np.argmin(t)], P[np.argmax(t)]
        near = min(dist[int(e0[1]), int(e0[0])], dist[int(e1[1]), int(e1[0])])
        if near > 9: continue                                        # it must start at the hands
        score = L * d[strong].mean()
        if score > best_score: best, best_score = c, score
    return (best if best is not None else np.zeros_like(cand)), d


def fit_curve(mask, w, body):
    ys, xs = np.where(mask); P = np.stack([xs, ys], 1).astype(float); W = w[ys, xs] + 1
    c = (P * W[:, None]).sum(0) / W.sum(); Q = P - c
    ev, V = np.linalg.eigh(np.cov(Q.T, aweights=W)); u = V[:, 1]; nrm = np.array([-u[1], u[0]])
    t = Q @ u; s = Q @ nrm
    t0, t1 = np.percentile(t, 0.5), np.percentile(t, 99.5); L = abs(t1 - t0)
    q = np.polyfit(t, s, 2, w=np.sqrt(W))
    if abs(q[0]) * (L / 2) ** 2 > 0.035 * L: q = np.array([0.0, *np.polyfit(t, s, 1, w=np.sqrt(W))])  # a katana bends only a little
    pt = lambda tt: c + u * tt + nrm * np.polyval(q, tt)
    dist = ndimage.distance_transform_edt(~body)
    def dist_at(p):
        x, y = int(round(p[0])), int(round(p[1]))
        return dist[min(max(y, 0), dist.shape[0] - 1), min(max(x, 0), dist.shape[1] - 1)]
    if dist_at(pt(t1)) < dist_at(pt(t0)): t0, t1 = t1, t0          # t0 = the hand end
    step = np.sign(t0 - t1)
    for _ in range(40):                                             # reach back into the hand
        if dist_at(pt(t0)) <= 0.5: break
        t0 += step * 1.0
    return pt, t0, t1, q, u, nrm


def paint_blade(shape, pt, t0, t1, q, nrm, w0):
    H, W = shape; S = 4
    n = 64; T = np.linspace(t0, t1, n); C = np.array([pt(t) for t in T])
    tang = np.gradient(C, axis=0); tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    side = np.stack([-tang[:, 1], tang[:, 0]], 1)
    # the cutting edge on the outer (convex) side of the curve; a straight blade: the lower side
    curv = 2 * q[0] * (1 if t1 > t0 else -1)
    sgn = -np.sign(curv) if abs(q[0]) * (t1 - t0) ** 2 / 4 > 1.5 else (1 if side[n // 2, 1] > 0 else -1)
    edge_dir = side * sgn
    u = np.linspace(0, 1, n); wd = w0 * (1 - 0.4 * u); wd[u > 0.9] *= np.clip((1 - u[u > 0.9]) / 0.1, 0.05, 1)
    lay = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); dr = ImageDraw.Draw(lay)
    def poly(a_off, b_off, col, alpha=255):
        A = [tuple((C[i] + edge_dir[i] * wd[i] * a_off) * S) for i in range(n)]
        B = [tuple((C[i] + edge_dir[i] * wd[i] * b_off) * S) for i in reversed(range(n))]
        dr.polygon(A + B, fill=tuple(int(v) for v in col) + (alpha,))
    poly(-0.62, 0.5, LINE, 200)            # the dark line round the spine side
    poly(-0.5, 0.5, SPINE)                 # the spine half
    poly(-0.1, 0.5, STEEL)                 # the flat
    poly(0.22, 0.5, EDGE)                  # the bright cutting edge
    return np.array(lay.resize((W, H), Image.LANCZOS)).astype(np.float32)


def place(a, S, cx, bottom, out, W=1024):
    """integrate.place on a wider canvas: hips x 384, feet y 700 as usual, room for a blade held out in front (cut.py
    crops every frame to its picture and anchors it on x 384 / y 700, whatever the canvas width)."""
    im = Image.fromarray(a); im = im.resize((max(1, round(im.width * S)), max(1, round(im.height * S))), Image.LANCZOS)
    C = Image.new('RGBA', (W, 768), (0, 0, 0, 0)); C.paste(im, (round(384 - cx * S), round(700 - bottom * S)), im); C.save(out)


def over(top, bot):
    ta = top[..., 3:4] / 255; ba = bot[..., 3:4] / 255; oa = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], 2)


def despill(x):
    """--despill: no green left where the motion blur mixed the screen into the body (only for a hero with no green in
    the palette — never the archer)."""
    x[..., 1] = np.minimum(x[..., 1], np.maximum(x[..., 0], x[..., 2])); return x


def frame(path, w0, lmax, log=None, spill=False):
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    k = key(path).astype(np.float32); k = despill(k) if spill else k; body = body_of(k)
    out = k.copy(); out[..., 3] = np.where(body, out[..., 3], 0)
    bg = bg_model(a); ev, d = blade_evidence(a, bg, body, lmax)
    if not ev.any():
        if log is not None: log.append('none')
        return out.astype(np.uint8)
    kept = (k[..., 3] > 40) & ~body & ndimage.binary_dilation(ev, iterations=2)
    cover = kept.sum() / max(1, ev.sum())
    if cover > 0.6:                                                 # the key had it: join the painted pieces back
        out[..., 3] = np.where(body | kept, k[..., 3], 0)
        if log is not None: log.append(f'kept {cover:.2f}')
        return out.astype(np.uint8)
    pt, t0, t1, q, u, nrm = fit_curve(ev, d, body)
    blade = paint_blade(a.shape[:2], pt, t0, t1, q, nrm, w0)
    if log is not None: log.append(f'drawn len {abs(t1 - t0):.0f}')
    return np.clip(over(out, blade), 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('cls'); ap.add_argument('act'); ap.add_argument('idx')
    ap.add_argument('--width', type=float, default=8, help='width of the drawn blade at the hand, in video px')
    ap.add_argument('--sheet', help='a contact sheet of the placed frames')
    ap.add_argument('--despill', action='store_true', help='clear the green the blur left in the body (heroes without green)')
    ap.add_argument('--mirror', action='store_true', help='flip the clip (a move PixVerse turned round to face left)')
    ap.add_argument('--hips', choices=['ref', 'first'], default='ref', help="anchor x: the standing ref's hips, or the first chosen frame's (a move PixVerse shot after a step)")
    A = ap.parse_args(); idx = [int(x) for x in A.idx.split(',')]
    tmp = tempfile.mkdtemp()
    sel = '+'.join(f'eq(n\\,{i})' for i in sorted(set([0] + idx)))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', A.video, '-vf', f"select='{sel}'", '-vsync', '0', f'{tmp}/s_%03d.png'], check=True)
    order = sorted(set([0] + idx)); path = {i: f'{tmp}/s_{n + 1:03d}.png' for n, i in enumerate(order)}
    if A.mirror:                                                    # every frame flipped, the standing ref too: one transform
        for f in path.values(): Image.open(f).transpose(Image.FLIP_LEFT_RIGHT).save(f)
    k0 = key(path[0]); m0 = body_of(k0.astype(np.float32))
    ys = np.where(m0.any(1))[0]; S = 509.0 / (ys[-1] - ys[0]); hx = hip_x(m0); G = ys[-1]
    if A.hips == 'first': hx = hip_x(body_of(key(path[idx[0]]).astype(np.float32)))
    out = f'{ROOT}/tools/heroes/motion/{A.cls}'
    for f in glob.glob(f'{out}/{A.act}_[0-9]*.png'): os.remove(f)
    log = []
    for n, i in enumerate(idx, 1):
        place(frame(path[i], A.width, 0.62 * 509 / S, log, A.despill), S, hx, G, f'{out}/{A.act}_{n:02d}.png')
    print(A.cls, A.act, len(idx), 'frames, scale', round(S, 3), '|', ', '.join(f'{i}: {l}' for i, l in zip(idx, log)))
    if A.sheet:
        W = 192; sh = Image.new('RGB', (W * 4 // 3 * len(idx), W), (58, 58, 68))
        for n in range(len(idx)):
            im = Image.open(f'{out}/{A.act}_{n + 1:02d}.png').convert('RGBA').crop((0, 0, 1024, 768)).resize((W * 4 // 3, W), Image.LANCZOS)
            bgc = Image.new('RGBA', im.size, (58, 58, 68, 255)); bgc.alpha_composite(im); sh.paste(bgc.convert('RGB'), (n * W * 4 // 3, 0))
        sh.save(A.sheet, quality=90)


if __name__ == '__main__':
    main()
