#!/usr/bin/env python3
"""Each class's signature skills, a sound of their own (synthesised for the game; .ogg + .mp3 into
public/assets/audio/sfx/, like the other effects). Each class keeps one palette and every skill in it its own idea:

  warrior (wr_)  a greatsword's weight (low, wide whooshes; steel that clanks), holy gold light, the storm, the titan
  samurai (sm_)  a katana's thin bright steel (quick swishes that ring), sakura, ink, the dark and the crimson dragon
  archer  (ar_)  the bow (wood, string, the arrow's whistle and thunk), wind and leaves, fire, the sky full of arrows
  mage    (bm_)  arcane chimes (FM bells), starlight, lightning, frost, the clock of time
  gambler (gb_)  the staff (wood), cards (flick, riffle, snap), the casino (chips, coins, bells, the slot machine)

Per skill: `_c` its cast (the swing / shot / spell, timed so its strike lands with the skill's first blow), `_h` its main
hit (under the arena's boom), `_w` a wind-up at the start of a big one, a basic chain one cast per stage. What plays
when is ArenaSound's SIG table; this script prints each sound's measured loudness (the base volumes in Sound.ts come
from it: every cast about as loud as the class swings were, every hit as the class impacts).

    python3 tools/audio/signatures.py [name ...]     (needs numpy, scipy, ffmpeg with libvorbis and libmp3lame)
"""
import os
import sys

import numpy as np
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from impacts import SR, bp, brown, env, finish, glide, hp, lp, write  # noqa: E402

R = np.random.default_rng


# ---------------------------------------------------------------- the toolkit

def T(sec):
    return np.arange(int(round(SR * sec))) / SR


def buf(sec):
    return np.zeros(int(round(SR * sec)))


def place(b, x, start, amp=1.0):
    """Mix x into b from `start` s (its last few ms faded: a piece cut short never clicks)."""
    i = int(round(start * SR))
    n = min(x.size, b.size - i)
    if n > 0:
        y = x[:n] * amp
        k = min(n, int(SR * 0.006))
        y[n - k:] = y[n - k:] * np.linspace(1, 0, k)
        b[i:i + n] += y
    return b


def rise(t, a):
    return np.clip(t / max(a, 1e-5), 0, 1)


def svf(x, fc, q=1.0, mode='bp'):
    """A state-variable filter whose cutoff (and Q) may move every sample (a blade's sweep, a gust rising)."""
    n = x.size
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    q = np.broadcast_to(np.asarray(q, dtype=float), (n,))
    g = np.tan(np.pi * np.clip(fc, 20.0, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k)); a2 = g * a1; a3 = g * a2
    A1, A2, A3, X = a1.tolist(), a2.tolist(), a3.tolist(), x.tolist()
    B = [0.0] * n; L = [0.0] * n
    c1 = c2 = 0.0
    for i in range(n):
        v3 = X[i] - c2
        v1 = A1[i] * c1 + A2[i] * v3
        v2 = c2 + A2[i] * c1 + A3[i] * v3
        c1 = 2.0 * v1 - c1; c2 = 2.0 * v2 - c2
        B[i] = v1; L[i] = v2
    band = np.asarray(B); low = np.asarray(L)
    if mode == 'bp':
        return band * k  # (unity at the centre)
    if mode == 'lp':
        return low
    return x - k * band - low


def swoosh(dur, f0, f1, f2, rng, peak=0.45, q=2.0, shape=2.0, tail=4.5, whistle=0.0, wq=18.0):
    """A blade through the air: noise through a band that follows its speed (f0 -> f1 at the fastest -> f2), loudest at
    `peak` (a fraction of dur); `whistle`: the edge singing (a narrow band riding the same sweep)."""
    t = T(dur); u = t / dur
    up = np.clip(u / peak, 0, 1); dn = np.clip((u - peak) / (1 - peak), 0, 1)
    fc = np.where(u < peak, f0 * (f1 / f0) ** up, f1 * (f2 / f1) ** dn)
    a = np.where(u < peak, up ** shape, np.exp(-dn * tail))
    x = svf(rng.standard_normal(t.size), fc, q) * a
    if whistle:
        x += svf(rng.standard_normal(t.size), fc * 1.55, wq) * a * whistle * np.sqrt(wq / 2)
    n = min(t.size, int(SR * 0.004)); x[-n:] *= np.linspace(1, 0, n)
    return x


def air(dur, peak, tail, rng, f=260, amp=0.5):
    """The weight behind a big swing: low moving air."""
    t = T(dur); u = t / dur
    a = np.where(u < peak, (u / peak) ** 2, np.exp(-(u - peak) / (1 - peak) * tail))
    return lp(brown(t.size, rng), f) * a * amp * 0.8


def ring(dur, f0, parts, rng, att=0.0006, beat=0.0, glide_to=1.0, gtau=0.08):
    """Struck metal: partials (ratio, amp, decay s) — `beat`: each one doubled a hair off (it shimmers); `glide_to`:
    the pitch bends there (a rising cut's ring)."""
    t = T(dur); x = np.zeros_like(t)
    bend = glide_to + (1 - glide_to) * np.exp(-t / gtau)
    for r, a, tau in parts:
        ph = rng.uniform(0, 2 * np.pi)
        w = 2 * np.pi * np.cumsum(f0 * r * bend) / SR
        x += a * np.sin(w + ph) * np.exp(-t / tau)
        if beat:
            x += a * 0.5 * np.sin(w * (1 + beat) + ph + 1.0) * np.exp(-t / tau)
    return x * rise(t, att)


def thud(dur, f0, f1, tau, ftau=0.03, att=0.002):
    t = T(dur)
    return np.sin(glide(t, f0, f1, ftau)) * env(t, att, tau)


def hiss(dur, lo, hi, att, tau, rng):
    t = T(dur)
    return bp(rng.standard_normal(t.size), lo, min(hi, SR * 0.45)) * env(t, att, tau)


def click(dur, rng, f=3000, tau=0.0015, amp=1.0):
    t = T(dur)
    return hp(rng.standard_normal(t.size), f) * env(t, 0.0002, tau) * amp


def knock(dur, f, tau, rng, click_amp=0.5):
    """Wood: a damped tone and a short click on top."""
    t = T(dur)
    tone = np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / tau) * rise(t, 0.0004)
    c = bp(rng.standard_normal(t.size), 1200, 4500) * np.exp(-t / 0.003) * click_amp
    return tone + c


def pluck(dur, f, rng, decay=0.993, bright=0.6):
    """A plucked string (Karplus-Strong): a bow's string."""
    n = int(SR * dur); N = max(2, int(round(SR / f)))
    seed = rng.uniform(-1, 1, N)
    sm = np.convolve(seed, [0.25, 0.5, 0.25], 'same')
    b = (bright * seed + (1 - bright) * sm).tolist()
    y = [0.0] * n
    for i in range(n):
        y[i] = b[i] if i < N else decay * 0.5 * (y[i - N] + y[i - N - 1])
    y = np.asarray(y)
    return y - lp(y, 30)


def bell(dur, f, ratio=1.4, index=2.0, tau=0.5, itau=0.12, att=0.0008):
    """An FM bell (the mage's chimes, the casino's dings)."""
    t = T(dur)
    i = index * np.exp(-t / itau)
    return np.sin(2 * np.pi * f * t + i * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / tau) * rise(t, att)


def saw(f, cap=6000.0):
    """A band-limited sawtooth following the frequency f (an array)."""
    f = np.asarray(f, float)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k_max = int(cap / max(20.0, f.min()))
    x = np.zeros_like(ph)
    for k in range(1, k_max + 1):
        w = np.clip((cap - k * f) / (0.25 * cap), 0, 1)
        if not w.any():
            break
        x += w * np.sin(k * ph) / k
    return x


def formants(x, fs):
    """A voice's vowel: bands (centre, gain, width)."""
    y = np.zeros_like(x)
    for f, g, w in fs:
        y += bp(x, max(30, f - w / 2), f + w / 2, order=2) * g
    return y


def taiko(dur, rng, f0=150, f1=72, tau=0.3, slap=0.6):
    t = T(dur)
    m1 = np.sin(glide(t, f0, f1, 0.05)) * env(t, 0.002, tau)
    m2 = np.sin(glide(t, f0 * 1.59, f1 * 1.59, 0.05) + 0.7) * env(t, 0.002, tau * 0.35) * 0.35
    s = lp(rng.standard_normal(t.size), 1400) * env(t, 0.0008, 0.012) * slap
    return m1 + m2 + s


GONG = [(1.0, 1.0, 1.8), (1.48, 0.6, 1.3), (1.99, 0.5, 1.1), (2.43, 0.35, 0.8), (2.97, 0.3, 0.6), (3.49, 0.22, 0.45), (4.12, 0.15, 0.3)]
BELL = [(0.5, 0.55, 2.2), (1.0, 0.7, 1.4), (1.19, 0.45, 1.0), (1.5, 0.35, 0.8), (2.0, 0.5, 0.7), (2.51, 0.3, 0.45), (3.0, 0.22, 0.35), (4.07, 0.15, 0.22)]


def clink(dur, rng, f=None, amp=1.0):
    """A coin / a chip: small, bright, inharmonic."""
    t = T(dur); f = f or rng.uniform(3000, 6500)
    x = np.zeros_like(t)
    for r, a, tau in ((1, 1, rng.uniform(0.04, 0.12)), (1.52 + rng.uniform(-0.05, 0.05), 0.55, 0.05), (2.33, 0.35, 0.03), (3.1, 0.2, 0.018)):
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    x += hp(rng.standard_normal(t.size), 4000) * env(t, 0.0003, 0.0015) * 0.5
    return x * rise(t, 0.0003) * amp


def flick(rng, snap=1.0, air_amp=0.45):
    """A card off the thumb: the snap, then its air (fft)."""
    t = T(0.08)
    x = hp(rng.standard_normal(t.size), 2500) * env(t, 0.0002, 0.0022) * snap
    x += bp(rng.standard_normal(t.size), 1500, 6500) * env(t, 0.002, 0.022) * air_amp
    return x


def grains(n, times, amps, kernels, rng):
    """Many small sounds (clicks, crackles, thunks): each time one of the kernels."""
    out = np.zeros(n)
    times = np.asarray(times, float); amps = np.broadcast_to(np.asarray(amps, float), times.shape)
    which = rng.integers(len(kernels), size=times.size)
    for j, k in enumerate(kernels):
        imp = np.zeros(n)
        for tm, a in zip(times[which == j], amps[which == j]):
            i = int(tm * SR)
            if 0 <= i < n:
                imp[i] += a
        if imp.any():
            out += fftconvolve(imp, k)[:n]
    return out


def slow(rng, n, f):
    """Slow random wandering (std 1): a flicker, a flutter, a roughness."""
    y = lp(rng.standard_normal(n), f, order=2)
    return y / (y.std() + 1e-12)


def crackle_kernels(rng, hpf=2500, taus=(0.0008, 0.0015, 0.0025)):
    ks = []
    for tau in taus:
        t = T(tau * 8)
        ks.append(hp(rng.standard_normal(t.size), hpf) * np.exp(-t / tau))
    return ks


def arc(dur, rng, f=95.0, jit=0.3, cap=4000, hpf=350, flicker=True):
    """An electric arc: a buzz whose pitch jumps, flickering on and off."""
    t = T(dur)
    hold = np.repeat(rng.uniform(1 - jit, 1 + jit, int(dur * 220) + 2), SR // 220 + 1)[:t.size]
    x = hp(saw(f * hold, cap=cap), hpf)
    if flicker:
        g = (slow(rng, t.size, 90) > -0.7).astype(float)
        x *= lp(g, 400)
    return x


def rustle(dur, rng, rate=400, lo=2500, hi=9000, amp=1.0):
    """Leaves / petals / paper: a dense crowd of tiny bright grains."""
    n = T(dur).size
    times = np.sort(rng.uniform(0, dur, int(rate * dur)))
    k = [bp(rng.standard_normal(int(SR * 0.012)), lo, hi) * np.exp(-np.arange(int(SR * 0.012)) / SR / tau) for tau in (0.0015, 0.003, 0.005)]
    return grains(n, times, rng.uniform(0.2, 1, times.size), k, rng) * amp


def flange(x, d0=0.0008, d1=0.006, rate=1.2, mix=0.9):
    """A sweeping comb (the mage's wave: noise that sings as it passes)."""
    t = np.arange(x.size) / SR
    d = d0 + (d1 - d0) * (0.5 - 0.5 * np.cos(2 * np.pi * rate * t))
    return x + mix * np.interp(t - d, t, x, left=0)


def growl(dur, rng, f0=70, f1=120, f2=80, amp=1.0):
    """A dragon's roar: a rough low voice (pitch up, then down), its throat (formants) and breath."""
    t = T(dur); u = t / dur
    f = np.where(u < 0.35, f0 + (f1 - f0) * np.clip(u / 0.35, 0, 1) ** 0.7, f1 + (f2 - f1) * np.clip((u - 0.35) / 0.65, 0, 1) ** 1.4)
    f = f * (1 + 0.05 * slow(rng, t.size, 25))  # (rough)
    src = saw(f, cap=5000) + saw(f * 0.5, cap=2500) * 0.6  # (a subharmonic: bigger than a man)
    breath = lp(rng.standard_normal(t.size), 3000) * (0.5 + 0.5 * np.sin(np.cumsum(2 * np.pi * f) / SR))
    v = formants(src * 0.7 + breath * 0.5, ((520, 1.0, 180), (950, 0.7, 220), (2400, 0.35, 400), (3300, 0.15, 500)))
    a = np.where(u < 0.12, (u / 0.12) ** 1.5, np.where(u < 0.6, 1.0, np.cos(np.pi / 2 * np.clip((u - 0.6) / 0.4, 0, 1)) ** 2))
    return v * a * amp


def whistle(dur, f0, f1, rng, q=30.0):
    """An arrow's whistle (a narrow band of air gliding in pitch)."""
    t = T(dur)
    fc = f0 * (f1 / f0) ** (t / dur)
    a = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    y = svf(rng.standard_normal(t.size), fc, q)
    return y / (y.std() + 1e-12) * 0.35 * a


def reverse(x, fade=0.004):
    y = x[::-1].copy()
    n = int(SR * fade); y[:n] *= np.linspace(0, 1, n)
    return y


def chord_pad(dur, freqs, att, tau, cap=4000, vib=0.0):
    t = T(dur); x = np.zeros_like(t)
    for i, f in enumerate(freqs):
        fv = f * (1 + vib * np.sin(2 * np.pi * (5 + i * 0.3) * t + i))
        x += saw(np.full(t.size, 1.0) * fv, cap=cap) * (1 / (1 + i * 0.25))
    return x * env(t, att, tau)


# ---------------------------------------------------------------- WARRIOR: the Judge — a greatsword's weight, holy gold light, the storm, the titan

def wr_swing(seed, f0, f1, f2, dur, peak, body=0.5, whistle=0.1):
    rng = R(seed); x = buf(dur + 0.06)
    place(x, swoosh(dur, f0, f1, f2, rng, peak=peak, q=2.2, shape=2.2, tail=6.0, whistle=whistle, wq=14) + air(dur, peak, 6.0, rng, 240, body), 0)
    return x


def wr_iron_1():  # Iron Chain 1: a slash (the cast is timed so the swing's peak lands on the blow: lead 150 ms)
    return finish(wr_swing(101, 220, 1250, 420, 0.34, 0.45), 0.85, 1.3)


def wr_iron_2():  # 2: the backhand (a hair higher)
    return finish(wr_swing(102, 260, 1450, 470, 0.32, 0.47), 0.85, 1.3)


def wr_iron_3():  # 3: the double cut (two blades 170 ms apart)
    x = buf(0.52)
    place(x, wr_swing(103, 240, 1350, 450, 0.3, 0.45), 0)
    place(x, wr_swing(104, 290, 1600, 520, 0.3, 0.45), 0.17, 0.9)
    return finish(x, 0.85, 1.3)


def wr_iron_4():  # 4: the finisher — wound up, heavier, lower, the blade turning in his hands first (a short scrape)
    rng = R(105); x = wr_swing(105, 160, 980, 300, 0.5, 0.55, body=0.85, whistle=0.06)
    scrape = svf(rng.standard_normal(int(SR * 0.12)), np.linspace(2600, 3400, int(SR * 0.12)), 9) * env(T(0.12), 0.02, 0.04) * 0.25
    place(x, scrape, 0.02)
    return finish(x, 0.86, 1.35)


def wr_iron_hit(seed):  # a blow of the chain: steel cleaving in — a dull clank, the slap, the weight
    rng = R(seed); t = T(0.42)
    x = thud(0.42, 170, 70, 0.06, 0.025)
    x += bp(rng.standard_normal(t.size), 500, 3200) * env(t, 0.0008, 0.02) * 0.9
    x += ring(0.42, rng.uniform(950, 1150), [(1, 0.5, 0.05), (1.73, 0.4, 0.035), (2.61, 0.3, 0.025), (3.9, 0.18, 0.015)], rng) * 0.6
    x += click(0.42, rng, 3500, 0.004, 0.5)
    return finish(x, 0.85, 1.6)


def wr_iron_fin():  # the finisher's blow: KLANG-thud, the long stun in it
    rng = R(106); t = T(0.75)
    x = thud(0.75, 140, 52, 0.11, 0.035) * 1.1
    x += bp(rng.standard_normal(t.size), 300, 2500) * env(t, 0.001, 0.035)
    x += ring(0.75, 640, [(1, 0.5, 0.14), (1.62, 0.45, 0.1), (2.47, 0.35, 0.08), (3.33, 0.25, 0.05), (4.71, 0.15, 0.03)], rng, beat=0.004) * 0.6
    x += click(0.75, rng, 3000, 0.005, 0.6)
    return finish(x, 0.86, 1.7)


def wr_rise_c():  # Rising Slash: the blade sweeps up through the three cuts (vwoo-SHIING, rising)
    rng = R(110); dur = 0.6
    x = swoosh(dur, 300, 3000, 3800, rng, peak=0.42, q=2.4, shape=1.8, tail=6, whistle=0.4, wq=16)
    x += air(dur, 0.4, 6, rng, 300, 0.35)
    t = T(dur)
    x += np.sin(2 * np.pi * np.cumsum(700 * (1 + 1.2 * np.clip(t / 0.3, 0, 1))) / SR) * env(t, 0.12, 0.12) * 0.3  # (the steel's glide up)
    return finish(x, 0.85, 1.3)


def wr_rise_h():  # the launch: a bright TCHING, and the air lifting him
    rng = R(111); x = buf(0.75); t = T(0.75)
    place(x, ring(0.75, 2350, [(1, 0.6, 0.18), (1.41, 0.45, 0.12), (2.08, 0.3, 0.08), (2.9, 0.2, 0.05)], rng, beat=0.003, glide_to=1.05, gtau=0.1), 0)
    place(x, thud(0.5, 190, 80, 0.05), 0, 0.85)
    place(x, click(0.3, rng, 2500, 0.006, 0.7), 0)
    place(x, swoosh(0.45, 500, 2600, 3200, rng, peak=0.3, q=2.5, tail=4), 0.02, 0.6)
    return finish(x, 0.86, 1.5)


def wr_quake_c():  # Ground Breaker: the heave down (falling; lead 300 ms: it peaks on the smash)
    rng = R(120); dur = 0.42; x = buf(0.5)
    place(x, swoosh(dur, 1100, 500, 180, rng, peak=0.75, q=1.6, shape=2.5, tail=7) + air(dur, 0.78, 7, rng, 200, 0.9), 0)
    return finish(x, 0.85, 1.3)


def wr_quake_h():  # the smash: stone splits, rubble, then the living quake rolling under the floor (~1.5 s)
    rng = R(121); t = T(1.7); x = buf(1.7)
    x += thud(1.7, 120, 40, 0.18, 0.05) * 1.2
    x += lp(rng.standard_normal(t.size), 1800) * env(t, 0.001, 0.05) * 1.2
    for s, a in ((0.0, 1.0), (0.025, 0.7), (0.06, 0.5)):
        place(x, hp(rng.standard_normal(int(SR * 0.15)), 700) * env(T(0.15), 0.0008, 0.02), s, a)
    times = 0.03 + rng.exponential(0.12, 40); times = times[times < 0.6]
    ks = [knock(0.05, f, 0.012, rng, 0.6) for f in (380, 520, 700)]
    x += grains(t.size, times, 0.35 * np.exp(-times / 0.25), ks, rng)  # (rubble)
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * 7.5 * t + 0.3 * np.sin(2 * np.pi * 1.3 * t))
    shape = np.clip(t / 0.08, 0, 1) * np.exp(-np.maximum(0, t - 0.25) / 0.55)
    x += lp(brown(t.size, rng), 110) * trem * shape * 1.4  # (the quake following you)
    x += lp(rng.standard_normal(t.size), 400) * trem * shape * 0.12
    return finish(x, 0.86, 1.5)


def wr_rush_c():  # Impaling Rush: the charge across the arena — a jet of wind building, the blade dragging, his feet
    rng = R(130); dur = 0.6; t = T(dur); x = buf(dur)
    x += swoosh(dur, 220, 950, 650, rng, peak=0.62, q=1.6, shape=1.2, tail=6) + air(dur, 0.6, 6, rng, 220, 0.6)
    scrape = sum(svf(rng.standard_normal(t.size), f, 22) for f in (1200, 2650, 4100))
    x += scrape * (0.14 + 0.2 * np.clip(t / 0.4, 0, 1)) * np.exp(-np.maximum(0, t - 0.4) / 0.05) * (0.6 + 0.4 * (lp(rng.standard_normal(t.size), 40) > 0))
    for s in (0.06, 0.18, 0.3, 0.42):
        place(x, thud(0.12, 120, 60, 0.03) + click(0.12, rng, 1500, 0.004, 0.3), s, 0.85)
    return finish(x, 0.84, 1.3)


def wr_rush_h():  # he rips it upward in a burst of light: a tearing rip, a holy major chord flashing, the air up
    rng = R(131); dur = 1.35; t = T(dur); x = buf(dur)
    rip = svf(rng.standard_normal(int(SR * 0.16)), np.linspace(800, 4200, int(SR * 0.16)), 1.6) * env(T(0.16), 0.002, 0.05)
    place(x, rip, 0, 1.1)
    place(x, thud(0.4, 160, 60, 0.07), 0, 0.9)
    light = np.zeros_like(t)
    for f, a in ((440, 0.5), (554.4, 0.4), (659.3, 0.4), (880, 0.35), (1318.5, 0.2)):
        for h, ha in ((1, 1), (2, 0.35), (3, 0.15)):
            light += a * ha * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6))
    x += light * env(t, 0.006, 0.42) * 0.3
    for k in range(9):  # (sparkles of it)
        place(x, bell(0.35, rng.choice([1760, 2217, 2637, 3520]), ratio=2.0, index=1.0, tau=0.12), 0.03 + k * 0.035, 0.12)
    place(x, swoosh(0.5, 600, 3000, 3600, rng, peak=0.3, q=2, tail=4), 0.02, 0.5)
    return finish(x, 0.86, 1.45)


def wr_storm_w():  # Blade Storm, the wind-up: the sword raised to the sky (a rising ring), the thunder gathering
    rng = R(140); dur = 0.7; t = T(dur); x = buf(dur)
    x += ring(dur, 1800, [(1, 0.5, 0.25), (1.5, 0.3, 0.2), (2.3, 0.2, 0.15)], rng, att=0.08, beat=0.003, glide_to=1.4, gtau=0.25) * 0.5
    x += lp(brown(t.size, rng), 90) * np.clip(t / 0.32, 0, 1) ** 1.5 * np.exp(-np.maximum(0, t - 0.32) / 0.1) * 1.2
    times = 0.2 + rng.exponential(0.1, 10); x += grains(t.size, times, rng.uniform(0.1, 0.35, 10), crackle_kernels(rng), rng)
    return finish(x, 0.82, 1.3)


def wr_storm_c():  # the storm: lightning crackling round him and light swords erupting from the floor all around (2.6 s), and
    # the vortex of crimson spectral swords whirling round it, closing in, flung up at the end
    rng = R(141); dur = 3.6; t = T(dur); x = buf(dur)
    drone = (lp(brown(t.size, rng), 70) * 1.2 + np.sin(2 * np.pi * 49 * t) * 0.25) * env(t, 0.15, 0.9)
    x += drone
    for k in range(15):  # (each sword: a quick rising ring and its own small whoosh)
        s = 0.02 + k * 0.09 + rng.uniform(-0.02, 0.03)
        f = rng.uniform(2200, 4200)
        sw = ring(0.5, f, [(1, 0.6, rng.uniform(0.12, 0.25)), (1.5, 0.35, 0.1), (2.2, 0.2, 0.06)], rng, beat=0.004, glide_to=1.08, gtau=0.03)
        place(sw, swoosh(0.08, 900, 4200, 4500, rng, peak=0.8, q=2.5, tail=3), 0, 0.8)
        place(x, sw, s, 0.4 * (1 - 0.35 * k / 15))
    times = rng.uniform(0, 2.3, 60); x += grains(t.size, times, rng.uniform(0.1, 0.5, 60) * np.exp(-times / 1.4), crackle_kernels(rng), rng)
    for s in (0.25, 0.9, 1.6):  # (arcs of lightning)
        place(x, arc(0.09, rng, f=rng.uniform(80, 120)) * env(T(0.09), 0.002, 0.04), s, 0.3)
    # the vortex of crimson spectral swords whirling round the storm (a sword past the front every 220 ms), closing in —
    # quicker and nearer — then flung up at its end (2.6 s)
    vr = R(143); tm = 0.08; k = 0
    while tm < 2.55:
        near = min(1.0, tm / 2.6)
        sw = swoosh(0.16, 500, 2400 + 900 * near, 1200, vr, peak=0.5, q=2.4, tail=5, whistle=0.3, wq=16)
        place(x, sw + flames(0.16, vr, 0.25, 4) * env(T(0.16), 0.03, 0.05), tm, 0.22 + 0.16 * near)
        tm += 0.22 * (1 - 0.18 * near); k += 1
    place(x, swoosh(0.45, 300, 3200, 4200, vr, peak=0.35, q=1.8, shape=1.6, tail=4) + air(0.45, 0.35, 4, vr, 300, 0.6), 2.6, 0.75)  # (flung up)
    place(x, ring(0.6, 1650, [(1, 0.4, 0.16), (1.5, 0.3, 0.1), (2.0, 0.2, 0.07)], vr, att=0.01, glide_to=1.25, gtau=0.12), 2.62, 0.3)
    return finish(x, 0.84, 1.3)


