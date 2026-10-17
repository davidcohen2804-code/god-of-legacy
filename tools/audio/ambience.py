#!/usr/bin/env python3
"""The PVP 3D temple courtyard's own sound (the living courtyard, Maps c7cdfe6f): a seamless stereo bed under the music
and its moments. The bed (amb_temple, 24 s, looped):

  the wind      gusting through the courtyard (one breath of the whole loop: calm, a rising gust, calm again)
  the crowns    the cherry trees rustling, left and right, harder in the gusts
  the pond      the koi pond's trickle under the left cherry trees (panned left), a koi breaking the surface now and then
  the banners   the banners on the colonnade and the nobori flapping in the strong gusts, left and right
  the shide     the shimenawa's paper streamers before the doors, a crisp rustle in the gusts
  the lanterns  the paper lanterns creaking on their cords when the gust swings them
  the birds     a few on the roofs, chirping now and then (high, a little far)
  the incense   a whisper of a crackle before the doors

The moments: birds_up_1..2 — the birds startled off the roofs into the air by a heavy blow's gust (the room's
`onLife('birds', at)`, played where the flock rises): a flurry of wings and alarm calls, flying off.

    python3 tools/audio/ambience.py        (needs numpy, scipy, ffmpeg)
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from impacts import SR, OUT, bp, brown, env, finish, hp, lp, write  # noqa: E402
from signatures import T, buf, creak, grains, place, rustle, slow, svf, wings  # noqa: E402

AMB = os.path.join(os.path.dirname(OUT), 'amb')
LOOP = 24.0   # the loop's length (s)
XF = 4.0      # its seam: the last XF s faded into the first


def gust(t):
    """The wind's strength through the loop (periodic in LOOP: the seam does not jump), 0.1 .. 1."""
    u = 2 * np.pi * t / LOOP
    return np.clip(0.42 + 0.26 * np.sin(u - 1.2) + 0.17 * np.sin(3 * u + 1.1) + 0.11 * np.sin(5 * u + 2.0), 0.1, 1.0)


def smooth_on(x, a, b):
    """0 below a, 1 above b, smooth between."""
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def pan(m, p):
    """A mono sound placed left (-1) .. right (1), equal power."""
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], axis=1)


def chirp(rng, f0, f1, dur, amp=1.0):
    """A small bird's chirp: a quick sweep with a harmonic, a soft start and a fast fall."""
    t = T(dur); f = f0 + (f1 - f0) * (t / dur) ** 0.7
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.25 * np.sin(2 * ph + 0.5)) * env(t, 0.004, dur * 0.35) * amp


def phrase(rng, amp=1.0):
    """A few chirps in a row (tsip-tsip-tsiu)."""
    n = int(rng.integers(2, 6)); x = buf(0.12 * n + 0.3); tm = 0.0
    base = rng.uniform(3200, 4600)
    for k in range(n):
        d = rng.uniform(0.035, 0.07); up = rng.random() < 0.6
        f0, f1 = (base * 0.85, base * 1.2) if up else (base * 1.15, base * 0.8)
        place(x, chirp(rng, f0, f1, d, rng.uniform(0.6, 1.0)), tm, amp)
        tm += d + rng.uniform(0.04, 0.11)
    return x


def tail(x, rng, sec=0.35, mix=0.25):
    """A little air round it (a short reverb: decaying noise), the far birds' distance."""
    ir = rng.standard_normal(int(SR * sec)) * np.exp(-np.arange(int(SR * sec)) / (SR * sec / 5))
    ir /= np.abs(ir).sum() / 4
    from scipy.signal import fftconvolve
    return x + mix * fftconvolve(x, ir)[:x.size]


