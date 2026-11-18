"""GOD OF LEGACY — REBORN: the katana's sound effects, synthesized here (numpy only; outputs committed as 16-bit mono
WAV, which Godot imports). M3 review (GPT): three distinct sword swings and impacts, the third heavier.
  swing_1/2/3 — a blade cutting air: band-passed noise whose centre sweeps up and back down as the blade passes,
                with a faint whistle; 1 short and light, 2 a long wide sweep, 3 lower and fuller.
  impact_1/2/3 — the blade biting a straw-wrapped post: a sharp transient, a mid "thwack", the straw's crackle and
                a body thump; 3 deeper and longer, with a low boom.
Placeholder quality (synthesized, not recorded): to be replaced or layered in the audio pass.
Usage: python3 make_sfx.py <out dir>"""
import struct
import sys
import wave

import numpy as np

SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(23)


def save(name, x, gain=0.9):
    x = x / max(1e-9, np.max(np.abs(x))) * gain
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, len(x) / SR, 's')


def svf_band(x, fc, q):
    """A state-variable band-pass whose centre `fc` (Hz, per sample) moves over time."""
    y = np.zeros_like(x)
    low = band = 0.0
    for i in range(len(x)):
        f = 2.0 * np.sin(np.pi * min(fc[i], SR * 0.45) / SR)
        high = x[i] - low - q * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def one_pole_low(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s
        y[i] = s
    return y


def env(n, attack, release, curve=2.0):
    """Rise over `attack` (fraction of n), fall over the rest."""
    t = np.linspace(0, 1, n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.clip((1 - t) / max(1 - attack, 1e-4), 0, 1) ** curve
    return np.minimum(a, 1.0) * r


def swing(dur, f_lo, f_hi, peak_at, q, whistle=0.0, body=0.0):
    n = int(SR * dur)
    t = np.linspace(0, 1, n)
    # the blade's speed: a bell around peak_at
    speed = np.exp(-((t - peak_at) / 0.22) ** 2)
    fc = f_lo + (f_hi - f_lo) * speed
    noise = rng.standard_normal(n)
    # two band-pass stages (steeper skirts: a "woosh", not a hiss), the air above 4 kHz rolled off
    x = one_pole_low(svf_band(svf_band(noise, fc, q), fc, q), 4000) * speed ** 1.5
    if whistle:
        ph = np.cumsum(2 * np.pi * (fc * 1.6) / SR)
        x += whistle * np.sin(ph) * speed ** 3
    if body:
        x += body * one_pole_low(noise, 260) * speed ** 2
    return x * env(n, 0.15, 0.85, 1.4)


def impact(dur, thump_f0, thump_f1, thump_len, thwack_fc, crackle, boom=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = np.zeros(n)
    # the bite: a very short broadband click
    click = rng.standard_normal(n) * np.exp(-t / 0.0025)
    x += 0.9 * click
    # the thwack: a mid noise burst
    thw = svf_band(rng.standard_normal(n), np.full(n, thwack_fc), 0.9) * np.exp(-t / 0.035)
    x += 1.4 * thw
    # the straw: a dry crackle — sparse grains for a while
    grains = (rng.random(n) < 0.02) * rng.standard_normal(n)
    x += crackle * svf_band(grains, np.full(n, 2600.0), 1.2) * np.exp(-t / 0.09)
    # the body: a falling sine thump
    f = thump_f1 + (thump_f0 - thump_f1) * np.exp(-t / (thump_len * 0.35))
    ph = np.cumsum(2 * np.pi * f / SR)
    x += 1.2 * np.sin(ph) * np.exp(-t / thump_len)
    if boom:
        bf = 38 + 30 * np.exp(-t / 0.08)
        x += boom * np.sin(np.cumsum(2 * np.pi * bf / SR)) * np.exp(-t / 0.22) * np.clip(t / 0.006, 0, 1)
    fade = np.clip((dur - t) / 0.03, 0, 1)
    return x * fade


save('swing_1', swing(0.17, 420, 1700, 0.42, 0.45, whistle=0.04), 0.75)
save('swing_2', swing(0.26, 300, 1300, 0.5, 0.4, whistle=0.03, body=0.3), 0.8)
save('swing_3', swing(0.30, 200, 950, 0.48, 0.35, whistle=0.02, body=0.8), 0.9)
save('impact_1', impact(0.22, 190, 95, 0.05, 900, 0.8), 0.8)
save('impact_2', impact(0.26, 170, 80, 0.07, 760, 1.0), 0.85)
save('impact_3', impact(0.55, 140, 46, 0.14, 560, 1.3, boom=1.6), 0.95)