def wr_storm_h():  # a light sword strikes: TZZING, the snap of it
    rng = R(142); dur = 0.85; x = buf(dur)
    place(x, ring(dur, 3100, [(1, 0.6, 0.2), (1.42, 0.4, 0.14), (2.0, 0.3, 0.09), (2.83, 0.15, 0.05)], rng, beat=0.005), 0)
    place(x, click(0.2, rng, 2000, 0.005, 0.9), 0)
    place(x, arc(0.06, rng, f=110) * env(T(0.06), 0.001, 0.025), 0.0, 0.5)
    place(x, thud(0.35, 170, 70, 0.05), 0, 0.8)
    return finish(x, 0.85, 1.5)


def wr_titan_w():  # Titan's Verdict, the wind-up (0.77 s, the music already ducking): his roar and the titan of light rising
    rng = R(150); dur = 0.8; t = T(dur); u = t / dur
    sw = (u ** 2.2) * np.clip((dur - t) / 0.03, 0, 1)
    pitch = 1 + 0.03 * u
    chord = np.zeros_like(t)
    for f, a in ((73.4, 1.0), (110, 0.8), (146.8, 0.7), (185, 0.55), (220, 0.5), (293.7, 0.3)):
        chord += saw(f * pitch * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + f)), cap=4500) * a
    voice = formants(chord, ((650, 1.0, 160), (1080, 0.6, 200), (2650, 0.35, 380))) * 2.2
    sub = np.sin(2 * np.pi * np.cumsum(36 + 20 * u) / SR) * 0.6
    rush = svf(rng.standard_normal(t.size), 200 * (1800 / 200) ** u, 1.4) * 0.5
    return finish((voice + sub + rush) * sw, 0.84, 1.25)


def wr_titan_h():  # the giant sword driven into the floor: a colossal bell of judgment, the crunch, the golden shockwave
    rng = R(151); dur = 3.0; t = T(dur); x = buf(dur)
    x += ring(dur, 98.0, [(r, a, min(tau, 0.9)) for r, a, tau in BELL], rng, att=0.002, beat=0.002) * 0.9
    x += thud(dur, 110, 38, 0.3, 0.06) * 1.0
    x += lp(rng.standard_normal(t.size), 2000) * env(t, 0.001, 0.08) * 1.1
    for s, a in ((0, 1), (0.03, 0.6)):
        place(x, hp(rng.standard_normal(int(SR * 0.2)), 600) * env(T(0.2), 0.0008, 0.03), s, a)
    place(x, swoosh(0.75, 3000, 900, 350, rng, peak=0.15, q=1.2, tail=3.5), 0.03, 0.7)
    return finish(x, 0.87, 1.4)


def wr_titan_end():  # the last blow (the knockdown): the struck floor's lightning — KZZT, the floor taking it
    rng = R(152); dur = 0.85; t = T(dur); x = buf(dur)
    place(x, arc(0.3, rng, f=85, jit=0.4) * env(T(0.3), 0.002, 0.12), 0, 0.7)
    times = rng.exponential(0.12, 30); x += grains(t.size, times, rng.uniform(0.2, 0.6, 30) * np.exp(-times / 0.3), crackle_kernels(rng), rng)
    place(x, thud(0.7, 120, 42, 0.16, 0.05), 0, 1.0)
    place(x, click(0.2, rng, 1200, 0.008, 0.9), 0)
    return finish(x, 0.86, 1.5)


# ---------------------------------------------------------------- SAMURAI: thin bright steel, sakura, ink, the dark, the crimson dragon

def sm_swish(seed, dur=0.16, f0=1400, f1=6500, f2=2600, peak=0.4, whistle=0.25):
    x = buf(dur + 0.04)
    return place(x, swoosh(dur, f0, f1, f2, R(seed), peak=peak, q=3.5, shape=1.8, tail=6, whistle=whistle, wq=25), 0)


def sm_quick_1():  # Quick Slash 1 (lead 60 ms)
    return finish(sm_swish(201), 0.84, 1.2)


def sm_quick_2():  # 2: the backhand
    return finish(sm_swish(202, f0=1600, f1=7000, f2=3000), 0.84, 1.2)


def sm_quick_3():  # 3: the cross cut (two blades 60 ms apart)
    x = buf(0.26); place(x, sm_swish(203, 0.15), 0); place(x, sm_swish(204, 0.15, 1800, 7600, 3200), 0.06, 0.9)
    return finish(x, 0.84, 1.2)


def sm_quick_4():  # 4: the rising cut (it lifts him): rising, and a thin ring gliding up
    rng = R(205); x = buf(0.42); place(x, sm_swish(205, 0.26, 1200, 7500, 9000, peak=0.42, whistle=0.3), 0)
    place(x, ring(0.36, 3200, [(1, 0.3, 0.1), (1.5, 0.2, 0.07)], rng, att=0.04, glide_to=1.2, gtau=0.08) * 0.35, 0.05)
    return finish(x, 0.84, 1.2)


def sm_quick_hit(seed):  # a cut landing: tsk-shk (bright, short; the steel just rings)
    rng = R(seed); t = T(0.28)
    x = click(0.28, rng, 2800, 0.008, 1.0)
    x += ring(0.28, rng.uniform(3200, 3600), [(1, 0.4, 0.035), (1.5, 0.3, 0.025), (2.05, 0.2, 0.015)], rng)
    x += thud(0.28, 220, 110, 0.025) * 0.6
    x += bp(rng.standard_normal(t.size), 1000, 5000) * env(t, 0.001, 0.02) * 0.6
    return finish(x, 0.85, 1.5)


def sm_quick_fin():  # the rising cut lands (the launch): tsching~ and the air
    rng = R(206); x = buf(0.85)
    place(x, click(0.3, rng, 2500, 0.01, 1.0), 0)
    place(x, ring(0.85, 3000, [(1, 0.55, 0.22), (1.47, 0.4, 0.15), (2.13, 0.25, 0.09), (2.9, 0.15, 0.05)], rng, beat=0.003, glide_to=1.04), 0)
    place(x, thud(0.3, 200, 90, 0.04), 0, 0.7)
    place(x, swoosh(0.3, 1500, 6000, 7000, rng, peak=0.3, q=3, tail=4), 0.01, 0.4)
    return finish(x, 0.86, 1.5)


HUNDRED = 0.0538  # (Hundred Cuts' blows in the arena: 54 ms apart, the last at 673 ms)


def sm_hundred_c():  # Hundred Cuts: a storm of cuts (one on each blow) over a whirr, rising into the last (lead 36 ms)
    rng = R(210); dur = 0.8; t = T(dur); x = buf(dur)
    for k in range(12):
        f1 = 6200 + 900 * (k % 3) + rng.uniform(-300, 300)
        place(x, sm_swish(211 + k, 0.09, 1800, f1, 3000, peak=0.4, whistle=0.2), k * HUNDRED, 0.55 + 0.45 * k / 11)
    whirr = bp(rng.standard_normal(t.size), 700, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi / HUNDRED * t)) * env(t, 0.15, 0.5) * 0.3
    x += whirr * np.clip((0.66 - t) / 0.03, 0, 1)
    place(x, swoosh(0.1, 1500, 7000, 7000, rng, peak=0.95, q=3, tail=3), 0.6, 0.7)
    return finish(x, 0.84, 1.2)


def sm_hundred_h():  # the last cut blasts him away: ZAN! and a taiko under it
    rng = R(220); dur = 1.45; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1500) * env(t, 0.0006, 0.03) * 1.2
    x += ring(dur, 2250, [(1, 0.7, 0.35), (1.47, 0.5, 0.25), (2.13, 0.35, 0.15), (2.89, 0.25, 0.1)], rng, beat=0.002) * 0.7
    x += taiko(dur, rng, 150, 72, 0.35, 0.7) * 1.0
    place(x, swoosh(0.35, 1200, 5000, 3000, rng, peak=0.2, q=2, tail=4), 0.0, 0.5)
    return finish(x, 0.87, 1.5)


def sm_swallow_c():  # Swallow Cut: a crescent rising, then turning back like a swallow (a chirp of it in the air)
    rng = R(230); x = buf(0.42)
    place(x, sm_swish(231, 0.2, 1300, 7000, 8500, peak=0.5, whistle=0.3), 0)
    place(x, sm_swish(232, 0.2, 6000, 2400, 1000, peak=0.3, whistle=0.25), 0.13, 0.9)
    for s, f0, f1 in ((0.06, 5200, 6400), (0.17, 6400, 5000), (0.21, 5600, 6600)):
        t = T(0.05); place(x, np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * t / 0.05) / SR) * np.sin(np.pi * t / 0.05) ** 2 * 0.16, s)
    return finish(x, 0.84, 1.2)


def sm_swallow_h():  # the crescent throws him up: a ring bending upward, the lift
    rng = R(233); x = buf(0.85)
    place(x, click(0.2, rng, 2600, 0.008, 0.9), 0)
    place(x, ring(0.85, 2600, [(1, 0.6, 0.25), (1.5, 0.4, 0.16), (2.2, 0.25, 0.1)], rng, beat=0.003, glide_to=1.07, gtau=0.12), 0)
    place(x, thud(0.3, 190, 85, 0.04), 0, 0.7)
    place(x, swoosh(0.4, 900, 4500, 5500, rng, peak=0.35, q=2.4, tail=4), 0.02, 0.55)
    return finish(x, 0.86, 1.5)


def sm_shadow_c():  # Shadow Step: a blink — the air drawn in backwards and cut off (the pass), a low displacement, ink
    rng = R(240); x = buf(0.46)
    pre = reverse(swoosh(0.16, 600, 4800, 6000, rng, peak=0.25, q=2.2, tail=4))
    place(x, pre, 0)
    place(x, thud(0.2, 110, 45, 0.06), 0.15, 0.8)
    place(x, lp(rng.standard_normal(int(SR * 0.3)), 900) * env(T(0.3), 0.004, 0.1), 0.155, 0.45)
    return finish(x, 0.84, 1.3)


def sm_shadow_h():  # the cut as he passes: shk, and a splash of ink
    rng = R(241); dur = 0.38; t = T(dur); x = buf(dur)
    x += click(dur, rng, 3000, 0.006, 0.9)
    x += ring(dur, 3400, [(1, 0.35, 0.05), (1.5, 0.25, 0.03)], rng)
    splash = bp(rng.standard_normal(t.size), 400, 2600) * env(t, 0.006, 0.09) * (0.7 + 0.3 * np.sin(2 * np.pi * 31 * t))
    place(x, splash, 0.02, 0.7)
    x += thud(dur, 200, 90, 0.035) * 0.6
    return finish(x, 0.85, 1.4)


def sm_iai_w():  # Iai Strike, the hand on the sheath: the thumb pushes the guard (a crisp click), a glint
    rng = R(250); x = buf(0.9)
    place(x, ring(0.15, 3800, [(1, 0.5, 0.02), (1.55, 0.35, 0.012)], rng) + click(0.15, rng, 3000, 0.001, 0.8), 0)
    place(x, bell(0.85, 5200, ratio=2.0, index=0.6, tau=0.2, att=0.01) * 0.25, 0.05)
    return finish(x, 0.7, 1.1)


def sm_iai_c():  # the lightning draw: a flick of air and SHIIING
    rng = R(251); x = buf(1.6)
    place(x, swoosh(0.07, 2000, 9000, 9000, rng, peak=0.6, q=3, tail=3) * 0.9, 0)
    place(x, ring(1.55, 2900, [(1, 0.8, 0.45), (1.5, 0.5, 0.32), (2.2, 0.35, 0.22), (3.1, 0.2, 0.14)], rng, att=0.004, beat=0.0025), 0.03, 0.45)
    return finish(x, 0.84, 1.2)


def sm_iai_h():  # the decisive cut: zan — a beat — the dull drum of it, a crimson spray
    rng = R(252); dur = 1.25; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1800) * env(t, 0.0005, 0.025) * 1.1
    x += ring(dur, 2700, [(1, 0.5, 0.2), (1.5, 0.3, 0.14)], rng, beat=0.002) * 0.4
    place(x, taiko(1.1, rng, 120, 58, 0.3, 0.4), 0.09, 1.0)
    spray = hp(rng.standard_normal(t.size), 3000) * env(t, 0.03, 0.22) * (0.6 + 0.4 * (lp(rng.standard_normal(t.size), 30) > 0))
    place(x, spray, 0.04, 0.22)
    return finish(x, 0.86, 1.5)


def sm_blossom_c():  # Blossom Storm: a swirl of petals and afterimages — a gust fluttering, a koto line rising on the cuts
    rng = R(260); dur = 1.1; t = T(dur); x = buf(dur)
    flutter = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(18 + 5 * slow(rng, t.size, 5)) / SR)
    x += bp(rng.standard_normal(t.size), 800, 4200) * flutter * env(t, 0.25, 0.22) * 0.6
    x += rustle(dur, rng, 300, 3000, 9000, 0.25) * env(t, 0.1, 0.25)
    for k, (s, f) in enumerate(((0.0, 587.3), (0.14, 698.5), (0.28, 784.0), (0.42, 880.0))):
        place(x, pluck(0.5, f, R(261 + k), decay=0.992, bright=0.7) * env(T(0.5), 0.001, 0.25), s, 0.7)
        place(x, pluck(0.5, f * 2, R(271 + k), decay=0.99, bright=0.5) * env(T(0.5), 0.001, 0.15), s + 0.012, 0.25)
        place(x, sm_swish(265 + k, 0.1, 2000, 7000, 3500, whistle=0.15), s, 0.15)
    for k in range(6):  # (wind chimes in the gust)
        place(x, bell(0.5, rng.choice([1760.0, 2093.0, 2349.3, 2637.0]), ratio=2.76, index=0.5, tau=0.15), 0.1 + rng.uniform(0, 0.5), 0.08)
    return finish(x, 0.84, 1.25)


def sm_blossom_h():  # the last cut throws him high: a burst of blossom chimes, petals flung up, the slice
    rng = R(270); dur = 1.6; t = T(dur); x = buf(dur)
    for f, a in ((1174.7, 1.0), (1760, 0.8), (1396.9, 0.7), (2093, 0.5), (2637, 0.35)):
        place(x, bell(dur, f, ratio=3.5, index=1.2, tau=0.55, itau=0.08), rng.uniform(0, 0.02), 0.18 * a)
    place(x, click(0.2, rng, 2500, 0.009, 1.0), 0)
    place(x, thud(0.4, 190, 80, 0.05), 0, 0.75)
    place(x, swoosh(0.55, 700, 4000, 5000, rng, peak=0.3, q=1.8, tail=3.5), 0.01, 0.6)
    x += rustle(dur, rng, 500, 3000, 9000, 0.3) * env(t, 0.02, 0.3)
    return finish(x, 0.86, 1.4)


def sm_eclipse_w():  # Dragon Eclipse, the dark (1.35 s): a deep drone, a gong swelling backwards into the moment, a heartbeat
    rng = R(280); dur = 1.38; t = T(dur); u = t / dur
    x = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.4 * t) * 0.3 + lp(saw(np.full(t.size, 55.0), 3000), 800) * 0.6) * u ** 1.3
    g = ring(1.6, 98, GONG, rng, beat=0.003)
    x += reverse(g)[-t.size:] * 0.9
    for s in (0.42, 0.56, 0.92, 1.06):
        place(x, thud(0.25, 70, 45, 0.07), s, 0.45)
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def sm_eclipse_c():  # eight cuts out of the dark from eight sides (34 ms apart), then the air drawn for the colossal one
    rng = R(281); dur = 0.46; x = buf(dur)
    for k in range(8):
        place(x, sm_swish(282 + k, 0.07, 2200, 8000 + 600 * (k % 2), 3500, peak=0.4, whistle=0.2), k * 0.034, 0.75 + 0.25 * (k % 2))
    place(x, reverse(swoosh(0.12, 800, 5000, 6000, rng, peak=0.3, q=2, tail=4)), 0.21, 0.6)
    return finish(x, 0.84, 1.25)


def sm_eclipse_h():  # the crimson dragon's cut: its roar, the colossal slice, the great drum
    rng = R(290); dur = 2.1; t = T(dur); x = buf(dur)
    place(x, growl(1.0, rng, 68, 118, 75), 0.02, 0.9)
    x += hp(rng.standard_normal(t.size), 1200) * env(t, 0.0006, 0.04) * 1.2
    x += ring(dur, 1600, [(1, 0.6, 0.4), (1.47, 0.45, 0.3), (2.13, 0.3, 0.2), (2.89, 0.2, 0.12)], rng, beat=0.003) * 0.55
    x += taiko(dur, rng, 110, 52, 0.5, 0.8) * 1.1
    place(x, swoosh(0.6, 2500, 600, 300, rng, peak=0.12, q=1.2, tail=3), 0.0, 0.5)
    return finish(x, 0.87, 1.4)


# ---------------------------------------------------------------- ARCHER: the bow (wood, string, whistle, thunk), wind and leaves, fire, the sky full of arrows

def twang(rng, f=145, dur=0.22, decay=0.99, thwip=1.0, whistle_amp=0.12):
    """A bow shot: the string, the thwip of the release, the arrow's whistle leaving."""
    x = buf(dur + 0.12)
    s = pluck(dur, f, rng, decay=decay, bright=0.75) * env(T(dur), 0.0005, dur * 0.35)
    place(x, s, 0, 0.9)
    place(x, hp(rng.standard_normal(int(SR * 0.05)), 1800) * env(T(0.05), 0.0004, 0.01), 0, 0.6 * thwip)
    place(x, thud(0.08, 160, 90, 0.015), 0, 0.35 * thwip)
    place(x, whistle(0.14, 3300, 2500, rng, 20), 0.01, whistle_amp)
    return x


def ar_double_c():  # Double Shot: two fast arrows (70 ms apart)
    x = buf(0.42); place(x, twang(R(301), 145), 0); place(x, twang(R(302), 162), 0.07, 0.9)
    return finish(x, 0.84, 1.3)


def ar_charged_c():  # the charged arrow: the bow drawn hard (it creaks), a deep twang, the arrow tearing off (lead 160 ms)
    rng = R(303); x = buf(0.62)
    times = np.sort(0.16 * (1 - rng.random(22) ** 1.7))
    kn = [knock(0.03, f, 0.006, rng, 0.3) for f in (240, 330, 410)]
    place(x, grains(int(SR * 0.17), times, rng.uniform(0.2, 0.5, 22) * (0.4 + times / 0.16), kn, rng), 0)
    place(x, svf(rng.standard_normal(int(SR * 0.16)), 380, 12) * env(T(0.16), 0.1, 0.05) * 0.3, 0)
    place(x, twang(rng, 105, 0.3, 0.993, thwip=1.4, whistle_amp=0.18), 0.16)
    place(x, swoosh(0.3, 600, 3200, 2400, rng, peak=0.2, q=2, tail=4), 0.16, 0.6)
    return finish(x, 0.84, 1.3)


def ar_arrow_hit(seed):  # an arrow thunks in
    rng = R(seed); dur = 0.24; t = T(dur)
    x = click(dur, rng, 2500, 0.001, 0.9)
    x += np.sin(2 * np.pi * rng.uniform(600, 760) * t) * env(t, 0.0004, 0.018) * 0.7
    x += thud(dur, 180, 90, 0.03) * 0.7
    x += bp(rng.standard_normal(t.size), 600, 3000) * env(t, 0.001, 0.012) * 0.5
    return finish(x, 0.85, 1.5)


def ar_charged_h():  # the charged arrow hits: a heavy THOCK and a gust of leaves
    rng = R(305); dur = 0.65; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2000, 0.0015, 1.0)
    x += knock(dur, 420, 0.035, rng, 0.8) * 0.9
    x += thud(dur, 140, 55, 0.09, 0.03) * 1.0
    x += ring(dur, 310, [(1, 0.5, 0.18), (2.0, 0.3, 0.12), (3.01, 0.2, 0.08)], rng, att=0.003) * 0.35  # (the shaft humming in him)
    return finish(x, 0.86, 1.5)


def ar_rise_c():  # Rising Arrow: an arrow strikes the floor, a column of wind rises (swirling, leaves in it)
    rng = R(310); dur = 1.0; t = T(dur); x = buf(dur)
    place(x, knock(0.12, 380, 0.02, rng, 0.9) + click(0.12, rng, 2200, 0.0012, 0.7), 0)
    fc = 250 * (2400 / 250) ** np.clip(t / 0.55, 0, 1)
    swirl = 0.65 + 0.35 * np.sin(2 * np.pi * 8 * t)
    x += svf(rng.standard_normal(t.size), fc, 3.0) * swirl * env(t, 0.12, 0.22) * 1.5
    x += svf(rng.standard_normal(t.size), fc * 1.8 * (1 + 0.04 * np.sin(2 * np.pi * 8 * t)), 25) * env(t, 0.15, 0.2) * 3.0  # (the vortex whistling)
    x += rustle(dur, rng, 350, 2500, 8000, 0.35) * env(t, 0.25, 0.18)
    return finish(x, 0.84, 1.3)


def ar_rise_h():  # the wind throws him up: a gust bursting upward, leaves scattering
    rng = R(311); dur = 0.6; t = T(dur); x = buf(dur)
    place(x, swoosh(0.45, 400, 2600, 3200, rng, peak=0.28, q=1.8, tail=4), 0, 1.0)
    x += rustle(dur, rng, 600, 2500, 9000, 0.4) * env(t, 0.01, 0.2)
    x += thud(dur, 160, 70, 0.05) * 0.7
    return finish(x, 0.85, 1.4)


def flames(dur, rng, amp=1.0, crackles=40):
    t = T(dur)
    roar = lp(brown(t.size, rng), 700) * np.clip(0.7 + 0.3 * slow(rng, t.size, 14), 0.2, 1.3)
    times = rng.uniform(0, dur, crackles)
    cr = grains(t.size, times, rng.uniform(0.1, 0.6, crackles), crackle_kernels(rng, 1800, (0.0006, 0.0012, 0.002)), rng)
    return (roar + cr) * amp


def ar_fire_c():  # Fireball Arrow: the twang, the arrow catching fire (fwoomp), the fireball roaring away
    rng = R(320); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, twang(rng, 130, 0.22), 0, 0.8)
    ign = lp(rng.standard_normal(t.size), 1200) * env(t, 0.03, 0.15)
    x += ign * 0.9
    x += flames(dur, rng, 0.9, 30) * env(t, 0.04, 0.25)
    return finish(x, 0.84, 1.35)


def ar_fire_h():  # it bursts: KA-BOOM, the fire roaring on, crackling down
    rng = R(321); dur = 1.6; t = T(dur); x = buf(dur)
    n = rng.standard_normal(t.size)
    x += svf(n, 300 + 7700 * np.exp(-t / 0.08), 0.8, 'lp') * env(t, 0.001, 0.12) * 1.3
    x += thud(dur, 90, 35, 0.25, 0.05) * 1.1
    x += flames(dur, rng, 1.0, 70) * env(t, 0.02, 0.45) * 0.9
    return finish(x, 0.87, 1.5)


def ar_storm_c():  # Hunter's Rain: dozens of arrows loosed into the sky — a volley of twangs, a cloud of whistles going up
    rng = R(330); dur = 1.15; t = T(dur); x = buf(dur)
    for k in range(7):
        place(x, twang(R(331 + k), rng.uniform(120, 175), 0.18, whistle_amp=0.0), k * 0.035 + rng.uniform(0, 0.01), 0.55)
    for k in range(18):
        s = rng.uniform(0.03, 0.55); d = rng.uniform(0.35, 0.6); f0 = rng.uniform(2300, 3600)
        place(x, whistle(d, f0, f0 * 1.35, rng, 28), s, 0.16 * (1 - s))
    place(x, swoosh(0.6, 400, 2200, 3000, rng, peak=0.3, q=1.3, tail=3), 0.02, 0.5)
    return finish(x, 0.84, 1.3)


def ar_storm_h():  # the last of the rain: a cluster of thunks
    rng = R(340); dur = 0.45; t = T(dur); x = buf(dur)
    for k in range(6):
        place(x, ar_arrow_hit(341 + k), rng.uniform(0, 0.09), 0.5)
    x += thud(dur, 150, 60, 0.06) * 0.7
    return finish(x, 0.85, 1.5)