def bed():
    rng = np.random.default_rng(2026_10_17)
    dur = LOOP + XF; t = T(dur); n = t.size; g = gust(t)
    L = np.zeros(n); R = np.zeros(n)
    # the wind: low air, each side its own, louder and brighter in the gusts
    for ch in (L, R):
        w = lp(brown(n, rng), 520); ch += w / (w.std() + 1e-9) * (0.35 + 0.75 * g) * 0.045  # (by its RMS: two draws of brown noise differ a lot at their peaks)
        ch += bp(rng.standard_normal(n), 280, 1300) * g ** 2 * 0.09
    # the cherry crowns: left and right, a crowd of leaf grains, harder in the gusts
    for ch, s in ((L, 11), (R, 12)):
        r = rustle(dur, np.random.default_rng(s), rate=900, lo=2600, hi=8500, amp=1.0)
        ch += r * (0.08 + 0.55 * smooth_on(g, 0.3, 0.9)) * 0.22
    # the koi pond (left): a gentle trickle and its bubbles; a koi breaking the surface twice in the loop
    pond = bp(rng.standard_normal(n), 900, 3800) * (0.55 + 0.25 * slow(rng, n, 0.7)) * 0.03
    times = np.sort(rng.uniform(0, dur, int(7.5 * dur)))
    for tm in times:
        d = rng.uniform(0.018, 0.034); f0 = rng.uniform(480, 1150); tt = T(d)
        b = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.7 * tt / d)) / SR) * env(tt, 0.002, d * 0.45)
        place(pond, b, tm, rng.uniform(0.03, 0.08))
    for tm in (5.3, 16.8):  # (a koi: a soft plop and a little slosh)
        tt = T(0.35)
        plop = np.sin(2 * np.pi * np.cumsum(240 * (1 + 1.2 * tt / 0.35)) / SR) * env(tt, 0.003, 0.05) * 0.12
        plop += bp(rng.standard_normal(tt.size), 600, 3000) * env(tt, 0.01, 0.08) * 0.07
        place(pond, plop, tm)
    P = pan(pond, -0.62); L += P[:, 0]; R += P[:, 1]
    # the banners and the nobori: cloth flapping in the strong gusts (a wandering flutter), one each side
    for side, s in ((-0.55, 21), (0.6, 22)):
        r2 = np.random.default_rng(s); fl = 11 + 3.5 * slow(r2, n, 0.5)
        ph = 2 * np.pi * np.cumsum(fl) / SR
        cloth = bp(r2.standard_normal(n), 170, 1500) * (0.5 + 0.5 * np.sin(ph)) ** 3 * smooth_on(g, 0.55, 0.85) * 0.16
        cloth += bp(r2.standard_normal(n), 700, 3000) * (0.5 + 0.5 * np.sin(ph * 2 + 1)) ** 6 * smooth_on(g, 0.62, 0.9) * 0.05  # (the snap at the edge)
        C = pan(cloth, side); L += C[:, 0]; R += C[:, 1]
    # the shimenawa's paper streamers: crisp, before the doors (centre), in the gusts
    shide = rustle(dur, np.random.default_rng(31), rate=260, lo=4200, hi=9500, amp=1.0) * smooth_on(g, 0.45, 0.85) * 0.06
    L += shide; R += shide
    # the paper lanterns creaking on their cords: a few swings at the gusts' peaks
    peaks = [tm for tm in np.arange(0, dur, 0.05) if gust(np.array([tm]))[0] > 0.8]
    picked = []
    for tm in peaks:
        if not picked or tm - picked[-1] > 2.5: picked.append(tm)
    for k, tm in enumerate(picked[:5]):
        cr = creak(rng.uniform(0.35, 0.6), np.random.default_rng(40 + k), f=rng.uniform(380, 620), rate=(30.0, 70.0), amp=1.0)
        cr = cr * np.sin(np.pi * np.linspace(0, 1, cr.size)) ** 2 * 0.05
        C = pan(cr, rng.uniform(-0.4, 0.4)); place(L, C[:, 0], tm); place(R, C[:, 1], tm)
    # the birds on the roofs: a few phrases through the loop, high and a little far, here and there across
    for tm in (1.6, 6.9, 10.4, 14.2, 19.5, 22.1):
        ph_ = tail(lp(phrase(rng, 1.0), 7500), rng) * 0.07
        C = pan(ph_, rng.uniform(-0.7, 0.7)); place(L, C[:, 0], tm); place(R, C[:, 1], tm)
    # the incense: a whisper of a crackle before the doors
    inc = grains(n, np.sort(rng.uniform(0, dur, int(2.5 * dur))), rng.uniform(0.3, 1, int(2.5 * dur)),
                 [hp(rng.standard_normal(int(SR * 0.002)), 3500) * np.exp(-np.arange(int(SR * 0.002)) / (SR * 0.0004))], rng) * 0.012
    L += inc; R += inc
    # the seam: the last XF s faded into the first (equal power)
    x = np.stack([L, R], axis=1); k = int(SR * XF); m = int(SR * LOOP)
    a = np.sin(np.linspace(0, np.pi / 2, k))[:, None]
    out = x[:m].copy(); out[:k] = x[:k] * a + x[m:m + k] * np.cos(np.linspace(0, np.pi / 2, k))[:, None]
    return out