def ar_volley_c():  # Air Volley: the leap (hup, the air), five shots from the air on its five arrows (in the arena), each a bit higher
    rng = R(350); dur = 0.95; x = buf(dur)
    place(x, swoosh(0.4, 300, 1600, 800, rng, peak=0.35, q=1.5, tail=4) + air(0.4, 0.35, 4, rng, 300, 0.6), 0, 0.8)
    for k, s in enumerate((0.073, 0.207, 0.341, 0.475, 0.609)):
        place(x, twang(R(351 + k), 150 + 9 * k, 0.2, whistle_amp=0.16), s, 0.75)
    return finish(x, 0.84, 1.3)


def ar_volley_h():  # the last arrow of the volley lands: a thunk with a green zing
    rng = R(360); x = buf(0.6)
    place(x, ar_arrow_hit(361), 0, 0.9)
    place(x, bell(0.58, 2800, ratio=2.01, index=1.5, tau=0.13), 0.005, 0.3)
    place(x, thud(0.3, 160, 65, 0.05), 0, 0.6)
    return finish(x, 0.85, 1.5)


def ar_skyrain_w():  # Sky Rain, the wind-up (0.8 s): she races across the screen (a rush past, her feet), the bow drawn to the sky
    rng = R(370); dur = 0.85; t = T(dur); x = buf(dur)
    place(x, swoosh(0.6, 500, 2600, 700, rng, peak=0.42, q=1.3, shape=1.6, tail=3.5), 0, 1.0)
    for k in range(8):
        place(x, thud(0.06, 150, 90, 0.015) + click(0.06, rng, 2500, 0.002, 0.3) + knock(0.06, 230, 0.01, rng, 0.4) * 0.5, 0.05 + k * 0.058, 0.75)
    times = np.sort(0.56 + 0.2 * (1 - rng.random(14) ** 1.6))
    kn = [knock(0.03, f, 0.006, rng, 0.3) for f in (250, 340)]
    x += grains(t.size, times, rng.uniform(0.15, 0.4, 14), kn, rng)
    place(x, np.sin(2 * np.pi * np.cumsum(1500 * (2.1 ** (T(0.25) / 0.25))) / SR) * np.sin(np.pi * T(0.25) / 0.25) ** 2 * 0.1, 0.58)
    return finish(x, 0.83, 1.3)


def ar_skyrain_c():  # the whole sky pours arrows: a cloud of whistles coming down, the air full, the patter growing
    rng = R(371); dur = 1.8; t = T(dur); x = buf(dur)
    for k in range(60):
        s = abs(rng.normal(0.55, 0.35)) % 1.3; d = rng.uniform(0.35, 0.6); f0 = rng.uniform(3600, 4800)
        place(x, whistle(d, f0, f0 * 0.42, rng, 30), s, rng.uniform(0.06, 0.12))
    x += lp(rng.standard_normal(t.size), 3000) * env(t, 0.5, 0.6) * 0.18
    times = 0.2 + rng.uniform(0, 1.4, 90) ** 1.2; times = times[times < dur]
    ks = [knock(0.04, f, 0.01, rng, 0.8) for f in (520, 640, 780)]
    x += grains(t.size, times, rng.uniform(0.1, 0.35, times.size) * np.clip(times / 1.2, 0.2, 1), ks, rng)
    x *= np.exp(-np.maximum(0, t - 1.5) / 0.08)
    return finish(x, 0.84, 1.3)


def ar_skyrain_h():  # the last wave crashes down on them: arrows hammering in, the floor shaking, leaves and dust
    rng = R(380); dur = 1.0; t = T(dur); x = buf(dur)
    times = rng.uniform(0, 0.13, 30)
    ks = [knock(0.05, f, 0.012, rng, 1.0) for f in (480, 620, 760)]
    x += grains(t.size, times, rng.uniform(0.3, 0.7, 30), ks, rng)
    x += thud(dur, 110, 45, 0.25, 0.05) * 1.1
    x += lp(rng.standard_normal(t.size), 1500) * env(t, 0.002, 0.06) * 0.8
    x += lp(brown(t.size, rng), 300) * env(t, 0.01, 0.35) * 0.6  # (the floor shaking, dust)
    return finish(x, 0.87, 1.5)


# ---------------------------------------------------------------- BOOK MAGE: arcane chimes, starlight, lightning, frost, the clock of time

def bm_bolt(seed, f0=2200, f1=800):
    rng = R(seed); dur = 0.4; t = T(dur); x = buf(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x += np.sin(ph + 2.5 * np.exp(-t / 0.06) * np.sin(ph * 1.5)) * env(t, 0.002, 0.07) * 0.8
    x += bp(rng.standard_normal(t.size), 1500, 5000) * env(t, 0.004, 0.05) * 0.35
    for k in range(3):
        place(x, bell(0.12, rng.uniform(4000, 7000), ratio=2.0, index=1.0, tau=0.04), 0.01 + 0.02 * k, 0.15)
    return finish(x, 0.84, 1.3)


def bm_bolt_c1():  # Arcane Bolt: a bolt (pew, with a sparkle)
    return bm_bolt(401)


def bm_bolt_c2():  # the second bolt, a hair higher
    return bm_bolt(402, 2500, 900)


def bm_lance_c():  # the arcane lance: a whine charging (lead 150 ms), then VWOOM and its bright trail
    rng = R(403); dur = 0.7; x = buf(dur)
    tc = T(0.15)
    whine = np.sin(2 * np.pi * np.cumsum(600 * (3 ** (tc / 0.15))) / SR) * (tc / 0.15) ** 2 * 0.3
    place(x, whine, 0)
    t2 = T(0.55)
    sub = np.sin(glide(t2, 90, 45, 0.08)) * env(t2, 0.003, 0.12)
    ph = 2 * np.pi * 180 * t2
    growl_ = np.sin(ph + 4 * np.exp(-t2 / 0.15) * np.sin(ph * 0.5)) * env(t2, 0.003, 0.12) * 0.5
    trail = bp(rng.standard_normal(t2.size), 2000, 7000) * env(t2, 0.005, 0.2) * 0.35
    place(x, sub + growl_ + trail, 0.15)
    return finish(x, 0.85, 1.35)


def bm_bolt_h(seed=410):  # a bolt lands: a crystalline pop
    rng = R(seed); dur = 0.55; t = T(dur)
    x = bell(dur, rng.uniform(2400, 2800), ratio=2.76, index=2.0, tau=0.11) * 0.8
    x += bp(rng.standard_normal(t.size), 1000, 4000) * env(t, 0.001, 0.015) * 0.6
    x += thud(dur, 200, 100, 0.025) * 0.6
    return finish(x, 0.85, 1.4)


def bm_lance_h():  # the lance hits: a shimmering burst, a deep whump, a glassy ring
    rng = R(420); dur = 1.3; t = T(dur); x = buf(dur)
    for k in range(8):
        place(x, bell(1.2, rng.uniform(1500, 6000), ratio=rng.choice([1.4, 2.76, 3.5]), index=1.5, tau=rng.uniform(0.15, 0.3)), rng.uniform(0, 0.08), 0.13)
    x += thud(dur, 110, 50, 0.15, 0.04) * 1.0
    x += ring(dur, 2100, [(1, 0.5, 0.4), (2.76, 0.25, 0.2)], rng) * 0.3
    x += bp(rng.standard_normal(t.size), 600, 5000) * env(t, 0.001, 0.03) * 0.7
    return finish(x, 0.86, 1.4)


def bm_wave_c():  # Arcane Wave: a wide wave across the floor — air that sings as it sweeps (a moving comb), a low hum
    rng = R(430); dur = 0.85; t = T(dur)
    n = bp(rng.standard_normal(t.size), 300, 4000)
    x = flange(n, 0.0006, 0.005, rate=1.4) * env(t, 0.06, 0.22) * 0.9
    x += (np.sin(2 * np.pi * 98 * t) + 0.6 * np.sin(2 * np.pi * 147 * t)) * env(t, 0.05, 0.16) * 0.35
    return finish(x, 0.84, 1.3)


def bm_wave_h():  # it lifts him: a soft whomp and a sparkle rising (three chimes)
    rng = R(431); dur = 0.9; t = T(dur); x = buf(dur)
    x += thud(dur, 130, 60, 0.1) * 0.9
    x += lp(rng.standard_normal(t.size), 500) * env(t, 0.003, 0.05) * 0.6
    for k, f in enumerate((1318.5, 1661.2, 1975.5)):
        place(x, bell(0.75, f, ratio=3.5, index=1.0, tau=0.2), 0.02 + k * 0.05, 0.3)
    return finish(x, 0.85, 1.4)


def bm_astral_c():  # Astral Lift: a hand of starlight reaching (a glitter swelling in backwards) and seizing him (hwump)
    rng = R(440); dur = 0.6; x = buf(dur)
    g = buf(0.3)
    for k in range(14):
        place(g, bell(0.25, rng.uniform(2000, 6500), ratio=2.0, index=1.0, tau=0.08), rng.uniform(0, 0.08), 0.2)
    place(x, reverse(g), 0)
    t2 = T(0.25)
    place(x, np.sin(glide(t2, 150, 70, 0.04)) * env(t2, 0.002, 0.06) + lp(rng.standard_normal(t2.size), 600) * env(t2, 0.002, 0.03) * 0.5, 0.25, 0.9)
    return finish(x, 0.84, 1.3)


def bm_astral_h():  # the starlight throws him up: a deep whoom, stars cascading, a shimmering chord
    rng = R(441); dur = 1.6; t = T(dur); x = buf(dur)
    x += thud(dur, 70, 38, 0.25, 0.05) * 1.0
    x += lp(rng.standard_normal(t.size), 400) * env(t, 0.002, 0.1) * 0.7
    for k in range(40):
        s = rng.exponential(0.22)
        if s < 1.0:
            place(x, bell(0.35, rng.uniform(2000, 8000), ratio=2.0, index=0.8, tau=0.06), s, 0.12 * np.exp(-s / 0.5))
    pad = sum(bell(dur, f, ratio=1.0, index=0.4, tau=0.45, itau=0.3, att=0.01) for f in (523.3, 659.3, 784.0, 987.8))
    x += pad * 0.12
    return finish(x, 0.86, 1.35)


def zap(rng, dur=0.06, amp=1.0):
    return (arc(dur, rng, f=rng.uniform(90, 140)) * env(T(dur), 0.001, dur * 0.4) + click(dur, rng, 2500, 0.002, 0.6)) * amp


def bm_chain_c():  # Lightning Chain: the charge snapping out (lead 40 ms), then the leaps to the next foes (100 ms apart)
    rng = R(450); dur = 0.62; t = T(dur); x = buf(dur)
    place(x, arc(0.05, rng, 70) * (T(0.05) / 0.05) ** 2 * 0.5, 0)
    for k, s in enumerate((0.14, 0.24, 0.34, 0.44)):
        place(x, zap(rng, 0.07, 0.55 * (1 - 0.15 * k)), s)
    x += grains(t.size, rng.uniform(0.04, 0.5, 30), rng.uniform(0.05, 0.25, 30), crackle_kernels(rng), rng)
    return finish(x, 0.82, 1.3)


def bm_chain_h():  # the lightning seizes him: KRZZAK, the arc buzzing on him
    rng = R(451); dur = 0.72; t = T(dur); x = buf(dur)
    x += click(dur, rng, 1000, 0.006, 1.0)
    x += svf(rng.standard_normal(t.size), 800 + 5200 * np.exp(-t / 0.05), 0.8, 'lp') * env(t, 0.001, 0.05) * 0.6
    place(x, arc(0.45, rng, f=120, jit=0.45, cap=6000) * env(T(0.45), 0.002, 0.2), 0.01, 1.0)
    x += grains(t.size, rng.exponential(0.12, 40), rng.uniform(0.1, 0.5, 40), crackle_kernels(rng), rng)
    x += thud(dur, 80, 40, 0.12) * 0.5
    return finish(x, 0.86, 1.5)


def ice_thrust(rng):
    dur = 0.3; t = T(dur); x = buf(dur)
    x += grains(t.size, rng.uniform(0, 0.03, 30), rng.uniform(0.2, 0.6, 30), crackle_kernels(rng, 3500, (0.0005, 0.001)), rng)
    x += click(dur, rng, 2500, 0.005, 0.8)
    f = rng.uniform(3200, 4400)
    x += np.sin(2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 40 * t))) / SR) * env(t, 0.002, 0.07) * 0.25
    x += thud(dur, 160, 80, 0.03) * 0.6
    return x


def bm_spikes_c():  # Glacial Spikes: three rows of ice bursting up from the floor (crunch, crack, a glassy screech), frost
    rng = R(460); dur = 0.85; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.06, 0.12)):
        place(x, ice_thrust(rng), s, 0.8 - 0.1 * k)
    x += hp(rng.standard_normal(t.size), 4000) * env(t, 0.05, 0.18) * 0.2
    return finish(x, 0.84, 1.35)


def bm_spikes_h():  # an ice spike throws him up, chilled: the crack, a glassy tinkle, the knock
    rng = R(461); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, ice_thrust(rng), 0, 1.0)
    for k in range(10):
        s = rng.exponential(0.12)
        if s < 0.5:
            place(x, bell(0.25, rng.uniform(3000, 8000), ratio=2.76, index=0.6, tau=0.05), s, 0.15)
    x += thud(dur, 150, 65, 0.06) * 0.8
    return finish(x, 0.85, 1.5)


def bm_field_c():  # Storm Field: a field of storm — whirling wind, an electric hum, its pulses (vwump-tzz, 240 ms apart in the arena) drawing them in
    rng = R(470); dur = 1.05; t = T(dur); x = buf(dur)
    wind = bp(rng.standard_normal(t.size), 400, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 4 * t)) * env(t, 0.2, 0.8) * 0.6
    hum = lp(saw(np.full(t.size, 60.0), 1200) + 0.5 * saw(np.full(t.size, 120.4), 1200), 900) * env(t, 0.15, 0.9) * 0.3
    x += wind + hum * (0.8 + 0.2 * (lp(rng.standard_normal(t.size), 20) > 0))
    for s in (0.0, 0.24, 0.48):
        place(x, thud(0.3, 120, 55, 0.09), s, 0.8); place(x, zap(rng, 0.05, 0.4), s, 0.8)
    x += grains(t.size, rng.uniform(0, 0.75, 30), rng.uniform(0.05, 0.25, 30), crackle_kernels(rng), rng)
    x *= np.exp(-np.maximum(0, t - 0.74) / 0.08)
    return finish(x, 0.84, 1.3)


def bm_field_h():  # the last pulse throws them up: a thunderclap (KRA-KA-BOOM), the rumble
    rng = R(471); dur = 1.25; t = T(dur); x = buf(dur)
    for s, a in ((0.0, 1.0), (0.03, 0.7), (0.07, 0.5)):
        place(x, click(0.2, rng, 800, 0.008, a), s)
    x += svf(rng.standard_normal(t.size), 150 + 2500 * np.exp(-t / 0.1), 0.8, 'lp') * env(t, 0.002, 0.3) * 1.2
    roll = 0.6 + 0.4 * np.sin(2 * np.pi * 3.3 * t) * np.sin(2 * np.pi * 1.1 * t)
    x += lp(brown(t.size, rng), 160) * env(t, 0.02, 0.5) * roll * 1.5  # (the thunder rolling)
    x += thud(dur, 90, 38, 0.2, 0.05) * 1.0
    return finish(x, 0.87, 1.4)


def tick(rng, f=1.0, amp=1.0):
    """A clock's tick: a woody click with a metal body."""
    dur = 0.1; t = T(dur)
    x = click(dur, rng, 2000, 0.001, 1.0)
    x += ring(dur, 2300 * f, [(1, 0.5, 0.02), (1.61, 0.35, 0.012)], rng)
    x += np.sin(2 * np.pi * 800 * f * t) * env(t, 0.0005, 0.01) * 0.5
    return x * amp


def bm_time_w():  # Time Collapse, the clock opens (0.9 s): its tick-tock, a glassy swell rising into the stop
    rng = R(480); dur = 0.92; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.25, 0.5, 0.75)):
        place(x, tick(rng, 1.0 if k % 2 == 0 else 0.75), s, 0.8)
    sw = hp(rng.standard_normal(t.size), 3000) * (t / dur) ** 3 * 0.5
    x += sw
    x += sum(np.sin(2 * np.pi * f * t) for f in (1318.5, 1760.0)) * (t / dur) ** 2.5 * 0.12
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def bm_time_c():  # the hands stop: everything frozen in time (a held glassy chord, beating), the clock cracking bit by bit
    rng = R(481); dur = 1.32; t = T(dur); x = buf(dur)
    place(x, knock(0.2, 300, 0.05, rng, 1.0) + ring(0.2, 2100, [(1, 0.4, 0.08), (1.48, 0.3, 0.05)], rng), 0, 0.9)
    frozen = sum(np.sin(2 * np.pi * f * t + i) + 0.6 * np.sin(2 * np.pi * f * 1.003 * t) for i, f in enumerate((1318.5, 1760.0, 2349.3)))
    x += frozen * env(t, 0.25, 2.0) * 0.1 * np.clip((1.3 - t) / 0.1, 0, 1)
    place(x, tick(rng, 0.9, 0.5), 0.26)
    times = 0.3 + 0.95 * rng.random(45) ** 0.5
    x += grains(t.size, times, rng.uniform(0.1, 0.45, 45) * (times / 1.25), crackle_kernels(rng, 3000, (0.0006, 0.0012)), rng)
    return finish(x, 0.82, 1.25)


def bm_time_h():  # the clock collapses: a shattering blast, glass raining, the deep boom under it
    rng = R(482); dur = 1.7; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1500) * env(t, 0.0008, 0.06) * 1.1
    for k in range(40):
        s = rng.exponential(0.18)
        if s < 0.9:
            place(x, bell(0.5, rng.uniform(2500, 9000), ratio=2.76, index=0.7, tau=rng.uniform(0.04, 0.1)), s, 0.18 * np.exp(-s / 0.5))
    x += thud(dur, 60, 30, 0.35, 0.06) * 1.2
    x += lp(rng.standard_normal(t.size), 800) * env(t, 0.002, 0.1) * 0.6
    return finish(x, 0.87, 1.4)


# ---------------------------------------------------------------- GAMBLER: the staff (wood), cards, the casino

def gb_deck_1():  # Cut the Deck 1: the staff's jab (lead 50 ms)
    rng = R(501); x = place(buf(0.18), swoosh(0.13, 700, 2600, 1500, rng, peak=0.38, q=2.2, tail=6), 0)
    return finish(x, 0.84, 1.2)


def gb_deck_2():  # 2: the back swing — the staff whirring round
    rng = R(502); dur = 0.22; t = T(dur)
    x = place(buf(0.27), swoosh(dur, 500, 1900, 700, rng, peak=0.4, q=2.0, tail=6) * (0.75 + 0.25 * np.sin(2 * np.pi * 30 * t)), 0)
    return finish(x, 0.84, 1.2)


def gb_deck_3():  # 3: two charged cards flicked (fft-fft and their pink fizz)
    rng = R(503); dur = 0.3; t = T(dur); x = buf(dur)
    place(x, flick(rng), 0); place(x, flick(rng, 0.9), 0.06)
    x += hp(rng.standard_normal(t.size), 5000) * (0.6 + 0.4 * np.sin(2 * np.pi * 60 * t)) * env(t, 0.01, 0.08) * 0.25
    return finish(x, 0.84, 1.2)


def gb_deck_4():  # 4: the rising swing — up, and a little bell at the top (lead 100 ms)
    rng = R(504); x = buf(0.75)
    place(x, swoosh(0.28, 500, 2800, 3400, rng, peak=0.4, q=2, tail=5), 0)
    place(x, bell(0.65, 2093, ratio=1.0, index=0.3, tau=0.16), 0.1, 0.18)
    return finish(x, 0.84, 1.2)


def gb_staff_hit(seed):  # a staff blow: a wooden TOK, the body, a chip
    rng = R(seed); dur = 0.32; t = T(dur)
    x = knock(dur, rng.uniform(520, 600), 0.025, rng, 0.9) * 0.9
    x += thud(dur, 180, 80, 0.035) * 0.8
    x += bp(rng.standard_normal(t.size), 600, 3000) * env(t, 0.001, 0.012) * 0.5
    place(x, clink(0.25, rng, amp=0.15), 0.01)
    return finish(x, 0.85, 1.5)


def gb_deck_fin():  # the rising swing lands (the launch): TOK-DING, chips flying
    rng = R(505); dur = 0.85; x = buf(dur)
    place(x, knock(0.3, 480, 0.04, rng, 1.0), 0, 1.0)
    place(x, thud(0.35, 170, 70, 0.05), 0, 0.8)
    place(x, bell(0.8, 2093, ratio=2.0, index=0.8, tau=0.22), 0.01, 0.35)
    for k in range(3):
        place(x, clink(0.2, rng, amp=0.3), 0.03 + k * 0.04)
    return finish(x, 0.86, 1.5)


def riffle_(dur, n, rng, accel=0.0, amp=1.0):
    """Cards riffling: clicks (each a tiny flick), faster as it goes if accel."""
    x = buf(dur + 0.05); u = np.linspace(0, 1, n)
    times = dur * (u ** (1 + accel) if accel else u) + rng.uniform(0, dur / n * 0.3, n)
    for s in times:
        place(x, flick(rng, rng.uniform(0.4, 0.9), 0.2), s, amp)
    return x


def gb_deal_w():  # Charged Deal, the fan: a riffle opening, the charge humming up
    rng = R(510); dur = 0.27; t = T(dur); x = buf(dur)
    place(x, riffle_(0.18, 18, rng, accel=0.0, amp=1.0), 0)
    x += np.sin(2 * np.pi * np.cumsum(300 * (2 ** (t / dur))) / SR) * (t / dur) ** 2 * 0.3
    x += hp(rng.standard_normal(t.size), 5000) * (t / dur) ** 2 * 0.08
    return finish(x, 0.8, 1.2)


def gb_deal_c():  # the three cards thrown (fft-fft-fft) with their charged zip
    rng = R(511); dur = 0.32; t = T(dur); x = buf(dur)
    for k in range(3):
        place(x, flick(rng, 1.0, 0.5), k * 0.035)
    place(x, swoosh(0.22, 900, 5000, 6500, rng, peak=0.3, q=4, tail=4, whistle=0.3, wq=20), 0.0, 0.7)
    x += hp(rng.standard_normal(t.size), 4500) * (0.6 + 0.4 * np.sin(2 * np.pi * 70 * t)) * env(t, 0.01, 0.1) * 0.2
    for k in range(5):  # (pink sparks off the charged cards)
        place(x, bell(0.25, rng.uniform(3500, 6500), ratio=1.5, index=1.2, tau=0.06), 0.02 + k * 0.03, 0.15)
    return finish(x, 0.84, 1.2)


def gb_deal_h(seed=512):  # a card sticks in: thk, and it fizzes (charged)
    rng = R(seed); dur = 0.5; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2500, 0.0015, 0.9)
    x += bp(rng.standard_normal(t.size), 1200, 5000) * env(t, 0.001, 0.01) * 0.6
    x += thud(dur, 170, 85, 0.025) * 0.5
    fizz = hp(rng.standard_normal(t.size), 4000) * (slow(rng, t.size, 80) > 0.3) * env(t, 0.01, 0.12)
    place(x, fizz, 0.01, 0.35)
    return finish(x, 0.84, 1.4)


def gb_vault_c():  # Staff Vault: the staff planted on the floor (tok), the vault's arc through the air
    rng = R(520); dur = 0.42; x = buf(dur)
    place(x, knock(0.15, 330, 0.03, rng, 1.0), 0, 0.8)
    place(x, swoosh(0.34, 400, 1600, 600, rng, peak=0.45, q=1.6, tail=4) + air(0.34, 0.45, 4, rng, 280, 0.4), 0.04, 0.9)
    return finish(x, 0.84, 1.25)


def gb_vault_h():  # the landing double kick (the launch): dum-DUM, air up, chips rattling
    rng = R(521); dur = 0.55; t = T(dur); x = buf(dur)
    for s, a in ((0.0, 0.7), (0.07, 1.0)):
        place(x, thud(0.3, 150, 60, 0.05) + bp(rng.standard_normal(int(SR * 0.3)), 400, 2500) * env(T(0.3), 0.001, 0.012) * 0.5, s, a)
    place(x, swoosh(0.35, 500, 2400, 2800, rng, peak=0.3, q=2, tail=4), 0.07, 0.4)
    for k in range(3):
        place(x, clink(0.2, rng, amp=0.25), 0.09 + k * 0.03)
    return finish(x, 0.86, 1.5)


def gb_fuse_c():  # Fuse Slam: the staff brought down overhead (falling; lead 240 ms)
    rng = R(530); dur = 0.32
    x = place(buf(0.38), swoosh(dur, 2600, 1300, 900, rng, peak=0.75, q=1.8, shape=2.2, tail=7) + air(dur, 0.78, 7, rng, 260, 0.5), 0)
    return finish(x, 0.84, 1.25)


def gb_fuse_h():  # KTOK! the staff smashes down, and the floor is charged: a fuse sputtering, an electric hum
    rng = R(531); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, knock(0.3, 260, 0.05, rng, 1.2), 0, 1.0)
    x += thud(dur, 110, 45, 0.12, 0.04) * 1.0
    x += click(dur, rng, 1500, 0.004, 0.8)
    spark = hp(rng.standard_normal(t.size), 3000) * (slow(rng, t.size, 60) > 0.4) * env(t, 0.05, 0.4) * np.clip((0.9 - t) / 0.1, 0, 1)
    x += spark * 0.35
    x += grains(t.size, rng.uniform(0.05, 0.8, 40), rng.uniform(0.1, 0.35, 40), crackle_kernels(rng, 2000), rng)
    x += hp(saw(np.full(t.size, 100.0), 2000), 400) * env(t, 0.05, 0.4) * 0.08
    return finish(x, 0.86, 1.5)


def gb_show_w():  # Showdown, the wind-up: the hand flies off his shoulder (cards riffling through the air)
    rng = R(540); dur = 0.38; t = T(dur); x = buf(dur)
    place(x, riffle_(0.3, 20, rng, accel=0.4, amp=0.55), 0)
    x += bp(rng.standard_normal(t.size), 1200, 5000) * env(t, 0.15, 0.12) * 0.35
    return finish(x, 0.8, 1.2)


def gb_show_c():  # the cards stand in a row and turn over one by one (a snap and a rising note each: C E G C)
    rng = R(541); dur = 0.48; x = buf(dur)
    for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        place(x, flick(rng, 1.0, 0.3), k * 0.1)
        place(x, bell(0.3, f, ratio=1.0, index=0.6, tau=0.14), k * 0.1 + 0.004, 0.3)
    place(x, reverse(swoosh(0.1, 800, 4000, 5000, rng, peak=0.3, q=2, tail=4)), 0.3, 0.35)
    return finish(x, 0.84, 1.2)


def gb_show_h():  # the last card bursts (the Hand shown): a casino stab — a bright chord, bells over it, chips everywhere
    rng = R(542); dur = 1.25; t = T(dur); x = buf(dur)
    stab = lp(chord_pad(dur, (523.3, 659.3, 784.0, 1046.5), 0.004, 0.32, cap=5000), 3500)
    x += stab * 0.35
    for f in (2093.0, 2637.0, 3136.0):
        place(x, bell(1.2, f, ratio=1.0, index=0.8, tau=0.26), 0.005, 0.15)
    x += thud(dur, 150, 60, 0.08) * 0.8
    x += bp(rng.standard_normal(t.size), 800, 6000) * env(t, 0.001, 0.03) * 0.6
    for k in range(8):
        place(x, clink(0.25, rng, amp=0.25), rng.uniform(0.01, 0.25))
    return finish(x, 0.86, 1.4)


def gb_jack_w():  # Jackpot, the wind-up (0.9 s): the lever pulled (ka-chunk), the reels spinning up (clacks faster and faster)
    rng = R(550); dur = 0.92; t = T(dur); x = buf(dur)
    place(x, knock(0.2, 220, 0.04, rng, 1.0) + ring(0.2, 900, [(1, 0.3, 0.05), (2.3, 0.2, 0.03)], rng), 0, 0.9)
    place(x, knock(0.2, 300, 0.03, rng, 1.0), 0.09, 0.7)
    s, times = 0.15, []
    while s < 0.9:
        times.append(s); s += 1 / (8 + 40 * ((s - 0.15) / 0.75) ** 1.3)
    ks = [knock(0.03, f, 0.005, rng, 0.8) for f in (1500, 1800, 2100)]
    x += grains(t.size, times, np.full(len(times), 0.35), ks, rng)
    x += svf(rng.standard_normal(t.size), 300 * (5 ** np.clip((t - 0.15) / 0.75, 0, 1)), 2.0) * np.clip((t - 0.1) / 0.6, 0, 1) * 0.3
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def gb_jack_c():  # 7 · 7 · 7: three reels stop (CLUNK + a ding, rising), the jackpot bell ringing, coins pouring out
    rng = R(551); dur = 1.32; t = T(dur); x = buf(dur)
    for k, (s, f) in enumerate(((0.0, 1568.0), (0.15, 1975.5), (0.3, 2349.3))):
        place(x, knock(0.15, 260, 0.03, rng, 1.0) + thud(0.15, 160, 80, 0.03) * 0.6, s, 0.8)
        place(x, bell(0.4, f, ratio=2.0, index=0.8, tau=0.2), s + 0.005, 0.3)
    s = 0.42; k = 0
    while s < 1.25:  # (the alarm bell: two tones trilling)
        place(x, bell(0.09, 1318.5 if k % 2 else 1046.5, ratio=3.0, index=1.5, tau=0.04), s, 0.22)
        s += 1 / 12; k += 1
    times = 0.42 + rng.exponential(0.3, 70); times = times[times < 1.3]
    for s in times:
        place(x, clink(0.2, rng, amp=rng.uniform(0.08, 0.2)), s)
    x *= np.clip((dur - t) / 0.03, 0, 1)
    return finish(x, 0.84, 1.25)


def gb_jack_h():  # the last blast smashes them down: an explosion of coins
    rng = R(552); dur = 1.05; t = T(dur); x = buf(dur)
    x += thud(dur, 100, 40, 0.2, 0.05) * 1.1
    x += lp(rng.standard_normal(t.size), 2500) * env(t, 0.001, 0.06) * 0.9
    times = rng.exponential(0.12, 70); times = times[times < 0.8]
    for s in times:
        place(x, clink(0.2, rng, amp=rng.uniform(0.1, 0.3) * np.exp(-s / 0.4)), s)
    return finish(x, 0.87, 1.5)


# ---------------------------------------------------------------- SAMURAI, the rest of his kit

def sm_sheathe_c():  # Sheathe: the blade slid home (steel along the scabbard, falling), the guard's click, a hair of ring
    rng = R(601); x = buf(0.62)
    t = T(0.16)
    place(x, svf(rng.standard_normal(t.size), np.linspace(5200, 2600, t.size), 6) * env(t, 0.02, 0.07), 0, 0.8)
    place(x, ring(0.3, 4100, [(1, 0.5, 0.025), (1.52, 0.4, 0.018), (2.3, 0.25, 0.01)], rng) + click(0.3, rng, 3000, 0.0012, 1.0), 0.15)
    place(x, ring(0.35, 2900, [(1, 0.3, 0.12)], rng, att=0.002), 0.152, 0.4)
    return finish(x, 0.82, 1.3)


def sm_wave_c():  # Sword Wave: a swish, and the crimson crescent flung away (a ring flying off, falling in pitch)
    rng = R(605); x = buf(0.62)
    place(x, sm_swish(606, 0.14, 1500, 7000, 3000), 0, 0.8)
    t = T(0.5); f = 3400 * (0.7 ** (t / 0.5))
    fly = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.01, 0.18) * 0.25 + svf(rng.standard_normal(t.size), f * 0.8, 5) * env(t, 0.01, 0.15) * 0.5
    place(x, fly, 0.04)
    return finish(x, 0.84, 1.25)


def sm_wave_h():  # the crescent bites: a slice ringing, it pops him up
    rng = R(607); x = buf(0.7)
    place(x, click(0.2, rng, 2500, 0.006, 0.9), 0)
    place(x, ring(0.7, 3300, [(1, 0.5, 0.14), (1.47, 0.35, 0.1), (2.13, 0.2, 0.06)], rng, beat=0.003, glide_to=1.05), 0)
    place(x, thud(0.3, 200, 90, 0.04), 0, 0.6)
    place(x, swoosh(0.3, 1000, 4500, 5000, rng, peak=0.3, q=2.5, tail=4), 0.01, 0.35)
    return finish(x, 0.85, 1.45)


def sm_mirage_c():  # Mirage Counter's stance: the air shimmering round him (a glassy hum), the edge turned, waiting
    rng = R(610); dur = 0.75; t = T(dur); x = buf(dur)
    x += sum(np.sin(2 * np.pi * f * t + i) * (1 + 0.5 * np.sin(2 * np.pi * (6 + i) * t)) for i, f in enumerate((1568.0, 2093.0, 2637.0))) * env(t, 0.08, 0.16) * 0.08
    x += svf(rng.standard_normal(t.size), 2400 + 600 * np.sin(2 * np.pi * 3 * t), 8) * env(t, 0.1, 0.16) * 0.5
    place(x, ring(0.45, 3600, [(1, 0.3, 0.2), (1.5, 0.2, 0.12)], rng, att=0.02), 0.0, 0.3)
    return finish(x, 0.8, 1.2)


def sm_mirage_h():  # the blow hits a mirage: it shatters (glass, ink), and a beat later he cuts from behind and throws him up
    rng = R(611); dur = 0.9; t = T(dur); x = buf(dur)
    for k in range(14):
        place(x, bell(0.3, rng.uniform(2500, 7000), ratio=2.76, index=0.7, tau=0.05), rng.exponential(0.05), 0.12)
    x += hp(rng.standard_normal(t.size), 2500) * env(t, 0.001, 0.04) * 0.6
    place(x, click(0.2, rng, 2500, 0.008, 1.0), 0.09)
    place(x, ring(0.7, 2700, [(1, 0.55, 0.22), (1.5, 0.35, 0.14), (2.2, 0.2, 0.08)], rng, beat=0.003, glide_to=1.05), 0.09, 0.8)
    place(x, thud(0.35, 190, 80, 0.05), 0.09, 0.8)
    place(x, swoosh(0.35, 800, 4000, 5000, rng, peak=0.3, q=2, tail=4), 0.1, 0.4)
    return finish(x, 0.85, 1.45)


def sm_kage_c():  # Kagemusha: he vanishes in a burst of ink and petals, the five doubles stepping out round him, the dark breathing
    rng = R(615); dur = 0.8; t = T(dur); x = buf(dur)
    x += lp(rng.standard_normal(t.size), 1200) * env(t, 0.004, 0.08) * 0.9
    x += rustle(dur, rng, 300, 3000, 9000, 0.25) * env(t, 0.01, 0.2)
    for k in range(5):
        place(x, reverse(swoosh(0.1, 900, 4000, 5000, rng, peak=0.3, q=2.5, tail=4)), 0.08 + k * 0.07, 0.4)
    x += svf(rng.standard_normal(t.size), 700, 4) * env(t, 0.15, 0.25) * 0.25
    return finish(x, 0.82, 1.25)


def sm_kage_h():  # the burst knocks a foe back: a soft whump, a splash of ink
    rng = R(616); dur = 0.5; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 65, 0.06) * 0.9
    x += bp(rng.standard_normal(t.size), 400, 2600) * env(t, 0.006, 0.09) * (0.7 + 0.3 * np.sin(2 * np.pi * 31 * t)) * 0.8
    x += rustle(dur, rng, 300, 3000, 9000, 0.2) * env(t, 0.01, 0.12)
    return finish(x, 0.84, 1.4)


def sm_tornado_c():  # Tornado Blade: a whirlwind of blades round him (the air spinning, steel flashing on each turn)
    rng = R(620); dur = 0.6; t = T(dur); x = buf(dur)
    x += bp(rng.standard_normal(t.size), 900, 5000) * (0.55 + 0.45 * np.sin(2 * np.pi * 14 * t)) * env(t, 0.03, 0.14) * 0.8
    for k in range(4):
        place(x, ring(0.15, 3800 + 300 * k, [(1, 0.3, 0.04), (1.5, 0.2, 0.025)], rng), 0.03 + k * 0.07, 0.4)
    return finish(x, 0.84, 1.25)


def sm_tornado_h():  # the third blade smashes him down: a cut, down, the floor
    rng = R(621); dur = 0.95; x = buf(dur)
    place(x, click(0.2, rng, 2200, 0.008, 1.0), 0)
    place(x, ring(0.7, 2500, [(1, 0.5, 0.2), (1.47, 0.3, 0.12)], rng, beat=0.003), 0, 0.6)
    place(x, swoosh(0.18, 5000, 1500, 600, rng, peak=0.2, q=2, tail=4), 0, 0.5)
    place(x, taiko(0.85, rng, 130, 60, 0.25, 0.8), 0.05, 1.0)
    return finish(x, 0.86, 1.5)


def sm_falcon_c():  # Falcon Dive: he leaps (up), a falcon's cry, the dive (the air rising to a scream onto the blow at 300 ms)
    rng = R(625); dur = 0.55; x = buf(dur)
    place(x, swoosh(0.18, 400, 2000, 1200, rng, peak=0.4, q=1.6, tail=4), 0, 0.6)
    tc = T(0.22); f = 2900 * (1 - 0.15 * tc / 0.22) * (1 + 0.02 * np.sin(2 * np.pi * 28 * tc))
    ph = 2 * np.pi * np.cumsum(f) / SR
    cry = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * env(tc, 0.02, 0.08) * 0.18 + bp(rng.standard_normal(tc.size), 2500, 6000) * env(tc, 0.02, 0.06) * 0.15
    place(x, cry, 0.03)
    place(x, swoosh(0.25, 600, 5000, 6000, rng, peak=0.9, q=2, shape=2.5, tail=3), 0.075, 0.8)
    return finish(x, 0.84, 1.25)


def sm_falcon_h():  # the crimson impact: the drum, a blast, fire-red embers
    rng = R(626); dur = 1.45; t = T(dur); x = buf(dur)
    x += taiko(dur, rng, 120, 55, 0.35, 0.9)
    x += svf(rng.standard_normal(t.size), 300 + 5000 * np.exp(-t / 0.06), 0.8, 'lp') * env(t, 0.001, 0.12) * 0.9
    x += flames(dur, rng, 0.5, 30) * env(t, 0.02, 0.25)
    place(x, ring(0.7, 2400, [(1, 0.4, 0.2), (1.5, 0.25, 0.12)], rng), 0, 0.4)
    return finish(x, 0.86, 1.5)


D_PENT = (1174.7, 1396.9, 1568.0, 1760.0, 2093.0, 2349.3, 2793.8, 3136.0)


def sm_sun_w():  # Rising Sun, the wind-up (0.7 s): the banner raised — the court's mouth organ (a sho cluster) swelling, a gong rising
    rng = R(630); dur = 0.72; t = T(dur); u = t / dur
    cluster = sum(np.sin(2 * np.pi * f * t + i) * (1 + 0.003 * np.sin(2 * np.pi * 4 * t + i)) for i, f in enumerate((440.0, 493.9, 659.3, 740.0, 880.0)))
    sho = lp(cluster + 0.3 * sum(np.sin(2 * np.pi * 2 * f * t) for f in (440.0, 659.3)), 3000) * u ** 1.8 * 0.15
    g = reverse(ring(1.0, 110, GONG, rng, beat=0.003))[-t.size:] * 0.6
    return finish((sho + g) * np.clip((dur - t) / 0.02, 0, 1), 0.82, 1.15)


def sm_sun_c():  # the sun rises behind him: a radiant flare (the chord blazing out), light rushing outward
    rng = R(631); dur = 1.6; t = T(dur); x = buf(dur)
    x += sum(bell(dur, f, ratio=1.0, index=0.6, tau=0.45, itau=0.3, att=0.004) for f in (440.0, 659.3, 880.0, 1108.7, 1318.5)) * 0.14
    place(x, swoosh(0.7, 400, 3500, 1200, rng, peak=0.15, q=1.2, tail=3.5), 0, 0.6)
    x += thud(dur, 90, 45, 0.2) * 0.6
    return finish(x, 0.84, 1.3)


def sm_sun_h():  # its light throws a foe back: a warm whump and a shimmer
    rng = R(632); dur = 0.65; t = T(dur); x = buf(dur)
    x += thud(dur, 140, 60, 0.08) * 0.9 + lp(rng.standard_normal(t.size), 700) * env(t, 0.002, 0.04) * 0.6
    for k in range(5):
        place(x, bell(0.35, rng.choice([1760.0, 2217.0, 2637.0, 3520.0]), ratio=2.0, index=0.8, tau=0.1), 0.01 + 0.03 * k, 0.12)
    return finish(x, 0.85, 1.4)


def sm_phantom_c():  # Phantom Blades: one draw (lead 90 ms), then ghost cuts swelling in backwards on each blow (80 ms apart), a cold shimmer
    rng = R(635); dur = 0.8; t = T(dur); x = buf(dur)
    place(x, swoosh(0.07, 2000, 9000, 9000, rng, peak=0.6, q=3, tail=3), 0.05, 0.7)
    for k in range(7):
        place(x, reverse(swoosh(0.09, 1500, 6000, 7000, rng, peak=0.3, q=3, tail=4)), k * 0.08, 0.3 + 0.03 * k)
        place(x, ring(0.25, 4200 + 150 * (k % 3), [(1, 0.25, 0.05), (1.5, 0.15, 0.03)], rng), k * 0.08 + 0.09, 0.4)
    x += (np.sin(2 * np.pi * 1975.5 * t) + np.sin(2 * np.pi * 2637.0 * t + 1)) * env(t, 0.1, 0.3) * 0.04
    return finish(x, 0.82, 1.25)


def sm_phantom_h():  # the last phantom cut: a heavier ghostly slash, its ring dying away cold
    rng = R(636); dur = 1.0; x = buf(dur)
    place(x, click(0.2, rng, 2000, 0.01, 1.0), 0)
    place(x, ring(0.95, 2300, [(1, 0.55, 0.3), (1.47, 0.4, 0.2), (2.13, 0.25, 0.12)], rng, beat=0.004), 0, 0.7)
    place(x, thud(0.4, 170, 70, 0.06), 0, 0.8)
    place(x, swoosh(0.3, 3000, 900, 600, rng, peak=0.1, q=2, tail=4), 0.0, 0.35)
    return finish(x, 0.85, 1.45)


def sm_gods_w():  # God of Blades, the wind-up (0.6 s): eight spectral katanas rising behind him one by one (a shing each, up a scale)
    rng = R(640); dur = 0.68; x = buf(dur)
    for k, f in enumerate(D_PENT):
        place(x, ring(0.45, f, [(1, 0.5, 0.25), (1.5, 0.3, 0.15), (2.2, 0.2, 0.08)], rng, att=0.01, glide_to=1.03, gtau=0.05), k * 0.07, 0.35)
        place(x, swoosh(0.08, 1200, 5000, 5500, rng, peak=0.8, q=2.5, tail=3), max(0, k * 0.07 - 0.06), 0.25)
    return finish(x, 0.82, 1.25)


def sm_gods_c():  # they hang behind him: the eight ringing together, a hum of steel
    rng = R(641); dur = 1.6; t = T(dur)
    x = sum(np.sin(2 * np.pi * f * t + i) * (1 + 0.2 * np.sin(2 * np.pi * (3 + i * 0.4) * t)) for i, f in enumerate(D_PENT)) * env(t, 0.05, 0.38) * 0.05
    x += ring(dur, 587.3, [(1, 0.3, 0.45), (2.0, 0.2, 0.3)], rng, att=0.01) * 0.3
    return finish(x, 0.8, 1.1)


def sm_gods_h():  # a spectral katana flies in and strikes: tching
    rng = R(642); x = buf(0.55)
    place(x, ring(0.5, 3100, [(1, 0.5, 0.15), (1.5, 0.3, 0.1)], rng, beat=0.004), 0, 0.7)
    place(x, click(0.2, rng, 2600, 0.006, 0.9), 0)
    place(x, thud(0.3, 190, 80, 0.04), 0, 0.6)
    return finish(x, 0.85, 1.4)


def sm_bind_c():  # Sakura Bind: his blade driven into the planks (steel biting into wood, the floor cracking), a line of blossom light
    # running out through the floor to the ring (a run of chimes), and the ring of blossoms opening — branches creaking, a koto chord
    rng = R(645); dur = 1.05; t = T(dur); x = buf(dur)
    place(x, click(0.2, rng, 2600, 0.002, 0.9) + ring(0.2, 3300, [(1, 0.45, 0.05), (1.41, 0.3, 0.03)], rng) * 0.5, 0.0)  # (the steel)
    place(x, knock(0.15, 330, 0.03, rng, 1.0) + thud(0.15, 170, 80, 0.03) * 0.7, 0.004, 0.9)  # (into the planks)
    place(x, hp(rng.standard_normal(T(0.06).size), 900) * env(T(0.06), 0.0005, 0.01), 0.01, 0.5)  # (the crack)
    for k in range(7):  # (the line of blossom light running out, segment by segment)
        place(x, bell(0.25, 1568.0 * 2 ** (k / 8), ratio=2.0, index=0.7, tau=0.07), 0.04 + k * 0.026, 0.14)
    place(x, swoosh(0.22, 900, 3200, 2600, rng, peak=0.4, q=2.2, tail=4), 0.03, 0.35)
    u = t - 0.2
    x += bp(rng.standard_normal(t.size), 500, 3000) * env(np.maximum(u, 0), 0.06, 0.16) * (u > 0) * 0.6
    times = np.sort(0.25 + 0.5 * rng.random(18) ** 1.3)
    x += grains(t.size, times, rng.uniform(0.2, 0.5, 18), [knock(0.04, f, 0.012, rng, 0.2) for f in (260, 340, 420)], rng)
    x += svf(rng.standard_normal(t.size), 420 + 200 * np.sin(2 * np.pi * 2.5 * t), 18) * env(np.maximum(u, 0), 0.1, 0.25) * (u > 0) * 1.2
    for k, f in enumerate((587.3, 784.0, 880.0)):
        place(x, pluck(0.6, f, R(646 + k), 0.992, 0.7) * env(T(0.6), 0.001, 0.3), 0.22 + k * 0.025, 0.35)
    x += rustle(dur, rng, 250, 3000, 9000, 0.2) * env(np.maximum(u, 0), 0.1, 0.25) * (u > 0)
    return finish(x, 0.82, 1.25)


def sm_bind_h():  # caught: the branches snap round him (wood tightening), petals
    rng = R(649); dur = 0.55; t = T(dur); x = buf(dur)
    x += knock(dur, 300, 0.03, rng, 0.8) * 0.8
    x += grains(t.size, rng.uniform(0, 0.12, 10), rng.uniform(0.3, 0.6, 10), [knock(0.04, f, 0.01, rng, 0.4) for f in (380, 520)], rng)
    x += rustle(dur, rng, 400, 3000, 9000, 0.3) * env(t, 0.01, 0.15)
    x += thud(dur, 150, 70, 0.04) * 0.5
    return finish(x, 0.84, 1.4)


def sm_ascend_c():  # Dragon Ascension: a crimson dragon spiralling up from his blade (a roar climbing, the air twisting upward)
    rng = R(650); dur = 0.95; t = T(dur); x = buf(dur)
    x += svf(rng.standard_normal(t.size), 300 * (8 ** np.clip(t / 0.6, 0, 1)), 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t)) * env(t, 0.1, 0.22)
    place(x, growl(0.6, rng, 80, 150, 130, 0.6), 0.05)
    return finish(x, 0.84, 1.25)


def sm_ascend_h():  # it strikes him out of the air: the dragon's bite, the crash on the floor
    rng = R(651); dur = 1.35; x = buf(dur)
    place(x, click(0.2, rng, 1800, 0.01, 1.0), 0)
    place(x, ring(0.8, 2000, [(1, 0.5, 0.25), (1.47, 0.35, 0.15)], rng, beat=0.003), 0, 0.6)
    place(x, taiko(1.25, rng, 120, 55, 0.35, 0.9), 0.06, 1.0)
    place(x, swoosh(0.2, 5000, 1500, 500, rng, peak=0.2, q=2, tail=4), 0, 0.5)
    return finish(x, 0.86, 1.5)


SOUNDS2 = {
    'sm_sheathe_c': sm_sheathe_c, 'sm_wave_c': sm_wave_c, 'sm_wave_h': sm_wave_h, 'sm_mirage_c': sm_mirage_c, 'sm_mirage_h': sm_mirage_h,
    'sm_kage_c': sm_kage_c, 'sm_kage_h': sm_kage_h, 'sm_tornado_c': sm_tornado_c, 'sm_tornado_h': sm_tornado_h,
    'sm_falcon_c': sm_falcon_c, 'sm_falcon_h': sm_falcon_h, 'sm_sun_w': sm_sun_w, 'sm_sun_c': sm_sun_c, 'sm_sun_h': sm_sun_h,
    'sm_phantom_c': sm_phantom_c, 'sm_phantom_h': sm_phantom_h, 'sm_gods_w': sm_gods_w, 'sm_gods_c': sm_gods_c, 'sm_gods_h': sm_gods_h,
    'sm_bind_c': sm_bind_c, 'sm_bind_h': sm_bind_h, 'sm_ascend_c': sm_ascend_c, 'sm_ascend_h': sm_ascend_h,
}


# ---------------------------------------------------------------- BOOK MAGE, the rest of her kit

def bm_rune_c():  # Binding Rune: a rune etched on the floor (a quick rising sparkle, the glyph settling with a low hum)
    rng = R(701); dur = 0.95; t = T(dur); x = buf(dur)
    for k in range(6):
        place(x, bell(0.3, 1568.0 * 2 ** (k / 6), ratio=2.0, index=1.0, tau=0.08), 0.02 + k * 0.025, 0.18)
    x += thud(dur, 110, 70, 0.12) * 0.6
    x += (np.sin(2 * np.pi * 220 * t) + 0.6 * np.sin(2 * np.pi * 330 * t)) * env(t, 0.12, 0.2) * 0.15
    return finish(x, 0.82, 1.25)


def bm_rune_h():  # the rune snaps shut on him (a beam binding): tzing, a bell stab, a small shock
    rng = R(702); dur = 0.9; t = T(dur); x = buf(dur)
    x += sum(bell(dur, f, ratio=1.0, index=1.2, tau=0.22) for f in (880.0, 1318.5, 1760.0)) * 0.16
    place(x, zap(rng, 0.08, 0.6), 0)
    x += thud(dur, 160, 80, 0.05) * 0.6
    return finish(x, 0.85, 1.4)