def birds_up(seed):
    """The birds startled off the roofs: a flurry of wings beating, rising and flying off, alarm calls among them."""
    rng = np.random.default_rng(seed); dur = 2.0; x = buf(dur)
    for b in range(9):
        t0 = rng.uniform(0, 0.22); rate = rng.uniform(9, 13); fly = rng.uniform(0.7, 1.3)
        beats = t0 + np.arange(0, fly, 1 / rate); beats = beats + rng.uniform(-0.01, 0.01, beats.size)
        w = wings(list(beats), rng, f=rng.uniform(380, 650), amp=1.0, size=0.45)
        w = w * np.exp(-np.arange(w.size) / (SR * rng.uniform(0.45, 0.7)))  # (flying off: fainter)
        place(x, w, 0, rng.uniform(0.35, 0.6))
    for k in range(int(rng.integers(2, 5))):  # (alarm calls: sharp, quick)
        place(x, chirp(rng, rng.uniform(4200, 5200), rng.uniform(3000, 3600), rng.uniform(0.05, 0.08), 0.5), rng.uniform(0.02, 0.5))
    x = lp(x, 6000) + hp(x, 6000) * 0.4
    return finish(tail(x, rng, 0.4, 0.3), 0.85, 60, 1.3)


def a_rms(x):
    """How loud it is heard: the RMS through the A-weighting curve (the mix of both channels)."""
    from scipy.signal import bilinear, lfilter
    f1, f2, f3, f4 = 20.598997, 107.65265, 737.86223, 12194.217
    num = [(2 * np.pi * f4) ** 2 * (10 ** (1.9997 / 20)), 0, 0, 0, 0]
    den = np.convolve(np.convolve(np.convolve([1, 4 * np.pi * f4, (2 * np.pi * f4) ** 2], [1, 4 * np.pi * f1, (2 * np.pi * f1) ** 2]), [1, 2 * np.pi * f3]), [1, 2 * np.pi * f2])
    b, a = bilinear(num, den, SR)
    m = x.mean(axis=1) if x.ndim == 2 else x
    return float(np.sqrt(np.mean(lfilter(b, a, m) ** 2)))


def write_amb(name, x, loud=0.07):
    """A stereo bed into public/assets/audio/amb (ogg + mp3), as loud as the other stages' beds (A-weighted), its peaks held."""
    x = x * (loud / (a_rms(x) + 1e-9))
    pk = np.abs(x).max()
    if pk > 0.8: x = 0.86 * np.tanh(x / 0.86)  # (rare peaks held softly; the quiet bed unchanged)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav')
        wavfile.write(w, SR, (x * 32767).astype(np.int16))
        for ext, args in (('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])):
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, *args, os.path.join(AMB, f'{name}.{ext}')], check=True)
    print(name, f'{x.shape[0] / SR:.2f} s', 'stereo')


if __name__ == '__main__':
    write_amb('amb_temple', bed())
    import impacts
    impacts.OUT = AMB
    for i, s in enumerate((71, 72), 1):
        write(f'birds_up_{i}', birds_up(s))