def bm_nova_c():  # Frost Nova: a ring of ice bursting out across the floor (crunch spreading, a cold rush outward, a glassy sheen)
    rng = R(705); dur = 0.75; t = T(dur); x = buf(dur)
    times = 0.02 + 0.3 * rng.random(70) ** 0.8
    x += grains(t.size, times, rng.uniform(0.15, 0.5, 70) * np.exp(-times / 0.4), crackle_kernels(rng, 3200, (0.0005, 0.001, 0.0018)), rng)
    place(x, swoosh(0.45, 600, 4500, 3000, rng, peak=0.2, q=1.4, tail=4), 0, 0.6)
    x += sum(np.sin(2 * np.pi * f * t) for f in (2637.0, 3520.0)) * env(t, 0.04, 0.22) * 0.06
    x += thud(dur, 120, 60, 0.07) * 0.5
    return finish(x, 0.83, 1.3)


def bm_nova_h():  # the cold bites (chilled): an icy crackle, a glass tinkle
    rng = R(706); dur = 0.5; t = T(dur); x = buf(dur)
    x += grains(t.size, rng.uniform(0, 0.05, 25), rng.uniform(0.2, 0.6, 25), crackle_kernels(rng, 3000, (0.0005, 0.001)), rng)
    for k in range(5):
        place(x, bell(0.3, rng.uniform(3000, 7000), ratio=2.76, index=0.6, tau=0.06), 0.01 + rng.uniform(0, 0.12), 0.15)
    x += thud(dur, 170, 80, 0.035) * 0.5
    return finish(x, 0.84, 1.4)


def bm_blink_c():  # Blink: gone (a fwip drawn in backwards) and back (a sparkling pop)
    rng = R(710); x = buf(0.42)
    place(x, reverse(swoosh(0.1, 1200, 6000, 7000, rng, peak=0.3, q=2.5, tail=4)), 0, 0.8)
    t = T(0.2); f = 900 + 2600 * (1 - np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(f) / SR
    place(x, np.sin(ph + 2 * np.exp(-t / 0.05) * np.sin(ph * 2)) * env(t, 0.002, 0.05) * 0.5, 0.1)
    for k in range(4):
        place(x, bell(0.15, rng.uniform(4000, 8000), ratio=2.0, index=0.8, tau=0.04), 0.11 + 0.02 * k, 0.15)
    return finish(x, 0.83, 1.3)


def bm_blink_z():  # passing through a foe (it reels, no damage): a small static snap
    rng = R(711); x = buf(0.3)
    place(x, zap(rng, 0.05, 0.6), 0)
    place(x, bell(0.25, 2793.8, ratio=1.5, index=1.0, tau=0.06), 0.005, 0.2)
    return finish(x, 0.8, 1.3)


def bm_levity_c():  # Levity Field: gravity turns over (air rising, a wavering tone sliding up, motes of light)
    rng = R(715); dur = 1.15; t = T(dur); x = buf(dur)
    x += svf(rng.standard_normal(t.size), 300 * (6 ** np.clip(t / 0.7, 0, 1)), 2.5) * env(t, 0.15, 0.24) * 0.8
    f = 300 * (2.5 ** np.clip(t / 0.6, 0, 1)) * (1 + 0.025 * np.sin(2 * np.pi * 6 * t))
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.1, 0.24) * 0.2
    for k in range(8):
        place(x, bell(0.3, rng.uniform(2500, 6000), ratio=2.0, index=0.6, tau=0.08), 0.15 + rng.uniform(0, 0.6), 0.1)
    return finish(x, 0.82, 1.25)


def bm_levity_h():  # a foe floats up: a soft rising bloop and the air under him
    rng = R(716); dur = 0.55; t = T(dur); x = buf(dur)
    f = 220 * (3 ** np.clip(t / 0.25, 0, 1))
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.01, 0.12) * 0.5
    place(x, swoosh(0.4, 300, 1800, 2400, rng, peak=0.35, q=1.8, tail=4), 0, 0.5)
    return finish(x, 0.83, 1.3)


def paper_rip(rng, dur=0.08, amp=1.0):
    """A page torn out: a rough rip (stick-slip crackle of fibres)."""
    t = T(dur)
    g = np.clip(slow(rng, t.size, 300) + 0.3, 0, None)
    return bp(rng.standard_normal(t.size), 1500, 7000) * g * env(t, 0.004, dur * 0.4) * amp


def bm_crane_c():  # Origami Flock: five pages torn out (rips), folded (crisp creases), and the cranes flutter away
    rng = R(720); dur = 1.0; t = T(dur); x = buf(dur)
    for k in range(5):
        place(x, paper_rip(rng, 0.07, 0.8), 0.0 + k * 0.045)
        place(x, flick(rng, 0.7, 0.2), 0.06 + k * 0.045)
    flutter = (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(22 + 4 * slow(rng, t.size, 6)) / SR)) ** 2
    x += bp(rng.standard_normal(t.size), 1200, 5000) * flutter * env(t, 0.25, 0.2) * 0.5
    place(x, bell(0.5, 2093.0, ratio=3.5, index=0.8, tau=0.15), 0.22, 0.15)
    return finish(x, 0.82, 1.25)


def bm_crane_h():  # a crane strikes: a paper slap and a small chime
    rng = R(721); dur = 0.45; t = T(dur); x = buf(dur)
    x += bp(rng.standard_normal(t.size), 800, 5000) * env(t, 0.001, 0.025) * 0.9
    x += click(dur, rng, 2500, 0.002, 0.6)
    x += thud(dur, 180, 90, 0.03) * 0.5
    place(x, bell(0.4, 2637.0, ratio=3.5, index=0.8, tau=0.1), 0.005, 0.25)
    return finish(x, 0.84, 1.4)


def bm_ward_c():  # Arcane Ward: a shell of rune hexagons snapping into place round her (glassy tinks), the shield's hum
    rng = R(725); dur = 1.15; t = T(dur); x = buf(dur)
    for k in range(9):
        place(x, bell(0.25, 1760.0 * (1 + 0.06 * (k % 3)), ratio=2.76, index=0.9, tau=0.05) + click(0.25, rng, 4000, 0.001, 0.3), 0.02 + k * 0.035, 0.25)
    hum = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((293.7, 440.0, 587.3)))
    x += hum * env(t, 0.25, 0.28) * 0.08 * (1 + 0.2 * np.sin(2 * np.pi * 7 * t))
    return finish(x, 0.82, 1.2)


def bm_curse_c():  # Paper Curse: pages whirling round a foe (a paper flutter, rising), a minor chord whispering
    rng = R(730); dur = 1.0; t = T(dur); x = buf(dur)
    flutter = (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(18 + 10 * t) / SR)) ** 2
    x += bp(rng.standard_normal(t.size), 1500, 6000) * flutter * env(t, 0.2, 0.2) * 0.6
    x += sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((233.1, 277.2, 349.2))) * env(t, 0.2, 0.22) * 0.08
    return finish(x, 0.82, 1.2)


def bm_curse_z():  # cursed: he folds into a paper crane (a puff, crisp folds)
    rng = R(731); dur = 0.5; t = T(dur); x = buf(dur)
    x += lp(rng.standard_normal(t.size), 1500) * env(t, 0.004, 0.05) * 0.7
    for k in range(4):
        place(x, flick(rng, 0.8, 0.25), 0.04 + k * 0.05)
    place(x, bell(0.4, 1661.2, ratio=3.5, index=0.8, tau=0.12), 0.02, 0.2)
    return finish(x, 0.83, 1.3)


def bm_elem_w():  # Elemental Ascension, the wind-up (0.6 s): frost and storm swirling up round her
    rng = R(735); dur = 0.62; t = T(dur); u = t / dur; x = buf(dur)
    x += svf(rng.standard_normal(t.size), 400 * (5 ** u), 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * u ** 1.5 * 0.9
    times = 0.6 * rng.random(50) ** 0.6
    x += grains(t.size, times, rng.uniform(0.1, 0.4, 50) * (times / 0.6), crackle_kernels(rng), rng)
    for k in range(6):
        place(x, bell(0.25, rng.uniform(3000, 6500), ratio=2.76, index=0.6, tau=0.05), 0.1 + 0.08 * k, 0.12)
    return finish(x * np.clip((dur - t) / 0.02, 0, 1), 0.82, 1.2)


def bm_elem_c():  # she merges with the elements: a burst (thunder's whoom, ice shattering, a bright chord)
    rng = R(736); dur = 1.3; t = T(dur); x = buf(dur)
    x += thud(dur, 80, 40, 0.25, 0.05) * 0.8
    x += svf(rng.standard_normal(t.size), 200 + 3000 * np.exp(-t / 0.08), 0.8, 'lp') * env(t, 0.002, 0.15) * 0.7
    for k in range(20):
        s_ = rng.exponential(0.15)
        if s_ < 0.7:
            place(x, bell(0.3, rng.uniform(2500, 8000), ratio=2.76, index=0.7, tau=0.06), s_, 0.14)
    x += sum(bell(dur, f, ratio=1.0, index=0.5, tau=0.4, att=0.005) for f in (587.3, 880.0, 1174.7)) * 0.1
    return finish(x, 0.84, 1.3)


def bm_elem_h():  # an elemental shock: a zap and an icy tink
    rng = R(737); x = buf(0.45)
    place(x, zap(rng, 0.07, 0.7), 0)
    place(x, bell(0.35, 3520.0, ratio=2.76, index=0.7, tau=0.07), 0.01, 0.3)
    place(x, thud(0.3, 170, 80, 0.035), 0, 0.5)
    return finish(x, 0.84, 1.4)


def bm_slam_c():  # Page Bind: the book swung shut (pages riffling through the air)
    rng = R(740); dur = 0.3; x = buf(dur)
    place(x, riffle_(0.12, 12, rng, accel=0.5, amp=0.6), 0)
    place(x, swoosh(0.2, 500, 2200, 1500, rng, peak=0.6, q=1.8, tail=4), 0, 0.6)
    return finish(x, 0.82, 1.25)


def bm_slam_h():  # the book slams shut on him: THWAP, frozen pages sticking (an icy crackle)
    rng = R(741); dur = 0.6; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 60, 0.06) * 1.0
    x += bp(rng.standard_normal(t.size), 300, 4000) * env(t, 0.0008, 0.03) * 1.1
    x += grains(t.size, 0.02 + rng.uniform(0, 0.15, 20), rng.uniform(0.15, 0.45, 20), crackle_kernels(rng, 3000, (0.0005, 0.001)), rng)
    return finish(x, 0.85, 1.45)


SOUNDS3 = {
    'bm_rune_c': bm_rune_c, 'bm_rune_h': bm_rune_h, 'bm_nova_c': bm_nova_c, 'bm_nova_h': bm_nova_h, 'bm_blink_c': bm_blink_c, 'bm_blink_z': bm_blink_z,
    'bm_levity_c': bm_levity_c, 'bm_levity_h': bm_levity_h, 'bm_crane_c': bm_crane_c, 'bm_crane_h': bm_crane_h, 'bm_ward_c': bm_ward_c,
    'bm_curse_c': bm_curse_c, 'bm_curse_z': bm_curse_z, 'bm_elem_w': bm_elem_w, 'bm_elem_c': bm_elem_c, 'bm_elem_h': bm_elem_h,
    'bm_slam_c': bm_slam_c, 'bm_slam_h': bm_slam_h,
}


# ---------------------------------------------------------------- GAMBLER, the rest of his kit (his families: the staff, the cards, the coin, chance)

def card_pop(rng, amp=1.0):
    """A charged card going off: a small bright bang with a fizz."""
    t = T(0.2)
    x = hp(rng.standard_normal(t.size), 1200) * env(t, 0.0006, 0.012) * 1.0
    x += np.sin(glide(t, 260, 120, 0.02)) * env(t, 0.001, 0.03) * 0.6
    x += hp(rng.standard_normal(t.size), 4000) * (slow(rng, t.size, 120) > 0.3) * env(t, 0.005, 0.06) * 0.3
    return x * amp


def gb_riffle_c():  # Riffle Shuffle: a ring of cards shuffling round him (a cascade of riffles, swirling), the bridge spreading them at the end
    rng = R(801); dur = 0.95; t = T(dur); x = buf(dur)
    n = 34
    for k in range(n):
        place(x, flick(rng, rng.uniform(0.4, 0.9), 0.15), k * 0.018 + rng.uniform(0, 0.006), 0.55 + 0.25 * np.sin(2 * np.pi * 8 * k * 0.018))
    x += bp(rng.standard_normal(t.size), 1500, 6000) * (0.6 + 0.4 * np.sin(2 * np.pi * 8 * t)) * env(t, 0.1, 0.3) * 0.25 * np.clip((0.8 - t) / 0.15, 0, 1)
    place(x, swoosh(0.2, 1200, 5000, 6000, rng, peak=0.3, q=2.5, tail=4), 0.6, 0.6)
    return finish(x, 0.82, 1.25)


def gb_riffle_h():  # the cards spread out and stick in everyone round him: a burst of thunks and their charge fizzing
    rng = R(802); dur = 0.55; t = T(dur); x = buf(dur)
    for k in range(6):
        place(x, click(0.1, rng, 2200, 0.0015, 0.8) + bp(rng.standard_normal(int(SR * 0.1)), 1000, 5000) * env(T(0.1), 0.001, 0.01) * 0.5, rng.uniform(0, 0.06))
    x += thud(dur, 160, 70, 0.05) * 0.7
    x += hp(rng.standard_normal(t.size), 4000) * (slow(rng, t.size, 90) > 0.3) * env(t, 0.02, 0.15) * 0.3
    return finish(x, 0.85, 1.4)


def gb_rotor_c():  # Rotor Staff: the staff spinning like a propeller (whup-whup on every 50 ms blow), cards flung off it nonstop
    rng = R(805); dur = 0.82; t = T(dur); x = buf(dur)
    x += bp(rng.standard_normal(t.size), 400, 2200) * (0.5 + 0.5 * np.sin(2 * np.pi * 20 * t)) ** 2 * env(t, 0.05, 0.6) * np.clip((0.75 - t) / 0.05, 0, 1) * 1.0
    for k in range(7):
        place(x, flick(rng, 0.7, 0.2), 0.05 + k * 0.1, 0.5)
    return finish(x, 0.82, 1.25)


def gb_rotor_h():  # the last blow sets them all off: pa-pa-pa-pa-POW, and it throws him away
    rng = R(806); dur = 0.8; t = T(dur); x = buf(dur)
    for k in range(5):
        place(x, card_pop(rng, 0.45 + 0.08 * k), k * 0.035)
    place(x, thud(0.6, 120, 50, 0.12) + svf(rng.standard_normal(int(SR * 0.6)), 300 + 4000 * np.exp(-T(0.6) / 0.05), 0.8, 'lp') * env(T(0.6), 0.001, 0.08) * 0.8, 0.18, 1.0)
    for k in range(4):
        place(x, clink(0.2, rng, amp=0.15), 0.2 + 0.03 * k)
    return finish(x, 0.86, 1.5)


def gb_coin_c():  # Coin Flip: the coin flicked off his thumb (ting), spinning in the air (its ring wobbling slower), caught with a clink (lead 420 ms)
    rng = R(810); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, clink(0.3, rng, 4200, 0.9) + click(0.3, rng, 3000, 0.001, 0.6), 0.0)
    ts = T(0.4); spin = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(14 - 9 * ts / 0.4) / SR)
    place(x, (np.sin(2 * np.pi * 3600 * ts) * 0.6 + np.sin(2 * np.pi * 5470 * ts) * 0.3) * spin * env(ts, 0.01, 0.3) * 0.25, 0.02)
    place(x, clink(0.3, rng, 3000, 0.8) + thud(0.3, 300, 150, 0.015) * 0.4, 0.42)
    place(x, bell(0.5, 2093.0, ratio=2.0, index=0.6, tau=0.15), 0.44, 0.2)
    return finish(x, 0.83, 1.3)


def gb_wheel_c():  # Roulette Wheel: the wheel opens (a heavy clunk, its whirr), the ball rattling over the frets, slowing, and stopping (~2 s)
    rng = R(815); dur = 2.25; t = T(dur); x = buf(dur)
    place(x, knock(0.25, 180, 0.05, rng, 1.0) + thud(0.25, 120, 60, 0.05) * 0.6, 0, 0.9)
    x += bp(rng.standard_normal(t.size), 300, 1500) * env(t, 0.1, 1.2) * 0.25 * np.clip((2.1 - t) / 0.2, 0, 1)
    s_, times = 0.1, []
    while s_ < 2.0:
        times.append(s_); s_ += 1 / (26 - 20 * (s_ / 2.0) ** 0.8)
    ks = [knock(0.03, f, 0.004, rng, 1.0) for f in (2400, 2800, 3200)]
    x += grains(t.size, times, np.linspace(0.35, 0.5, len(times)), ks, rng)
    place(x, knock(0.15, 2000, 0.01, rng, 1.0) + click(0.15, rng, 2500, 0.002, 0.5), 2.0, 0.9)
    return finish(x, 0.82, 1.2)


def gb_wheel_h():  # where it stops: the house pays out — a blast, a bell, chips flying
    rng = R(816); dur = 1.0; t = T(dur); x = buf(dur)
    x += thud(dur, 110, 45, 0.18, 0.05) * 1.0
    x += svf(rng.standard_normal(t.size), 300 + 5000 * np.exp(-t / 0.06), 0.8, 'lp') * env(t, 0.001, 0.1) * 0.8
    x += bell(dur, 1318.5, ratio=2.0, index=1.0, tau=0.3) * 0.25 + bell(dur, 1975.5, ratio=2.0, index=1.0, tau=0.3) * 0.15
    for k in range(10):
        place(x, clink(0.2, rng, amp=0.2), rng.uniform(0.02, 0.3))
    return finish(x, 0.86, 1.45)


def gb_dice_c():  # Dice Bomb: two dice rolled along the floor, tumbling and bouncing
    rng = R(820); dur = 0.75; t = T(dur); x = buf(dur)
    for d in range(2):
        s_ = 0.02 + d * 0.03; gap = 0.07
        while s_ < 0.55:
            place(x, knock(0.04, rng.uniform(1800, 2600), 0.006, rng, 0.9), s_, rng.uniform(0.4, 0.8) * (1 - s_ / 0.9))
            s_ += gap * rng.uniform(0.7, 1.2); gap *= 0.93
    x += bp(rng.standard_normal(t.size), 600, 2500) * env(t, 0.05, 0.3) * 0.12
    return finish(x, 0.82, 1.25)


def gb_dice_h():  # the dice burst: a clack, a bang, a crackle
    rng = R(821); dur = 0.8; t = T(dur); x = buf(dur)
    place(x, knock(0.05, 2400, 0.006, rng, 1.0), 0, 0.7)
    x += thud(dur, 120, 50, 0.13) * 1.0
    x += svf(rng.standard_normal(t.size), 400 + 6000 * np.exp(-t / 0.04), 0.8, 'lp') * env(t, 0.001, 0.08) * 0.9
    x += grains(t.size, rng.exponential(0.1, 25), rng.uniform(0.1, 0.4, 25), crackle_kernels(rng, 2000), rng)
    return finish(x, 0.86, 1.5)


def gb_grab_c():  # Kinetic Grab: he holds the foe and charges its whole body (a hum rising, static crackling)
    rng = R(825); dur = 0.65; t = T(dur); x = buf(dur)
    f = 120 * (3 ** np.clip(t / 0.5, 0, 1))
    x += hp(saw(f, 3000), 200) * env(t, 0.05, 0.35) * 0.25 * np.clip((0.6 - t) / 0.05, 0, 1)
    times = 0.5 * rng.random(40) ** 0.7
    x += grains(t.size, times, rng.uniform(0.1, 0.4, 40) * (times / 0.5 + 0.3), crackle_kernels(rng), rng)
    return finish(x, 0.82, 1.25)


def gb_grab_h():  # the collar seized: a grip thump, a jolt of static
    rng = R(826); x = buf(0.45)
    place(x, thud(0.3, 140, 70, 0.04) + bp(rng.standard_normal(int(SR * 0.3)), 400, 2500) * env(T(0.3), 0.001, 0.015) * 0.6, 0, 0.9)
    place(x, zap(rng, 0.06, 0.5), 0.01)
    return finish(x, 0.84, 1.4)


def gb_grab_end():  # thrown: the body a bomb — the heave, the kinetic discharge
    rng = R(827); dur = 0.9; t = T(dur); x = buf(dur)
    place(x, swoosh(0.35, 300, 1800, 900, rng, peak=0.3, q=1.4, tail=4) + air(0.35, 0.3, 4, rng, 260, 0.6), 0, 0.8)
    place(x, arc(0.25, rng, f=110, jit=0.4) * env(T(0.25), 0.002, 0.1), 0.02, 0.5)
    x += thud(dur, 110, 45, 0.15) * 0.8
    return finish(x, 0.86, 1.45)


def gb_ace_c():  # Ace in the Hole: the ace charged between two fingers (a rising whine), then thrown like a lance (SHWING) (lead 280 ms)
    rng = R(830); dur = 0.7; x = buf(dur)
    tc = T(0.28)
    place(x, np.sin(2 * np.pi * np.cumsum(700 * (4 ** (tc / 0.28))) / SR) * (tc / 0.28) ** 2 * 0.25 + hp(rng.standard_normal(tc.size), 5000) * (tc / 0.28) ** 2 * 0.12, 0)
    place(x, flick(rng, 1.2, 0.5), 0.28)
    place(x, swoosh(0.35, 1500, 7500, 4000, rng, peak=0.15, q=3, tail=4, whistle=0.3, wq=20), 0.28, 0.8)
    return finish(x, 0.83, 1.3)


def gb_ace_h():  # the ace tears through him: a piercing tchk, its double charge fizzing
    rng = R(831); dur = 0.6; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2500, 0.0015, 1.0)
    x += ring(dur, 3600, [(1, 0.4, 0.08), (1.5, 0.25, 0.05)], rng) * 0.5
    x += thud(dur, 180, 80, 0.04) * 0.6
    place(x, card_pop(rng, 0.5), 0.05)
    x += hp(rng.standard_normal(t.size), 4000) * (slow(rng, t.size, 90) > 0.3) * env(t, 0.02, 0.15) * 0.3
    return finish(x, 0.85, 1.45)


def gb_snap_c():  # All In: a snap of his fingers
    rng = R(835); x = buf(0.3)
    place(x, click(0.2, rng, 1800, 0.0012, 1.0) + bp(rng.standard_normal(int(SR * 0.2)), 1500, 4500) * env(T(0.2), 0.0005, 0.006) * 0.8, 0)
    return finish(x, 0.8, 1.2)


def gb_allin_h():  # every card in him goes off at once and he is blown up: a rattle of pops into one big blast
    rng = R(836); dur = 1.0; t = T(dur); x = buf(dur)
    for k in range(8):
        place(x, card_pop(rng, 0.4), rng.uniform(0, 0.06))
    x += thud(dur, 110, 42, 0.2, 0.05) * 1.1
    x += svf(rng.standard_normal(t.size), 300 + 6000 * np.exp(-t / 0.05), 0.8, 'lp') * env(t, 0.001, 0.12) * 1.0
    for k in range(8):
        place(x, clink(0.2, rng, amp=0.15), rng.uniform(0.05, 0.3))
    return finish(x, 0.87, 1.5)


def gb_52_c():  # 52 Pickup: the deck swept along the floor in a cone (cards spraying, a long riffle rushing away)
    rng = R(840); dur = 0.6; t = T(dur); x = buf(dur)
    for k in range(40):
        place(x, flick(rng, rng.uniform(0.3, 0.8), 0.2), 0.01 + 0.4 * (k / 40) ** 1.1 + rng.uniform(0, 0.01), 0.5 * (1 - k / 60))
    place(x, swoosh(0.45, 700, 3500, 2000, rng, peak=0.25, q=1.5, tail=4), 0, 0.7)
    return finish(x, 0.82, 1.25)


def gb_52_h():  # the last wave goes off: pops running away merging into one blast
    rng = R(841); dur = 0.95; t = T(dur); x = buf(dur)
    for k in range(7):
        place(x, card_pop(rng, 0.5 - 0.04 * k), k * 0.03)
    x += thud(dur, 120, 48, 0.16) * 0.9
    x += svf(rng.standard_normal(t.size), 300 + 4000 * np.exp(-t / 0.07), 0.8, 'lp') * env(t, 0.002, 0.12) * 0.8
    return finish(x, 0.86, 1.45)


def gb_slam_w():  # Grand Slam, the wind-up (0.42 s): the staff stretching to twice its length (a rising magical stretch, a creak)
    rng = R(845); dur = 0.45; t = T(dur); u = t / dur; x = buf(dur)
    x += np.sin(2 * np.pi * np.cumsum(180 * (3 ** u)) / SR) * u ** 1.5 * 0.25
    x += svf(rng.standard_normal(t.size), 400 * (6 ** u), 3) * u ** 2 * 0.6
    x += svf(rng.standard_normal(t.size), 350, 15) * env(t, 0.05, 0.15) * 0.8
    return finish(x * np.clip((dur - t) / 0.02, 0, 1), 0.8, 1.2)


def gb_slam_c():  # the swing like a bat: a huge whoosh
    rng = R(846); dur = 0.45
    x = place(buf(0.5), swoosh(dur, 250, 1600, 500, rng, peak=0.35, q=1.5, shape=2.2, tail=6) + air(dur, 0.35, 6, rng, 240, 1.0), 0)
    return finish(x, 0.84, 1.3)


def gb_slam_h():  # CRACK — a home run: the bat's crack, the foe flying off on a comet's tail
    rng = R(847); dur = 1.1; t = T(dur); x = buf(dur)
    x += click(dur, rng, 1500, 0.002, 1.2)
    x += knock(dur, 650, 0.03, rng, 1.0) * 0.9 + knock(dur, 1150, 0.02, rng, 0.5) * 0.5
    x += thud(dur, 130, 55, 0.08) * 0.9
    place(x, swoosh(0.8, 3000, 900, 300, rng, peak=0.08, q=2, tail=3, whistle=0.4, wq=15), 0.03, 0.7)
    return finish(x, 0.87, 1.5)


def gb_triple_c():  # Triple Down: the staff swelling into a pillar of light (a bright hum rising)
    rng = R(850); dur = 0.65; t = T(dur); x = buf(dur)
    x += sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.3 * np.clip(t / 0.25, 0, 1))) / SR) for f in (220.0, 330.0, 440.0)) * env(t, 0.1, 0.12) * 0.12
    x += svf(rng.standard_normal(t.size), 600 * (4 ** np.clip(t / 0.25, 0, 1)), 3) * env(t, 0.1, 0.11) * 0.5
    return finish(x, 0.8, 1.2)


def gb_triple_h():  # a hammer blow of the pillar on the floor: DOOM, a ring of light
    rng = R(851); dur = 0.95; t = T(dur); x = buf(dur)
    x += thud(dur, 105, 42, 0.17, 0.05) * 1.1
    x += lp(rng.standard_normal(t.size), 1500) * env(t, 0.001, 0.05) * 0.9
    x += ring(dur, 880, [(1, 0.4, 0.3), (2.0, 0.25, 0.2), (3.0, 0.15, 0.1)], rng) * 0.25
    return finish(x, 0.86, 1.45)


def gb_triple_end():  # the third, the heaviest: DOOM, and he bounces off the floor
    rng = R(852); dur = 1.1; t = T(dur); x = buf(dur)
    x += thud(dur, 95, 36, 0.22, 0.06) * 1.2
    x += lp(rng.standard_normal(t.size), 1800) * env(t, 0.001, 0.06) * 1.0
    x += ring(dur, 660, [(1, 0.45, 0.4), (2.0, 0.3, 0.25), (3.0, 0.2, 0.12)], rng) * 0.3
    place(x, thud(0.3, 160, 80, 0.04), 0.22, 0.5)  # (the bounce)
    return finish(x, 0.87, 1.5)


def gb_swap_c():  # Card Swap: a card flicked, and he swaps places with it in a flash (a pop)
    rng = R(855); x = buf(0.35)
    place(x, flick(rng, 1.0, 0.4), 0)
    t = T(0.15); f = 800 + 3000 * (1 - np.exp(-t / 0.02))
    place(x, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.002, 0.04) * 0.5, 0.06)
    place(x, reverse(swoosh(0.08, 1500, 6000, 7000, rng, peak=0.3, q=2.5, tail=4)), 0.0, 0.5)
    return finish(x, 0.82, 1.25)


SOUNDS4 = {
    'gb_riffle_c': gb_riffle_c, 'gb_riffle_h': gb_riffle_h, 'gb_rotor_c': gb_rotor_c, 'gb_rotor_h': gb_rotor_h, 'gb_coin_c': gb_coin_c,
    'gb_wheel_c': gb_wheel_c, 'gb_wheel_h': gb_wheel_h, 'gb_dice_c': gb_dice_c, 'gb_dice_h': gb_dice_h,
    'gb_grab_c': gb_grab_c, 'gb_grab_h': gb_grab_h, 'gb_grab_end': gb_grab_end, 'gb_ace_c': gb_ace_c, 'gb_ace_h': gb_ace_h,
    'gb_snap_c': gb_snap_c, 'gb_allin_h': gb_allin_h, 'gb_52_c': gb_52_c, 'gb_52_h': gb_52_h,
    'gb_slam_w': gb_slam_w, 'gb_slam_c': gb_slam_c, 'gb_slam_h': gb_slam_h, 'gb_triple_c': gb_triple_c, 'gb_triple_h': gb_triple_h,
    'gb_triple_end': gb_triple_end, 'gb_swap_c': gb_swap_c,
}


# ---------------------------------------------------------------- WARRIOR, the rest of his kit — in DFO's five families:
# STEEL the sword itself (thin, quick, ringing), STONE his weight (rock, planks, dust, embers in the cracks), IRON his
# grappling hand (clamps, chain links, cold sparks), HOLY the Judge's verdicts (bells, a choir, runes), CRIMSON his fury
# (a roar, red fire, smoke)

def chain_rattle(dur, rng, rate=60.0, accel=0.0, amp=1.0, lo=1500, hi=3800):
    """A chain's links running (thrown out, reeled in): quick small metal clinks, `accel` > 0 faster, < 0 slower."""
    n = T(dur).size; times = []; tm = 0.0
    while tm < dur:
        times.append(tm); r = max(8.0, rate * (1 + accel * tm / dur)); tm += rng.uniform(0.6, 1.4) / r
    times = np.asarray(times)
    ks = []
    for f in (lo, (lo + hi) / 2, hi):
        t = T(0.05)
        k = sum(a * np.sin(2 * np.pi * f * rr * t + rng.uniform(0, 6)) * np.exp(-t / tau) for rr, a, tau in ((1, 1, 0.012), (1.47, 0.6, 0.008), (2.31, 0.35, 0.005)))
        k = k + hp(rng.standard_normal(t.size), 3000) * np.exp(-t / 0.0012) * 0.6
        ks.append(k)
    return grains(n, times, rng.uniform(0.35, 1, times.size), ks, rng) * amp


def voice_roar(dur, rng, f0=120, f1=175, f2=130, vowel=((720, 1.0, 160), (1180, 0.6, 210), (2550, 0.32, 360), (3400, 0.15, 450)), rasp=0.35, amp=1.0):
    """A man's battle cry: a rough chest voice (pitch up, held, falling), its vowel, the rasp of the throat, the breath."""
    t = T(dur); u = t / dur
    f = np.where(u < 0.25, f0 + (f1 - f0) * np.clip(u / 0.25, 0, 1) ** 0.6, f1 + (f2 - f1) * np.clip((u - 0.25) / 0.75, 0, 1) ** 1.6)
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t) + 0.02 * slow(rng, t.size, 18))
    src = saw(f, cap=6000) * (1 + rasp * slow(rng, t.size, 70)) + saw(f * 0.5, cap=2000) * 0.25
    breath = hp(rng.standard_normal(t.size), 900) * 0.3
    v = formants(src + breath, vowel)
    a = np.where(u < 0.08, (u / 0.08) ** 1.2, np.where(u < 0.62, 1.0, np.cos(np.pi / 2 * np.clip((u - 0.62) / 0.38, 0, 1)) ** 1.5))
    return v * a * amp


def choir(dur, freqs, rng, att, tau, vowel=((650, 1.0, 140), (1080, 0.55, 180), (2650, 0.3, 320)), amp=1.0):
    """A choir's 'ah' (a few voices a chord, each a hair apart): the Judge's light."""
    t = T(dur); x = np.zeros_like(t)
    for i, f in enumerate(freqs):
        for d in (-0.004, 0.0, 0.005):
            fv = f * (1 + d) * (1 + 0.006 * np.sin(2 * np.pi * (4.8 + 0.37 * i) * t + i + d * 300))
            x += saw(fv, cap=5000) / (1 + 0.3 * i)
    return formants(x, vowel) * env(t, att, tau) * amp


def wr_dash_c():  # Dash Slash: he becomes a blur (a sharp rush, three afterimages flicking after him) and one razor line (lead 100)
    rng = R(1001); dur = 0.5; x = buf(dur)
    place(x, swoosh(0.26, 500, 4200, 1500, rng, peak=0.4, q=2.6, shape=1.6, tail=6, whistle=0.25, wq=20), 0, 1.0)
    for k in range(3):  # (the afterimages: thin fwips trailing)
        place(x, swoosh(0.09, 2500, 7000, 5000, rng, peak=0.5, q=3, tail=4), 0.13 + k * 0.035, 0.32 - 0.07 * k)
    t = T(0.3)  # (the razor line: a thin tsiing at the strike)
    place(x, ring(0.3, 5200, [(1, 0.5, 0.06), (1.33, 0.3, 0.04)], rng, glide_to=1.06, gtau=0.05) * rise(t, 0.004), 0.1, 0.35)
    return finish(x, 0.84, 1.3)


def wr_dash_h():  # each blow of the line: a razor tsk, then a beat later the line bursts in sparks
    rng = R(1002); dur = 0.42; t = T(dur); x = buf(dur)
    place(x, click(0.1, rng, 4000, 0.0012, 1.0), 0)
    place(x, ring(0.2, 3700, [(1, 0.45, 0.03), (1.41, 0.3, 0.02), (2.2, 0.2, 0.012)], rng), 0, 0.6)
    place(x, thud(0.15, 200, 100, 0.025), 0, 0.45)
    times = 0.07 + rng.exponential(0.025, 22)
    x += grains(t.size, times, rng.uniform(0.25, 0.7, 22) * np.exp(-(times - 0.07) / 0.06), crackle_kernels(rng, 3500, (0.0004, 0.0008, 0.0012)), rng)
    place(x, ring(0.25, 6100, [(1, 0.3, 0.04)], rng), 0.07, 0.25)
    return finish(x, 0.85, 1.5)


WHIRL = 0.13  # (Whirlwind's blows in the arena: 130 ms apart, one turn each)


def wr_whirl_c():  # Whirlwind: a flat disc of steel round his waist — vwom on every turn, the blade ringing thin, sparks flung, dust
    rng = R(1010); dur = 0.95; t = T(dur); x = buf(dur)
    ph = (t / WHIRL) % 1.0
    turn = np.exp(-((ph - 0.5) / 0.16) ** 2)  # (each turn the blade passes in front)
    fc = 500 + 2600 * turn
    body = svf(rng.standard_normal(t.size), fc, 2.2) * (0.25 + turn) * 0.9
    shape = np.clip(t / 0.06, 0, 1) * np.clip((0.86 - t) / 0.08, 0, 1)
    x += body * shape
    x += lp(brown(t.size, rng), 260) * (0.4 + 0.6 * turn) * shape * 0.5  # (dust turning off the floor)
    sing = np.sin(2 * np.pi * np.cumsum(2950 * (1 + 0.02 * turn)) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(4420 * (1 + 0.02 * turn)) / SR)
    x += sing * (0.3 + 0.7 * turn) * shape * 0.07  # (the edge singing, louder as it passes)
    times = rng.uniform(0.05, 0.8, 40)
    x += grains(t.size, times, rng.uniform(0.1, 0.4, 40), crackle_kernels(rng, 3000, (0.0005, 0.001)), rng)
    return finish(x, 0.84, 1.3)


def wr_whirl_h():  # the last turn's heavy blow flings him off: KLANG, a spray of sparks, thrown
    rng = R(1011); dur = 0.85; t = T(dur); x = buf(dur)
    x += ring(dur, 820, [(1, 0.55, 0.16), (1.58, 0.45, 0.11), (2.37, 0.3, 0.07), (3.61, 0.2, 0.04)], rng, beat=0.004) * 0.7
    x += thud(dur, 160, 60, 0.08, 0.03) * 1.0
    x += bp(rng.standard_normal(t.size), 400, 3000) * env(t, 0.0008, 0.025) * 0.8
    times = rng.exponential(0.05, 35)
    x += grains(t.size, times, rng.uniform(0.2, 0.6, 35) * np.exp(-times / 0.12), crackle_kernels(rng, 3000), rng)
    place(x, swoosh(0.4, 2400, 700, 300, rng, peak=0.12, q=1.6, tail=4), 0.02, 0.55)
    return finish(x, 0.86, 1.55)


def wr_sanct_c():  # Sanctuary: runes light up round him one by one (glassy pings), a choir swelling; the dome of light at the strike (lead 300)
    rng = R(1020); dur = 1.45; t = T(dur); x = buf(dur)
    for k, f in enumerate((1318.5, 1480.0, 1661.2, 1760.0, 1975.5, 2217.5)):
        place(x, bell(0.45, f, ratio=2.0, index=0.7, tau=0.14), 0.03 + k * 0.042, 0.16)
    c = choir(1.3, (220.0, 277.2, 329.6, 440.0), rng, 0.28, 0.5, amp=0.55)
    place(x, c, 0.02)
    place(x, thud(0.5, 120, 60, 0.09) + lp(rng.standard_normal(T(0.5).size), 600) * env(T(0.5), 0.004, 0.06) * 0.5, 0.3, 0.8)  # (the dome: whomp)
    dome = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((880.0, 1108.7, 1318.5, 1760.0)))
    x += dome * (0.75 + 0.25 * np.sin(2 * np.pi * 7 * t)) * np.clip((t - 0.3) / 0.02, 0, 1) * np.exp(-np.maximum(0, t - 0.3) / 0.35) * 0.05
    for k in range(7):  # (motes rising)
        place(x, bell(0.25, 2637.0 * 2 ** (k / 7), ratio=2.0, index=0.5, tau=0.07), 0.38 + k * 0.08, 0.08)
    return finish(x, 0.82, 1.25)


def wr_sanct_h():  # the light pushes him off: a hallowed whomp, a short choir stab, one deep bell
    rng = R(1021); dur = 0.9; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 64, 0.08) * 0.9 + lp(rng.standard_normal(t.size), 800) * env(t, 0.002, 0.04) * 0.6
    place(x, choir(0.5, (293.7, 370.0, 440.0), rng, 0.01, 0.16, amp=0.6), 0.005)
    x += bell(dur, 587.3, ratio=1.41, index=1.6, tau=0.3) * 0.22
    return finish(x, 0.85, 1.45)


def wr_leap_c():  # Leap Crash: the crouch, the push-off (lead 120), up and over and down onto him (the slam 140 ms later)
    rng = R(1030); dur = 0.36; t = T(dur); x = buf(dur)
    place(x, bp(rng.standard_normal(T(0.1).size), 1500, 6000) * env(T(0.1), 0.01, 0.03) * 0.3, 0.0)  # (cloth, the boots)
    place(x, thud(0.15, 130, 70, 0.03) + click(0.15, rng, 1500, 0.004, 0.4), 0.115, 0.9)  # (the push-off)
    up = svf(rng.standard_normal(t.size), 300 + 1500 * np.sin(np.pi * np.clip((t - 0.12) / 0.15, 0, 1)), 1.6)
    x += up * np.clip((t - 0.11) / 0.03, 0, 1) * (0.6 + 0.4 * np.clip((t - 0.2) / 0.06, 0, 1)) * np.clip((0.3 - t) / 0.04, 0, 1) * 0.9
    x += air(dur, 0.7, 6, rng, 230, 0.6)
    return finish(x, 0.84, 1.3)


def wr_leap_h():  # the sword smashes him down into the floor: a dull crunch, the planks cracking under him, the weight of it
    rng = R(1031); dur = 0.75; t = T(dur); x = buf(dur)
    x += thud(dur, 125, 45, 0.11, 0.03) * 1.2
    x += ring(dur, 470, [(1, 0.4, 0.06), (1.62, 0.3, 0.04)], rng) * 0.3
    x += lp(rng.standard_normal(t.size), 1400) * env(t, 0.0008, 0.04) * 1.1
    for s, a in ((0.008, 1.0), (0.03, 0.7)):  # (the planks under him)
        place(x, knock(0.07, rng.uniform(650, 900), 0.012, rng, 1.0) + hp(rng.standard_normal(T(0.07).size), 1800) * env(T(0.07), 0.0005, 0.006), s, a * 0.6)
    return finish(x, 0.86, 1.6)


def wr_leap_end():  # the crater: stone breaks, the planks splinter, the dust rolls out, embers hiss in the cracks
    rng = R(1032); dur = 1.5; t = T(dur); x = buf(dur)
    x += thud(dur, 105, 36, 0.22, 0.05) * 1.25
    x += lp(rng.standard_normal(t.size), 2400) * env(t, 0.0008, 0.05) * 1.1
    for s, a in ((0.0, 1.0), (0.018, 0.8), (0.04, 0.6), (0.07, 0.4)):  # (planks splintering: sharp wooden cracks)
        place(x, knock(0.08, rng.uniform(600, 950), 0.01, rng, 1.2) + hp(rng.standard_normal(T(0.08).size), 1500) * env(T(0.08), 0.0005, 0.008), s, a * 0.7)
    times = 0.04 + rng.exponential(0.1, 45); times = times[times < 0.7]
    x += grains(t.size, times, 0.35 * np.exp(-times / 0.3), [knock(0.05, f, 0.012, rng, 0.6) for f in (300, 420, 560)], rng)
    x += lp(brown(t.size, rng), 200) * np.clip(t / 0.05, 0, 1) * np.exp(-t / 0.5) * 0.9  # (the dust rolling out)
    x += hp(rng.standard_normal(t.size), 4500) * np.clip((t - 0.12) / 0.1, 0, 1) * np.exp(-np.maximum(0, t - 0.2) / 0.4) * (0.5 + 0.5 * (slow(rng, t.size, 30) > 0)) * 0.12  # (embers)
    return finish(x, 0.87, 1.55)


def wr_wave_c():  # Wave Slash: a two-hand rising swing (lead 250) releases a crescent of air that runs off along the planks, tearing chips up
    rng = R(1040); dur = 1.15; t = T(dur); x = buf(dur)
    place(x, swoosh(0.32, 200, 2200, 900, rng, peak=0.75, q=1.8, shape=2.4, tail=6) + air(0.32, 0.75, 6, rng, 240, 0.8), 0)
    run = np.clip((t - 0.25) / 0.6, 0, 1)
    band = svf(rng.standard_normal(t.size), 1800 * (1 - 0.55 * run), 3.5) * np.clip((t - 0.24) / 0.02, 0, 1) * np.exp(-np.maximum(0, t - 0.26) / 0.2)
    x += band * 1.1
    x += svf(rng.standard_normal(t.size), 2900 * (1 - 0.5 * run), 30) * np.clip((t - 0.24) / 0.03, 0, 1) * np.exp(-np.maximum(0, t - 0.26) / 0.18) * 2.0  # (it sings as it runs)
    times = 0.26 + rng.uniform(0, 0.55, 30)
    x += grains(t.size, times, rng.uniform(0.1, 0.35, 30) * np.exp(-(times - 0.26) / 0.35), [knock(0.03, f, 0.006, rng, 0.5) for f in (480, 640, 820)], rng)  # (chips)
    return finish(x, 0.84, 1.3)


def wr_wave_h():  # the crescent bites him and throws him up: a tearing slice of air, a white steel shing, chips flying
    rng = R(1041); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, svf(rng.standard_normal(T(0.14).size), np.linspace(900, 5200, int(SR * 0.14)), 1.8) * env(T(0.14), 0.002, 0.04), 0, 1.0)
    place(x, ring(0.7, 2650, [(1, 0.5, 0.16), (1.5, 0.35, 0.1), (2.24, 0.2, 0.06)], rng, beat=0.004, glide_to=1.04, gtau=0.08), 0.005, 0.55)
    x += thud(dur, 180, 70, 0.06) * 0.8
    times = rng.exponential(0.06, 18)
    x += grains(t.size, times, rng.uniform(0.2, 0.5, 18), [knock(0.03, f, 0.006, rng, 0.5) for f in (520, 700)], rng)
    place(x, swoosh(0.35, 600, 2800, 3200, rng, peak=0.3, q=2, tail=4), 0.02, 0.45)
    return finish(x, 0.86, 1.5)


def wr_cry_c():  # War Cry: a breath drawn in, then his roar (lead 300) and the shock ring of red air blowing the dust off the planks, the fury flickering
    rng = R(1050); dur = 1.35; t = T(dur); x = buf(dur)
    place(x, reverse(bp(rng.standard_normal(T(0.26).size), 500, 3500) * env(T(0.26), 0.002, 0.09)) * 0.12, 0.02)  # (the breath in)
    place(x, voice_roar(0.85, rng, 125, 178, 140, amp=0.9), 0.28)
    place(x, thud(0.7, 90, 40, 0.14, 0.05) * 1.1 + lp(rng.standard_normal(T(0.7).size), 500) * env(T(0.7), 0.003, 0.08) * 0.8, 0.3)
    place(x, swoosh(0.55, 300, 1500, 500, rng, peak=0.15, q=1.2, tail=4), 0.3, 0.6)  # (the ring of air out)
    place(x, flames(0.9, rng, 0.5, 45) * env(T(0.9), 0.08, 0.35), 0.4)  # (the red aura)
    return finish(x, 0.84, 1.25)


def wr_cry_h():  # the shock ring knocks a foe: a whump of hot air (fwoomp), dust, a lick of fire crackling on him
    rng = R(1051); dur = 0.7; t = T(dur); x = buf(dur)
    x += thud(dur, 140, 60, 0.07) * 0.7
    x += bp(rng.standard_normal(t.size), 220, 1400) * env(t, 0.003, 0.07) * 1.5
    x += lp(rng.standard_normal(t.size), 2600) * env(t, 0.006, 0.1) * 0.7
    x += flames(dur, rng, 1.0, 50) * env(t, 0.01, 0.16)
    return finish(x, 0.85, 1.45)


def wr_jblade_c():  # Judgment Blade: a giant sword of light falls point-down from the sky (a shriek coming down, a choir swelling: lead 120)
    # and lands (at 260 ms: a soft thoom of its own — the blow's sound comes on top when it pins someone)
    rng = R(1060); dur = 0.75; t = T(dur); u = t / 0.26
    gone = np.where(t < 0.26, 1.0, np.exp(-(t - 0.26) / 0.035))
    fall = svf(rng.standard_normal(t.size), 3600 * (900 / 3600) ** np.clip(u, 0, 1), 6) * np.clip(u, 0, 1) ** 1.5 * 1.8
    fall += whistle(dur, 3400, 950 * (950 / 3400) ** 1.9, rng, 24) * 1.4
    c = choir(dur, (196.0, 246.9, 293.7, 392.0), rng, 0.2, 0.3, amp=0.5)
    x = (fall + c) * gone
    place(x, thud(0.45, 120, 50, 0.09) * 0.7 + lp(rng.standard_normal(T(0.45).size), 900) * env(T(0.45), 0.002, 0.04) * 0.5, 0.26)
    return finish(x, 0.83, 1.3)


def wr_jblade_h():  # it drives in and pins him: KRANG — a great bell of judgment, the stone cracking, a ring of runes flaring round it
    rng = R(1061); dur = 2.0; t = T(dur); x = buf(dur)
    x += ring(dur, 196.0, [(r, a, min(tau, 0.42)) for r, a, tau in BELL], rng, att=0.001, beat=0.002) * 0.75
    x += thud(dur, 130, 45, 0.16, 0.04) * 1.0
    x += bp(rng.standard_normal(t.size), 300, 4000) * env(t, 0.0006, 0.03) * 1.1
    times = 0.02 + rng.exponential(0.08, 20); x += grains(t.size, times, 0.3 * np.exp(-times / 0.2), [knock(0.04, f, 0.01, rng, 0.5) for f in (420, 560)], rng)
    for k, f in enumerate((1568.0, 1760.0, 1975.5, 2349.3, 2637.0, 3136.0)):  # (the runes round it)
        place(x, bell(0.4, f, ratio=2.0, index=0.8, tau=0.1), 0.04 + k * 0.03, 0.14)
    return finish(x, 0.87, 1.45)


def wr_jblade_z():  # the pinned foe, every half second: the blade's light pulsing on him (a low hum swelling, a rune's ping)
    rng = R(1062); dur = 0.45; t = T(dur); x = buf(dur)
    x += (np.sin(2 * np.pi * 196 * t) + 0.6 * np.sin(2 * np.pi * 293.7 * t) + 0.3 * np.sin(2 * np.pi * 392 * t)) * np.sin(np.pi * np.clip(t / 0.4, 0, 1)) ** 2 * 0.3
    x += thud(dur, 140, 80, 0.05) * 0.5
    place(x, bell(0.3, 2349.3, ratio=2.0, index=0.6, tau=0.08), 0.01, 0.25)
    return finish(x, 0.8, 1.3)


def wr_grip_c():  # Iron Grip: the hand thrust out (lead 80), the gauntlet of iron light rattling shut round its fingers, a cold hum
    rng = R(1070); dur = 0.55; t = T(dur); x = buf(dur)
    place(x, swoosh(0.18, 300, 1500, 700, rng, peak=0.45, q=1.8, tail=5) + air(0.18, 0.45, 5, rng, 260, 0.6), 0)
    place(x, chain_rattle(0.12, rng, 90, 0.5, 0.6, 1100, 2600), 0.06)
    x += (np.sin(2 * np.pi * 330 * t) + 0.7 * np.sin(2 * np.pi * 333.5 * t) + 0.4 * np.sin(2 * np.pi * 990 * t)) * env(t, 0.05, 0.12) * 0.12
    return finish(x, 0.83, 1.3)


def wr_grip_b():  # the iron hand closes on him: a heavy clamp, the iron creaking tight, cold sparks
    rng = R(1071); dur = 0.6; t = T(dur); x = buf(dur)
    x += ring(dur, 610, [(1, 0.5, 0.06), (1.73, 0.45, 0.045), (2.9, 0.3, 0.03)], rng) * 0.7
    x += click(dur, rng, 2000, 0.003, 1.0) + thud(dur, 170, 90, 0.04) * 0.8
    cr = svf(rng.standard_normal(t.size), 700 + 150 * np.sin(2 * np.pi * 9 * t), 14) * np.clip((t - 0.05) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.1) / 0.12)
    x += cr * (0.5 + 0.5 * (slow(rng, t.size, 60) > 0)) * 0.6  # (the creak)
    times = rng.exponential(0.04, 16); x += grains(t.size, times, rng.uniform(0.2, 0.5, 16), crackle_kernels(rng, 4500, (0.0004, 0.0008)), rng)
    return finish(x, 0.85, 1.45)


def wr_grip_h():  # hoisted and flung up: the gauntlet wrenches (iron grinding), a dark iron clang, the links jangling, a short heave of air
    rng = R(1072); dur = 0.95; t = T(dur); x = buf(dur)
    grind = svf(rng.standard_normal(T(0.16).size), 520 + 260 * np.sin(2 * np.pi * 14 * T(0.16)), 10) * env(T(0.16), 0.01, 0.06)
    place(x, grind, 0, 0.9)
    place(x, ring(0.85, 290, [(1, 0.6, 0.2), (1.83, 0.45, 0.12), (2.71, 0.3, 0.07), (4.2, 0.15, 0.04)], rng, beat=0.003) * 0.7, 0.05)
    place(x, thud(0.8, 135, 48, 0.1, 0.03) * 1.15 + bp(rng.standard_normal(T(0.8).size), 200, 1500) * env(T(0.8), 0.001, 0.03) * 0.9, 0.05)
    place(x, chain_rattle(0.35, rng, 60, -0.5, 0.6, 700, 1900), 0.07)
    place(x, swoosh(0.3, 250, 1400, 1700, rng, peak=0.3, q=1.6, tail=4), 0.07, 0.5)
    return finish(x, 0.86, 1.55)


def wr_hook_c():  # Judgment Hook: the chain flung out (lead 60), its links running out after the hook, away (the bite: 150 ms in)
    rng = R(1080); dur = 0.5; t = T(dur); x = buf(dur)
    place(x, swoosh(0.2, 300, 1300, 700, rng, peak=0.3, q=2.0, tail=4), 0, 0.7)
    x += chain_rattle(dur, rng, 150, 0.5, 1.0, 700, 1900) * np.where(t < 0.16, 1.0, np.exp(-(t - 0.16) / 0.06))  # (heavy iron links)
    return finish(x, 0.83, 1.3)


def wr_hook_h():  # the hook bites (a chunk of iron, sparks), the chain snaps taut, and it reels him in (links rattling back)
    rng = R(1081); dur = 0.75; t = T(dur); x = buf(dur)
    x += ring(dur, 760, [(1, 0.5, 0.05), (1.61, 0.4, 0.035), (2.47, 0.25, 0.02)], rng) * 0.6 + click(dur, rng, 2200, 0.003, 1.0) + thud(dur, 180, 90, 0.035) * 0.7
    times = rng.exponential(0.03, 14); x += grains(t.size, times, rng.uniform(0.2, 0.5, 14), crackle_kernels(rng, 4000, (0.0004, 0.0008)), rng)
    taut = ring(0.35, 110, [(1, 0.6, 0.1), (2.0, 0.4, 0.07), (3.0, 0.3, 0.05), (4.0, 0.2, 0.03)], rng, att=0.002)  # (the chain snapping taut: a low twang)
    place(x, taut, 0.05, 0.45)
    place(x, chain_rattle(0.45, rng, 70, -0.6, 0.75), 0.12)
    place(x, reverse(swoosh(0.3, 800, 2200, 2600, rng, peak=0.4, q=2, tail=4)), 0.15, 0.4)
    return finish(x, 0.85, 1.45)


def wr_sky_c():  # Sky Breaker: two rising cuts and a third (at 60 / 170 / 280 ms), up into the air — then the dive, point-down, a white streak
    # (lead 30: the first cut's swing starts just before the strike)
    rng = R(1090); dur = 0.95; t = T(dur); x = buf(dur)
    for k, (s, f) in enumerate(((0.09, 2600), (0.2, 3000), (0.31, 3400))):
        sw = swoosh(0.12, 500, f, f * 1.15, rng, peak=0.7, q=2.6, shape=1.6, tail=5, whistle=0.35, wq=18)
        place(x, sw, s - 0.084, 0.85 - 0.08 * k)
    u = np.clip((t - 0.36) / 0.23, 0, 1); gone = np.where(t < 0.59, 1.0, np.exp(-(t - 0.59) / 0.03))  # (down at 590 ms: the landing's own sound takes over)
    dive = svf(rng.standard_normal(t.size), 4200 * (1300 / 4200) ** u, 5) * u ** 1.4 * (t > 0.36) * gone
    x += dive * 1.3 + whistle(dur, 4600, 1500 * (1500 / 4600) ** (0.36 / 0.59), rng, 26) * np.clip((t - 0.33) / 0.1, 0, 1) * gone * 1.6
    place(x, thud(0.35, 130, 55, 0.07) * 0.6, 0.59)
    return finish(x, 0.84, 1.3)


def wr_sky_h():  # the first cut lifts him: a thin bright tching, sweeping up
    rng = R(1091); dur = 0.55; x = buf(dur)
    place(x, ring(dur, 3050, [(1, 0.55, 0.12), (1.36, 0.4, 0.08), (2.05, 0.25, 0.05)], rng, beat=0.003, glide_to=1.08, gtau=0.06), 0)
    place(x, click(0.2, rng, 3000, 0.003, 0.9), 0)
    place(x, thud(0.3, 200, 90, 0.035), 0, 0.6)
    place(x, swoosh(0.3, 900, 3400, 4200, rng, peak=0.25, q=2.4, tail=4), 0.01, 0.4)
    return finish(x, 0.85, 1.5)


def wr_sky_end():  # the landing, point-down into the stone: the blade's tip chips it (KTANG), the floor cracks, rubble, dust
    rng = R(1093); dur = 1.2; t = T(dur); x = buf(dur)
    place(x, ring(0.5, 1850, [(1, 0.5, 0.08), (1.29, 0.4, 0.06), (2.11, 0.3, 0.04), (3.07, 0.2, 0.025)], rng), 0, 0.6)
    x += thud(dur, 115, 40, 0.17, 0.04) * 1.2
    x += lp(rng.standard_normal(t.size), 2600) * env(t, 0.0006, 0.04) * 1.0
    place(x, hp(rng.standard_normal(T(0.12).size), 900) * env(T(0.12), 0.0006, 0.015), 0.012, 0.7)  # (the crack)
    times = 0.03 + rng.exponential(0.08, 30); times = times[times < 0.5]
    x += grains(t.size, times, 0.3 * np.exp(-times / 0.2), [knock(0.05, f, 0.012, rng, 0.6) for f in (340, 470, 610)], rng)
    x += lp(brown(t.size, rng), 180) * np.clip(t / 0.04, 0, 1) * np.exp(-t / 0.35) * 0.7
    return finish(x, 0.87, 1.55)


def wr_split_w():  # Earthsplitter, the hold: the ground trembling under him, stones cracking open round his feet, the glow in them rising
    rng = R(1100); dur = 1.35; t = T(dur); u = np.clip(t / 0.85, 0, 1)
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * (7 + 4 * u) * t)
    x = lp(brown(t.size, rng), 120) * trem * u ** 1.2 * 1.3
    times = np.sort(0.85 * rng.random(26) ** 0.6)
    x += grains(t.size, times, rng.uniform(0.15, 0.45, 26) * (0.4 + times), [knock(0.04, f, 0.008, rng, 0.9) for f in (520, 700, 880)], rng)  # (cracks)
    x += hp(saw(48 * (1 + 0.25 * u), cap=1500), 80) * u ** 2 * 0.25  # (the molten glow, rising)
    return finish(x * np.where(t < 0.85, 1.0, np.exp(-(t - 0.85) / 0.1)), 0.82, 1.25)


def wr_split_c():  # the release: the sword driven down, a fissure tearing away along the floor, rock spikes thrusting up behind it
    rng = R(1101); dur = 1.3; t = T(dur); x = buf(dur)
    place(x, thud(0.5, 140, 50, 0.08) + click(0.5, rng, 1800, 0.004, 0.7) + ring(0.5, 700, [(1, 0.4, 0.05), (1.7, 0.3, 0.03)], rng) * 0.4, 0, 1.0)
    for k in range(7):  # (the fissure running away: each crack farther, duller)
        s = 0.03 + k * 0.045; far = 1 - 0.1 * k
        place(x, lp(hp(rng.standard_normal(T(0.09).size), 500) * env(T(0.09), 0.0006, 0.014), 6000 * far), s, 0.8 * far)
        place(x, knock(0.07, rng.uniform(260, 380), 0.02, rng, 0.8), s + 0.02, 0.6 * far)  # (a spike thrusting up)
    x += lp(brown(t.size, rng), 140) * np.clip(t / 0.05, 0, 1) * np.exp(-t / 0.4) * 0.9
    return finish(x, 0.85, 1.3)


def wr_split_h():  # a spike of rock erupts under him and knocks him flat: a crunch thrusting up, the deep thud
    rng = R(1102); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, svf(rng.standard_normal(T(0.12).size), np.linspace(400, 2600, int(SR * 0.12)), 1.4) * env(T(0.12), 0.002, 0.04), 0, 1.0)
    x += thud(dur, 120, 42, 0.14, 0.04) * 1.2
    x += knock(dur, 230, 0.05, rng, 1.0) * 0.6
    times = 0.02 + rng.exponential(0.07, 20); x += grains(t.size, times, 0.3 * np.exp(-times / 0.2), [knock(0.04, f, 0.01, rng, 0.6) for f in (360, 500)], rng)
    return finish(x, 0.86, 1.55)


def wr_lion_c():  # Lion's Maw: a lion's roar out of him (from the start: lead 150), the lion of crimson flame leaping from his hand
    rng = R(1110); dur = 1.0; t = T(dur); x = buf(dur)
    lion = growl(0.8, rng, 85, 150, 95, 0.9)
    lion *= 1 + 0.35 * np.sin(2 * np.pi * 31 * T(0.8))  # (the snarl in it)
    place(x, lion, 0.0)
    place(x, lp(rng.standard_normal(T(0.5).size), 1400) * env(T(0.5), 0.02, 0.12) * 0.9, 0.14)  # (fwoom: it leaps)
    place(x, flames(0.75, rng, 0.8, 40) * env(T(0.75), 0.03, 0.25), 0.15)
    place(x, swoosh(0.4, 400, 1800, 900, rng, peak=0.3, q=1.4, tail=4), 0.1, 0.5)
    return finish(x, 0.84, 1.25)


def wr_lion_h():  # the jaws snap shut on him and drag him in: a fiery CHOMP, flame bursting, pulled back through the air
    rng = R(1111); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, knock(0.2, 380, 0.025, rng, 1.2) + click(0.2, rng, 1500, 0.004, 1.0), 0, 1.0)  # (the snap of the jaws)
    x += thud(dur, 130, 45, 0.12, 0.035) * 1.1
    x += lp(rng.standard_normal(t.size), 1600) * env(t, 0.001, 0.06) * 0.9
    x += flames(dur, rng, 0.7, 40) * env(t, 0.01, 0.25)
    place(x, reverse(swoosh(0.35, 600, 2000, 2400, rng, peak=0.35, q=1.6, tail=4)), 0.05, 0.6)
    return finish(x, 0.86, 1.55)


def wr_charge_c():  # Shield Charge: the charge (lead 40) — heavy strides, a rush of air, the iron-blue barrier humming at his shoulder;
    # the stop: a skid, sparks, the barrier's crackle like ice
    rng = R(1120); dur = 0.62; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.085, 0.17)):
        place(x, thud(0.12, 120, 65, 0.03) + click(0.12, rng, 1200, 0.004, 0.35), s, 0.9)
    place(x, swoosh(0.32, 250, 1300, 800, rng, peak=0.65, q=1.5, shape=1.4, tail=5) + air(0.32, 0.65, 5, rng, 220, 0.7), 0, 1.0)
    hum = (np.sin(2 * np.pi * 660 * t) + np.sin(2 * np.pi * 664 * t) + 0.5 * np.sin(2 * np.pi * 990 * t) + 0.3 * np.sin(2 * np.pi * 1985 * t))
    x += hum * np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.26) / 0.08) * 0.08
    place(x, svf(rng.standard_normal(T(0.14).size), 1600, 3) * env(T(0.14), 0.005, 0.05) * 0.5, 0.25)  # (the skid)
    times = 0.26 + rng.exponential(0.03, 22); x += grains(t.size, times, rng.uniform(0.15, 0.45, 22), crackle_kernels(rng, 4000, (0.0004, 0.0008)), rng)
    for k in range(3):
        place(x, bell(0.2, rng.uniform(3500, 6000), ratio=2.76, index=0.6, tau=0.05), 0.27 + 0.02 * k, 0.12)  # (ice-like)
    return finish(x, 0.84, 1.3)


SOUNDS5 = {
    'wr_dash_c': wr_dash_c, 'wr_dash_h': wr_dash_h, 'wr_whirl_c': wr_whirl_c, 'wr_whirl_h': wr_whirl_h, 'wr_sanct_c': wr_sanct_c, 'wr_sanct_h': wr_sanct_h,
    'wr_leap_c': wr_leap_c, 'wr_leap_h': wr_leap_h, 'wr_leap_end': wr_leap_end, 'wr_wave_c': wr_wave_c, 'wr_wave_h': wr_wave_h,
    'wr_cry_c': wr_cry_c, 'wr_cry_h': wr_cry_h, 'wr_jblade_c': wr_jblade_c, 'wr_jblade_h': wr_jblade_h, 'wr_jblade_z': wr_jblade_z,
    'wr_grip_c': wr_grip_c, 'wr_grip_b': wr_grip_b, 'wr_grip_h': wr_grip_h, 'wr_hook_c': wr_hook_c, 'wr_hook_h': wr_hook_h,
    'wr_sky_c': wr_sky_c, 'wr_sky_h': wr_sky_h, 'wr_sky_end': wr_sky_end,
    'wr_split_w': wr_split_w, 'wr_split_c': wr_split_c, 'wr_split_h': wr_split_h, 'wr_lion_c': wr_lion_c, 'wr_lion_h': wr_lion_h,
    'wr_charge_c': wr_charge_c,
}


# ---------------------------------------------------------------- ARCHER, the rest of her kit — in DFO's families: WIND
# her shots and footwork (air, leaves, the bow), THORN traps and binds (vines, roots, creaking wood), STORM Thunder Rain
# (lightning out of a dark cloud), SPIRIT the beasts of light (the hawk, the wolf, the eagle: a cry with a shimmer in it)

def creak(dur, rng, f=420.0, rate=(40.0, 110.0), amp=1.0, q=9.0):
    """Wood bending (a bow drawn, a root growing): stick-slip ticks at a wandering rate, through the wood's resonance."""
    n = T(dur).size; times = []; tm = 0.0
    r0, r1 = rate
    while tm < dur:
        times.append(tm); r = r0 + (r1 - r0) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * tm + 1.0)); tm += rng.uniform(0.7, 1.3) / r
    times = np.asarray(times)
    imp = grains(n, times, rng.uniform(0.4, 1, times.size), [np.exp(-np.arange(int(SR * 0.004)) / (SR * 0.0008))], rng)
    y = svf(imp, f, q)
    return y / (y.std() + 1e-12) * 0.22 * amp


def whip(rng, amp=1.0):
    """A whip's crack: the lash rushing up to the tip, then the crack itself (a hard tiny burst)."""
    x = buf(0.25)
    place(x, swoosh(0.12, 600, 5000, 6000, rng, peak=0.95, q=1.8, shape=2.6, tail=3), 0, 0.6)
    place(x, hp(rng.standard_normal(T(0.02).size), 2000) * env(T(0.02), 0.0001, 0.0025) * 1.6 + click(0.02, rng, 1200, 0.0008, 1.0), 0.112)
    return x * amp


def howl(dur, rng, f0=330.0, f1=560.0, f2=420.0, amp=1.0):
    """A spirit wolf's howl: a pure voice gliding up and holding, an 'oo' opening to 'ow', a ghostly double a hair apart."""
    t = T(dur); u = t / dur
    f = np.where(u < 0.3, f0 + (f1 - f0) * np.sin(np.pi / 2 * np.clip(u / 0.3, 0, 1)), f1 + (f2 - f1) * np.clip((u - 0.62) / 0.38, 0, 1) ** 1.5)
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.2) / 0.2, 0, 1))
    src = saw(f, cap=4000) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.8
    vow = formants(src, ((380 + 300 * np.clip(u / 0.5, 0, 1).mean(), 1.0, 160), (900, 0.35, 220), (2600, 0.12, 400)))
    ghost = np.sin(2 * np.pi * np.cumsum(f * 2.003) / SR) * 0.18 + np.sin(2 * np.pi * np.cumsum(f * 3.01) / SR) * 0.07  # (its spirit shimmer)
    a = np.where(u < 0.12, (u / 0.12) ** 1.5, np.where(u < 0.7, 1.0, np.cos(np.pi / 2 * np.clip((u - 0.7) / 0.3, 0, 1)) ** 1.5))
    return (vow * 0.9 + ghost + hp(rng.standard_normal(t.size), 1500) * 0.03) * a * amp


def screech(dur, rng, f0=3100.0, f1=2300.0, amp=1.0):
    """A raptor's cry ('kee-eeer'): a high rough tone falling at the end, nasal, a rasp in it."""
    t = T(dur); u = t / dur
    f = f0 * (1 + 0.06 * np.sin(np.pi * np.clip(u / 0.25, 0, 1))) * np.where(u < 0.55, 1.0, (f1 / f0) ** np.clip((u - 0.55) / 0.45, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph + 0.9 * np.sin(ph * 0.5)) + 0.4 * np.sin(2 * ph)
    rough = 1 + 0.45 * np.sin(2 * np.pi * 75 * t) * slow(rng, t.size, 40)
    a = np.where(u < 0.08, u / 0.08, np.where(u < 0.7, 1.0, np.cos(np.pi / 2 * np.clip((u - 0.7) / 0.3, 0, 1))))
    return bp(tone * rough, 1200, 7000, order=2) * a * amp


def wings(times, rng, f=420.0, amp=1.0, size=1.0):
    """Wing beats: a soft whomp of air on each downstroke."""
    out = buf(max(times) + 0.3 * size)
    for tm in times:
        d = 0.16 * size; tt = T(d)
        w = svf(rng.standard_normal(tt.size), f * (1.6 - 0.8 * tt / d), 1.2) * np.sin(np.pi * tt / d) ** 2
        place(out, w + lp(rng.standard_normal(tt.size), 300) * np.sin(np.pi * tt / d) ** 3 * 0.6, tm, amp)
    return out


def thunder(dur, rng, amp=1.0, crack_amp=1.0):
    """A thunderbolt: the crack of the strike (an arc, a hard burst), then the rolling rumble."""
    t = T(dur); x = buf(dur)
    place(x, (hp(rng.standard_normal(T(0.05).size), 1500) * env(T(0.05), 0.0002, 0.008) * 1.4 + arc(0.05, rng, f=140, jit=0.5) * env(T(0.05), 0.001, 0.02)) * crack_amp, 0)
    roll = lp(brown(t.size, rng), 160) * (0.6 + 0.4 * np.clip(slow(rng, t.size, 6) + 0.5, 0, 1.6))
    x += roll * np.clip(t / 0.02, 0, 1) * np.exp(-t / (dur * 0.27)) * 1.4
    x += lp(rng.standard_normal(t.size), 900) * env(t, 0.001, 0.05) * 0.8
    times = rng.exponential(0.06, 25); x += grains(t.size, times, rng.uniform(0.1, 0.4, 25) * np.exp(-times / 0.15), crackle_kernels(rng), rng)
    return x * amp


def ar_step_c():  # Wind Step: a gust ring bursts under her (lead 40), the back somersault (a whirl of air, the bow sweeping), the arrow loosed upside-down at the top
    rng = R(1201); dur = 0.62; t = T(dur); x = buf(dur)
    place(x, lp(rng.standard_normal(T(0.3).size), 1200) * env(T(0.3), 0.004, 0.06) * 0.8 + thud(0.3, 140, 70, 0.04) * 0.5, 0.03)  # (the gust ring)
    roll = svf(rng.standard_normal(t.size), 700 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t)), 1.8) * np.sin(np.pi * np.clip((t - 0.04) / 0.32, 0, 1)) * 0.8
    x += roll
    x += rustle(dur, rng, 300, 2500, 9000, 0.3) * env(t, 0.05, 0.15)
    place(x, twang(R(1202), 158, 0.18, whistle_amp=0.18), 0.3, 0.8)
    return finish(x, 0.84, 1.3)


def ar_step_h():  # the arrow shot from the top of the flip lifts him: a bright thunk, and the air whirling up round him (the flip's gust)
    rng = R(1203); dur = 0.6; t = T(dur); x = buf(dur)
    x += click(dur, rng, 3200, 0.0008, 1.0) + np.sin(2 * np.pi * 900 * t) * env(t, 0.0004, 0.02) * 0.7
    whirl = svf(rng.standard_normal(t.size), 2200 + 1300 * np.sin(2 * np.pi * 16 * t), 3.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 16 * t + 1.2))
    x += whirl * env(t, 0.015, 0.12) * 0.9  # (a twirl of air, not a gust)
    place(x, whistle(0.3, 2600, 4200, rng, 24), 0.01, 0.6)
    return finish(x, 0.85, 1.45)


def ar_triple_c():  # Triple Arrow: a quick side-step, the bow turned flat (a creak), three arrows loosed as one (lead 180) — three trails fanning out
    rng = R(1210); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, svf(rng.standard_normal(T(0.09).size), 1800, 2) * env(T(0.09), 0.005, 0.03) * 0.5, 0.0)  # (the step)
    place(x, creak(0.09, rng, 460, (70, 120), 0.8), 0.07)
    for k, f in enumerate((140, 151, 163)):
        place(x, twang(R(1211 + k), f, 0.2, whistle_amp=0.0), 0.18 + 0.004 * k, 0.5)
    for k, (f0, f1) in enumerate(((2800, 2400), (3300, 3300), (3900, 4300))):  # (three wind trails, each its own way)
        place(x, whistle(0.32, f0, f1, rng, 26), 0.19, 0.55)
        place(x, swoosh(0.22, 800, 3000 + 400 * k, 2200, rng, peak=0.15, q=2.2, tail=4), 0.185, 0.25)
    return finish(x, 0.84, 1.3)


def ar_triple_h():  # the three land as one: thk-thk-thk, a puff of leaves
    rng = R(1215); dur = 0.45; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.022, 0.041)):
        place(x, ar_arrow_hit(1216 + k), s, 0.6)
    x += rustle(dur, rng, 300, 3000, 9000, 0.2) * env(t, 0.01, 0.1)
    return finish(x, 0.85, 1.5)


def ar_back_c():  # Backstep Shot: the back flip out of reach (a tucked whirl of air), the shot from its top (at 120 ms)
    rng = R(1220); dur = 0.5; t = T(dur); x = buf(dur)
    place(x, svf(rng.standard_normal(T(0.28).size), 600 + 1400 * np.sin(np.pi * T(0.28) / 0.28), 1.6) * np.sin(np.pi * T(0.28) / 0.28) ** 1.5 * 0.7, 0)
    place(x, twang(R(1221), 168, 0.18, whistle_amp=0.2), 0.12, 0.85)
    x += rustle(dur, rng, 200, 3000, 9000, 0.15) * env(t, 0.02, 0.12)
    return finish(x, 0.84, 1.3)


def ar_back_h():  # it lands: a light thunk and a puff of wind
    rng = R(1222); dur = 0.4; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2800, 0.0008, 0.8) + np.sin(2 * np.pi * 820 * t) * env(t, 0.0004, 0.014) * 0.6 + thud(dur, 200, 100, 0.025) * 0.5
    place(x, swoosh(0.22, 1200, 3200, 2600, rng, peak=0.15, q=1.8, tail=4), 0.004, 0.5)
    return finish(x, 0.84, 1.5)


def ar_kick_c():  # Retreat Kick: the leg whips round (peaking on the kick: lead 90) in a boot of swirling wind, then she springs back
    rng = R(1230); dur = 0.5; t = T(dur); x = buf(dur)
    place(x, swoosh(0.13, 300, 2200, 900, rng, peak=0.7, q=2, shape=2.2, tail=5) + air(0.13, 0.7, 5, rng, 320, 0.5), 0, 1.0)
    swirl = svf(rng.standard_normal(t.size), 1100 + 700 * np.sin(2 * np.pi * 12 * t), 3) * env(t, 0.06, 0.1) * 0.6
    x += swirl
    place(x, swoosh(0.18, 500, 1400, 800, rng, peak=0.4, q=1.5, tail=4), 0.18, 0.4)  # (the spring back)
    return finish(x, 0.84, 1.3)


def ar_kick_h():  # the boot lands square and throws him up: a meaty THWACK (the leather slapping), a short low gust under it
    rng = R(1231); dur = 0.6; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 55, 0.08, 0.025) * 1.25
    x += bp(rng.standard_normal(t.size), 250, 1600) * env(t, 0.0006, 0.025) * 1.3  # (the slap of it)
    x += knock(dur, 210, 0.03, rng, 0.4) * 0.5
    place(x, swoosh(0.25, 250, 1100, 900, rng, peak=0.25, q=1.4, tail=4), 0.01, 0.5)
    return finish(x, 0.86, 1.5)


def ar_mine_c():  # Vine Mine: a hop back, the seed driven into the floor (lead 150: a woody thock), roots spreading under it, creaking
    rng = R(1240); dur = 1.0; t = T(dur); x = buf(dur)
    place(x, swoosh(0.14, 400, 1500, 700, rng, peak=0.4, q=1.6, tail=4), 0.0, 0.5)
    place(x, knock(0.15, 300, 0.03, rng, 1.0) + thud(0.15, 160, 80, 0.03) * 0.6, 0.15, 0.9)
    place(x, creak(0.5, rng, 330, (30, 70), 1.0) * env(T(0.5), 0.05, 0.18), 0.17)
    place(x, rustle(0.5, rng, 260, 2000, 7000, 0.35) * env(T(0.5), 0.05, 0.15), 0.17)
    x += lp(brown(t.size, rng), 120) * np.clip((t - 0.15) / 0.1, 0, 1) * np.exp(-np.maximum(0, t - 0.2) / 0.16) * 0.5
    return finish(x, 0.82, 1.25)


def ar_mine_z():  # stepped on: the mine snaps shut on his foot like a trap's jaws (a woody CLACK), the vines tightening on it
    rng = R(1241); dur = 0.55; t = T(dur); x = buf(dur)
    place(x, knock(0.12, 620, 0.012, rng, 1.4) + knock(0.12, 940, 0.008, rng, 0.8) * 0.6 + click(0.12, rng, 1500, 0.002, 0.8), 0.0, 1.0)
    place(x, thud(0.2, 170, 90, 0.03), 0.0, 0.5)
    place(x, creak(0.32, rng, 330, (50, 120), 0.9) * env(T(0.32), 0.01, 0.14), 0.05)
    x += rustle(dur, rng, 300, 2500, 8000, 0.2) * env(t, 0.05, 0.1)
    return finish(x, 0.83, 1.35)


def ar_mine_h():  # the mine erupts: roots tearing up out of the floor — a woody crunch, the planks and roots cracking, the roots groaning
    rng = R(1243); dur = 1.1; t = T(dur); x = buf(dur)
    x += thud(dur, 110, 40, 0.14, 0.04) * 1.2
    x += bp(rng.standard_normal(t.size), 150, 900) * env(t, 0.002, 0.06) * 1.3  # (the crunch)
    times = rng.exponential(0.07, 40); x += grains(t.size, times, rng.uniform(0.3, 0.8, 40) * np.exp(-times / 0.2), [knock(0.06, f, 0.015, rng, 1.2) for f in (250, 340, 460, 620)], rng)
    place(x, creak(0.6, rng, 240, (20, 60), 1.2) * env(T(0.6), 0.02, 0.25), 0.05)
    x += rustle(dur, rng, 400, 2000, 7000, 0.3) * env(t, 0.02, 0.2)
    return finish(x, 0.87, 1.5)


def ar_thunder_c():  # Thunder Rain: she leaps and looses arrows straight up into the sky (twangs, whistles rising), the dark cloud gathering,
    # static crackling as it charges (the first bolt 600 ms in)
    rng = R(1250); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, swoosh(0.3, 300, 1600, 900, rng, peak=0.35, q=1.5, tail=4) + air(0.3, 0.35, 4, rng, 280, 0.5), 0, 0.7)
    for k in range(4):
        place(x, twang(R(1251 + k), 150 + 12 * k, 0.16, whistle_amp=0.0), 0.04 + 0.035 * k, 0.45)
        place(x, whistle(0.45, 2600 + 300 * k, 4200 + 300 * k, rng, 28), 0.05 + 0.035 * k, 0.4)
    gather = lp(brown(t.size, rng), 90) * np.clip((t - 0.15) / 0.45, 0, 1) ** 1.6 * np.exp(-np.maximum(0, t - 0.62) / 0.05) * 1.6
    x += gather
    times = np.sort(0.25 + 0.38 * rng.random(30) ** 0.5)
    x += grains(t.size, times, rng.uniform(0.05, 0.25, 30) * (times - 0.2) * 2, crackle_kernels(rng, 3000), rng)
    return finish(x, 0.83, 1.3)


def ar_thunder_b():  # a bolt strikes: KRAK, a short roll
    rng = R(1255)
    return finish(thunder(1.15, rng, 1.0, 1.0), 0.85, 1.5)


def ar_thunder_h():  # the great bolt: KRA-KOOM, the thunder rolling on
    rng = R(1256); dur = 1.6; x = thunder(dur, rng, 1.3, 1.4)
    place(x, thud(0.9, 90, 32, 0.25, 0.05), 0, 1.0)
    place(x, arc(0.12, rng, f=110, jit=0.5) * env(T(0.12), 0.001, 0.05), 0.02, 0.5)
    return finish(x, 0.87, 1.5)


def ar_thunder_z():  # the charged floor catches him: a zap out of the planks, crackling
    rng = R(1257); dur = 0.45; t = T(dur); x = buf(dur)
    place(x, zap(rng, 0.08, 0.9), 0)
    x += grains(t.size, rng.exponential(0.06, 18), rng.uniform(0.2, 0.5, 18), crackle_kernels(rng, 2500), rng)
    x += thud(dur, 150, 70, 0.04) * 0.5
    return finish(x, 0.84, 1.4)


def ar_spirit_c():  # Spirit Bow: the bow drawn slow and hard (creaking), a cyan spirit gathering on the arrow (a rising shimmer), the release
    # (lead 400): a deep twang and the spirit arrow singing away — SHWEEEN
    rng = R(1260); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, creak(0.38, rng, 300, (25, 60), 1.0) * np.clip(T(0.38) / 0.3, 0, 1), 0.0)
    u = np.clip(t / 0.4, 0, 1)
    sh = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.35 * u)) / SR + i) for i, f in enumerate((880.0, 1320.0, 1760.0, 2215.0)))
    x += sh * u ** 2 * np.where(t < 0.4, 1.0, np.exp(-(t - 0.4) / 0.05)) * 0.06
    place(x, twang(R(1261), 98, 0.3, 0.994, thwip=1.5, whistle_amp=0.0), 0.4, 0.9)
    st = T(0.45); f = 3600 * (1 - 0.2 * st / 0.45)
    streak = flange(svf(rng.standard_normal(st.size), f, 14), 0.0005, 0.004, 6, 0.8) * 1.4 + np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR) * 0.12
    place(x, streak * env(st, 0.004, 0.14), 0.405)
    return finish(x, 0.84, 1.3)


def ar_spirit_h():  # it pierces him and knocks him flat: TSHHK, a glassy ring of the spirit, the thump, the line going on through
    rng = R(1262); dur = 0.95; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2600, 0.002, 1.0) + hp(rng.standard_normal(t.size), 3000) * env(t, 0.0005, 0.02) * 0.8
    x += sum(bell(dur, f, ratio=2.01, index=1.2, tau=0.22) for f in (1760.0, 2215.0, 2637.0)) * 0.13
    x += thud(dur, 150, 50, 0.1, 0.03) * 1.0
    place(x, svf(rng.standard_normal(T(0.4).size), np.linspace(3200, 2200, T(0.4).size), 10) * env(T(0.4), 0.003, 0.12) * 1.2, 0.01)
    return finish(x, 0.86, 1.5)


def ar_roar_c():  # Hunter's Roar: the spirit wolf rising behind her and howling (lead 260: the howl from the start), the wave of wind at its height
    rng = R(1270); dur = 1.25; t = T(dur); x = buf(dur)
    place(x, howl(1.05, rng, 300, 560, 400, 0.6), 0.0)
    place(x, swoosh(0.6, 300, 1600, 600, rng, peak=0.15, q=1.2, tail=4) + air(0.6, 0.15, 4, rng, 260, 0.9), 0.24, 1.2)
    place(x, thud(0.4, 110, 55, 0.08) * 0.8, 0.26)  # (the wave goes out)
    x += rustle(dur, rng, 300, 2500, 9000, 0.25) * np.clip((t - 0.26) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.3) / 0.2)
    return finish(x, 0.84, 1.25)


def ar_roar_h():  # the wave throws him back: a gust slamming in, the spirit's whoom and shimmer, leaves
    rng = R(1271); dur = 0.75; t = T(dur); x = buf(dur)
    x += thud(dur, 140, 58, 0.08) * 1.0 + lp(rng.standard_normal(t.size), 1000) * env(t, 0.002, 0.05) * 0.9
    x += sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((587.3, 880.0, 1174.7))) * env(t, 0.005, 0.18) * 0.1
    x += rustle(dur, rng, 450, 2500, 9000, 0.3) * env(t, 0.01, 0.15)
    place(x, swoosh(0.4, 1500, 600, 300, rng, peak=0.1, q=1.4, tail=4), 0.0, 0.5)
    return finish(x, 0.86, 1.45)


def ar_bind_c():  # Binding Leaves: the arrow loosed into the floor (lead 150), and roots tear up along the line toward him, creaking and cracking
    rng = R(1280); dur = 1.15; t = T(dur); x = buf(dur)
    place(x, twang(R(1281), 132, 0.2, whistle_amp=0.15), 0.15, 0.75)
    place(x, knock(0.12, 280, 0.025, rng, 0.9), 0.2, 0.7)
    for k in range(6):  # (the roots tearing up along the line, one after another)
        place(x, knock(0.07, rng.uniform(380, 560), 0.015, rng, 1.0) + hp(rng.standard_normal(T(0.07).size), 1200) * env(T(0.07), 0.0006, 0.008) * 0.6, 0.21 + 0.035 * k, 0.5)
    place(x, creak(0.5, rng, 360, (40, 100), 1.0) * env(T(0.5), 0.02, 0.2), 0.22)
    x += rustle(dur, rng, 350, 2000, 8000, 0.3) * np.clip((t - 0.2) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.3) / 0.25)
    return finish(x, 0.83, 1.3)


def ar_bind_h():  # caught: the roots whip round him and bind him tight (lashes, wood creaking tight, leaves)
    rng = R(1282); dur = 0.6; t = T(dur); x = buf(dur)
    place(x, whip(rng, 0.55), 0.0); place(x, whip(R(1283), 0.45), 0.04); place(x, whip(R(1284), 0.35), 0.075)
    place(x, creak(0.35, rng, 420, (80, 160), 1.0) * env(T(0.35), 0.01, 0.15), 0.12)
    x += thud(dur, 170, 85, 0.035) * 0.5 + rustle(dur, rng, 350, 2500, 8000, 0.25) * env(t, 0.1, 0.12)
    return finish(x, 0.84, 1.4)


def ar_hawk_c():  # Spirit Hawk: the hawk of light called out (lead 250): its cry, its wings beating up, a shimmer
    rng = R(1290); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, screech(0.42, rng, 3200, 2300, 0.55), 0.05)
    place(x, wings([0.08, 0.2, 0.32], rng, 450, 0.8), 0.0)
    x += sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((1318.5, 1975.5, 2637.0))) * env(t, 0.1, 0.2) * 0.04
    return finish(x, 0.83, 1.3)


def ar_hawk_b():  # its first pass: wings fluttering past, a chirp, the talons' light rake
    rng = R(1291); dur = 0.45; t = T(dur); x = buf(dur)
    place(x, wings([0.0, 0.07], rng, 700, 0.6, 0.7), 0.0)
    place(x, screech(0.08, rng, 3800, 3300, 0.3), 0.06)
    place(x, svf(rng.standard_normal(T(0.06).size), 3600, 4) * env(T(0.06), 0.002, 0.015) * 0.8 + click(0.06, rng, 3000, 0.001, 0.5), 0.13)
    return finish(x, 0.83, 1.45)


def ar_hawk_h():  # the hawk dives on him and strikes him down: a short shriek coming down, the talons' thwack
    rng = R(1292); dur = 0.7; t = T(dur); x = buf(dur)
    place(x, screech(0.16, rng, 3600, 2600, 0.35), 0.0)
    dv = T(0.16); place(x, svf(rng.standard_normal(dv.size), 2400 * (900 / 2400) ** (dv / 0.16), 3) * (dv / 0.16) ** 2 * 1.0, 0.0)
    place(x, click(0.4, rng, 2000, 0.002, 1.0) + thud(0.4, 150, 55, 0.07) * 1.0 + bp(rng.standard_normal(T(0.4).size), 500, 3000) * env(T(0.4), 0.0006, 0.015) * 0.8, 0.16)
    place(x, wings([0.0, 0.12], rng, 500, 0.4), 0.2)
    return finish(x, 0.85, 1.5)


def ar_tree_c():  # Tree of Life: a sapling of light grows up out of the floor (wood creaking upward, leaves unfurling) and blooms at the strike
    # (lead 450): a warm chord of healing
    rng = R(1300); dur = 1.45; t = T(dur); x = buf(dur)
    g = creak(0.45, rng, 300, (25, 90), 1.0) * np.clip(T(0.45) / 0.4, 0, 1)
    place(x, svf(g, np.linspace(280, 700, g.size), 6), 0.0, 1.0)
    x += rustle(dur, rng, 320, 2500, 9000, 0.3) * np.clip(t / 0.45, 0, 1) * np.exp(-np.maximum(0, t - 0.55) / 0.25)
    for k, f in enumerate((440.0, 554.4, 659.3, 880.0, 1108.7)):
        place(x, pluck(0.9, f, R(1301 + k), 0.995, 0.6) * env(T(0.9), 0.002, 0.4), 0.45 + 0.03 * k, 0.32)
        place(x, bell(0.8, f * 2, ratio=2.0, index=0.6, tau=0.3), 0.46 + 0.03 * k, 0.07)
    place(x, lp(rng.standard_normal(T(0.6).size), 700) * env(T(0.6), 0.02, 0.12) * 0.5, 0.42)
    return finish(x, 0.82, 1.25)


def ar_tree_h():  # its bloom pushes a foe back: a soft woody whump, leaves, a chime
    rng = R(1305); dur = 0.6; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 70, 0.06) * 0.9 + knock(dur, 260, 0.03, rng, 0.5) * 0.5
    x += rustle(dur, rng, 400, 2500, 9000, 0.3) * env(t, 0.01, 0.15)
    place(x, bell(0.5, 1318.5, ratio=2.0, index=0.8, tau=0.15), 0.01, 0.2)
    return finish(x, 0.84, 1.4)


def ar_lash_c():  # Vine Lash: the arm whips out and a thorny vine cracks out of her hand (the crack on the strike: lead 140)
    rng = R(1310); dur = 0.6; t = T(dur); x = buf(dur)
    place(x, swoosh(0.16, 300, 1400, 900, rng, peak=0.7, q=1.6, tail=5) + air(0.16, 0.7, 5, rng, 300, 0.4), 0.0, 0.7)
    place(x, whip(rng, 1.0), 0.028)
    x += rustle(dur, rng, 300, 2500, 8000, 0.3) * np.clip((t - 0.08) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - 0.15) / 0.1)
    return finish(x, 0.84, 1.3)


def ar_lash_h():  # it coils round him (thorns rasping tight) and yanks him in (a snap, pulled back through the air)
    rng = R(1311); dur = 0.6; t = T(dur); x = buf(dur)
    place(x, svf(rng.standard_normal(T(0.15).size), 2600, 4) * (0.5 + 0.5 * (slow(rng, T(0.15).size, 120) > 0)) * env(T(0.15), 0.005, 0.06) * 0.6, 0.0)
    place(x, creak(0.2, rng, 520, (90, 180), 0.8) * env(T(0.2), 0.005, 0.07), 0.02)
    place(x, whip(R(1312), 0.5), 0.1)
    place(x, reverse(swoosh(0.28, 500, 1900, 2300, rng, peak=0.3, q=1.8, tail=4)), 0.15, 0.6)
    x += thud(dur, 170, 85, 0.035) * 0.45
    return finish(x, 0.84, 1.4)


def ar_eagle_w():  # Eagle Tide, the charge (1.2 s): the bow drawn to its limit and held (creaking), an eagle of light unfolding its wings round
    # the arrow (two great sweeps), the spirit's chord swelling and a whine rising into the release
    rng = R(1320); dur = 1.32; t = T(dur); u = np.clip(t / 1.2, 0, 1)
    x = creak(dur, rng, 280, (20, 70), 0.9) * np.clip(t / 0.3, 0, 1) * (1 - 0.5 * u)
    place(x, wings([0.45, 0.85], rng, 330, 0.7, 2.0), 0.0)
    chord = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((440.0, 659.3, 880.0, 1318.5)))
    x += chord * u ** 2 * 0.045
    x += np.sin(2 * np.pi * np.cumsum(1500 * (2.2 ** u)) / SR) * u ** 3 * 0.06
    x *= np.where(t < 1.2, 1.0, np.exp(-(t - 1.2) / 0.03))  # (the release's twang takes over)
    return finish(x, 0.82, 1.25)


def ar_eagle_c():  # the release: a deep twang, the great eagle's cry, and the eagle flying through (three great wing beats going away)
    rng = R(1321); dur = 1.0; t = T(dur); x = buf(dur)
    place(x, twang(R(1322), 92, 0.3, 0.994, thwip=1.6, whistle_amp=0.0), 0, 0.85)
    place(x, screech(0.55, rng, 2700, 1900, 0.6), 0.02)
    place(x, swoosh(0.75, 250, 1800, 500, rng, peak=0.2, q=1.2, shape=1.4, tail=3.5) + air(0.75, 0.2, 3.5, rng, 260, 0.8), 0.0, 0.9)
    place(x, wings([0.05, 0.27, 0.49], rng, 300, 0.7, 1.6), 0.0)
    return finish(x, 0.84, 1.3)


def ar_eagle_b():  # the eagle passes through him: a wing's gust striking, a scrape of talons
    rng = R(1323); dur = 0.45; t = T(dur); x = buf(dur)
    x += lp(rng.standard_normal(t.size), 1100) * env(t, 0.003, 0.05) * 1.0 + thud(dur, 160, 75, 0.05) * 0.7
    place(x, svf(rng.standard_normal(T(0.1).size), 3200, 5) * env(T(0.1), 0.002, 0.03) * 0.6, 0.01)
    return finish(x, 0.84, 1.45)


def ar_eagle_h():  # the last pass throws him up: the eagle's cry, a gust bursting upward, the blow
    rng = R(1324); dur = 0.85; t = T(dur); x = buf(dur)
    x += thud(dur, 150, 55, 0.09, 0.03) * 1.1 + lp(rng.standard_normal(t.size), 1400) * env(t, 0.002, 0.05) * 0.9
    place(x, screech(0.3, rng, 3000, 2200, 0.45), 0.02)
    place(x, swoosh(0.5, 400, 2600, 3300, rng, peak=0.2, q=1.5, tail=4), 0.01, 0.8)
    return finish(x, 0.86, 1.5)


SOUNDS6 = {
    'ar_step_c': ar_step_c, 'ar_step_h': ar_step_h, 'ar_triple_c': ar_triple_c, 'ar_triple_h': ar_triple_h, 'ar_back_c': ar_back_c, 'ar_back_h': ar_back_h,
    'ar_kick_c': ar_kick_c, 'ar_kick_h': ar_kick_h, 'ar_mine_c': ar_mine_c, 'ar_mine_z': ar_mine_z, 'ar_mine_h': ar_mine_h,
    'ar_thunder_c': ar_thunder_c, 'ar_thunder_b': ar_thunder_b, 'ar_thunder_h': ar_thunder_h, 'ar_thunder_z': ar_thunder_z,
    'ar_spirit_c': ar_spirit_c, 'ar_spirit_h': ar_spirit_h, 'ar_roar_c': ar_roar_c, 'ar_roar_h': ar_roar_h, 'ar_bind_c': ar_bind_c, 'ar_bind_h': ar_bind_h,
    'ar_hawk_c': ar_hawk_c, 'ar_hawk_b': ar_hawk_b, 'ar_hawk_h': ar_hawk_h, 'ar_tree_c': ar_tree_c, 'ar_tree_h': ar_tree_h,
    'ar_lash_c': ar_lash_c, 'ar_lash_h': ar_lash_h, 'ar_eagle_w': ar_eagle_w, 'ar_eagle_c': ar_eagle_c, 'ar_eagle_b': ar_eagle_b, 'ar_eagle_h': ar_eagle_h,
}


SOUNDS = {
    # warrior
    'wr_iron_1': wr_iron_1, 'wr_iron_2': wr_iron_2, 'wr_iron_3': wr_iron_3, 'wr_iron_4': wr_iron_4,
    'wr_iron_hit_1': lambda: wr_iron_hit(107), 'wr_iron_hit_2': lambda: wr_iron_hit(108), 'wr_iron_fin': wr_iron_fin,
    'wr_rise_c': wr_rise_c, 'wr_rise_h': wr_rise_h, 'wr_quake_c': wr_quake_c, 'wr_quake_h': wr_quake_h,
    'wr_rush_c': wr_rush_c, 'wr_rush_h': wr_rush_h, 'wr_storm_w': wr_storm_w, 'wr_storm_c': wr_storm_c, 'wr_storm_h': wr_storm_h,
    'wr_titan_w': wr_titan_w, 'wr_titan_h': wr_titan_h, 'wr_titan_end': wr_titan_end,
    # samurai
    'sm_quick_1': sm_quick_1, 'sm_quick_2': sm_quick_2, 'sm_quick_3': sm_quick_3, 'sm_quick_4': sm_quick_4,
    'sm_quick_hit_1': lambda: sm_quick_hit(207), 'sm_quick_hit_2': lambda: sm_quick_hit(208), 'sm_quick_fin': sm_quick_fin,
    'sm_hundred_c': sm_hundred_c, 'sm_hundred_h': sm_hundred_h, 'sm_swallow_c': sm_swallow_c, 'sm_swallow_h': sm_swallow_h,
    'sm_shadow_c': sm_shadow_c, 'sm_shadow_h': sm_shadow_h, 'sm_iai_w': sm_iai_w, 'sm_iai_c': sm_iai_c, 'sm_iai_h': sm_iai_h,
    'sm_blossom_c': sm_blossom_c, 'sm_blossom_h': sm_blossom_h, 'sm_eclipse_w': sm_eclipse_w, 'sm_eclipse_c': sm_eclipse_c, 'sm_eclipse_h': sm_eclipse_h,
    # archer
    'ar_double_c': ar_double_c, 'ar_charged_c': ar_charged_c, 'ar_arrow_hit_1': lambda: ar_arrow_hit(304), 'ar_arrow_hit_2': lambda: ar_arrow_hit(306),
    'ar_charged_h': ar_charged_h, 'ar_rise_c': ar_rise_c, 'ar_rise_h': ar_rise_h, 'ar_fire_c': ar_fire_c, 'ar_fire_h': ar_fire_h,
    'ar_storm_c': ar_storm_c, 'ar_storm_h': ar_storm_h, 'ar_volley_c': ar_volley_c, 'ar_volley_h': ar_volley_h,
    'ar_skyrain_w': ar_skyrain_w, 'ar_skyrain_c': ar_skyrain_c, 'ar_skyrain_h': ar_skyrain_h,
    # book mage
    'bm_bolt_c1': bm_bolt_c1, 'bm_bolt_c2': bm_bolt_c2, 'bm_lance_c': bm_lance_c, 'bm_bolt_h_1': lambda: bm_bolt_h(410), 'bm_bolt_h_2': lambda: bm_bolt_h(411),
    'bm_lance_h': bm_lance_h, 'bm_wave_c': bm_wave_c, 'bm_wave_h': bm_wave_h, 'bm_astral_c': bm_astral_c, 'bm_astral_h': bm_astral_h,
    'bm_chain_c': bm_chain_c, 'bm_chain_h': bm_chain_h, 'bm_spikes_c': bm_spikes_c, 'bm_spikes_h': bm_spikes_h,
    'bm_field_c': bm_field_c, 'bm_field_h': bm_field_h, 'bm_time_w': bm_time_w, 'bm_time_c': bm_time_c, 'bm_time_h': bm_time_h,
    # gambler
    'gb_deck_1': gb_deck_1, 'gb_deck_2': gb_deck_2, 'gb_deck_3': gb_deck_3, 'gb_deck_4': gb_deck_4,
    'gb_staff_hit_1': lambda: gb_staff_hit(506), 'gb_staff_hit_2': lambda: gb_staff_hit(507), 'gb_deck_fin': gb_deck_fin,
    'gb_deal_w': gb_deal_w, 'gb_deal_c': gb_deal_c, 'gb_deal_h': gb_deal_h, 'gb_vault_c': gb_vault_c, 'gb_vault_h': gb_vault_h,
    'gb_fuse_c': gb_fuse_c, 'gb_fuse_h': gb_fuse_h, 'gb_show_w': gb_show_w, 'gb_show_c': gb_show_c, 'gb_show_h': gb_show_h,
    'gb_jack_w': gb_jack_w, 'gb_jack_c': gb_jack_c, 'gb_jack_h': gb_jack_h,
}

SOUNDS.update(SOUNDS2)
SOUNDS.update(SOUNDS3)
SOUNDS.update(SOUNDS4)
SOUNDS.update(SOUNDS5)
SOUNDS.update(SOUNDS6)


def loudness(x):
    """The loudest 100 ms (RMS): how loud it is heard."""
    w = int(SR * 0.1)
    if x.size <= w:
        return float(np.sqrt(np.mean(x ** 2)))
    c = np.cumsum(np.concatenate([[0], x ** 2]))
    return float(np.sqrt(((c[w:] - c[:-w]) / w).max()))


def cut_short(x):
    """How loud it still is when it ends (the last 40 ms before the fade, against its loudest): over ~3 % it is cut off."""
    n = int(SR * 0.04); e = int(SR * 0.025)
    end = np.sqrt(np.mean(x[-n - e:-e] ** 2)) if x.size > n + e else 0
    return float(end / (loudness(x) + 1e-12))


if __name__ == '__main__':
    names = sys.argv[1:] or list(SOUNDS)
    for name in names:
        x = SOUNDS[name]()
        if os.environ.get('DRY'):
            c = cut_short(x)
            print(name, f'{x.size / SR:.2f} s', f'loud {loudness(x):.3f}', f'end {c:.3f}' + ('  <-- CUT' if c > 0.03 else ''))
            continue
        write(name, x)
        print('   loud', f'{loudness(x):.3f}')
