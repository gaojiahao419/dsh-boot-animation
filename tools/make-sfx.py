"""
Generate the small UI sound design bed for the boot animation:
  sfx-beep.wav      short comm beep before each AI voice line
  sfx-solidify.wav  particle-to-solid impact / servo lock
  sfx-reveal.wav    soft rising shimmer when the tagline appears
  ambient.wav       low, slowly breathing drone bed (loopable)

Usage: python tools/make-sfx.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
RATE = 22050


def write_wav(name: str, samples: np.ndarray) -> None:
    samples = np.asarray(samples, dtype=np.float64)
    peak = float(np.max(np.abs(samples))) or 1.0
    samples = samples / peak
    pcm = np.clip(samples * 32767.0, -32768, 32767).astype("<i2")
    out = os.path.join(ASSETS, name)
    with wave.open(out, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())
    print(f"{name}: {len(samples) / RATE:.2f}s, {os.path.getsize(out)} bytes")


def fade(samples: np.ndarray, attack: float, release: float) -> np.ndarray:
    n = len(samples)
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return samples * env


def beep() -> np.ndarray:
    t = np.arange(int(0.22 * RATE)) / RATE
    tone = 0.55 * np.sin(2 * np.pi * 1450 * t) + 0.25 * np.sin(2 * np.pi * 2900 * t)
    click = np.zeros_like(t)
    click[: int(0.006 * RATE)] = np.random.default_rng(7).uniform(-0.5, 0.5, int(0.006 * RATE))
    wave = (tone * np.exp(-t * 16)) + click
    return fade(wave, 0.002, 0.05)


def solidify() -> np.ndarray:
    duration = 1.9
    t = np.arange(int(duration * RATE)) / RATE
    rng = np.random.default_rng(11)

    # Deep servo-impact with a falling pitch.
    freq = 78 * np.exp(-t * 1.6) + 34
    phase = np.cumsum(2 * np.pi * freq / RATE)
    thump = 0.9 * np.sin(phase) * np.exp(-t * 2.1)

    # Metallic ring (inharmonic partials) for the "identity locked" moment.
    ring = np.zeros_like(t)
    for f, amp, decay in [(523.3, 0.14, 2.6), (784.9, 0.09, 3.2), (1174.7, 0.06, 4.2), (1568.0, 0.035, 5.0)]:
        ring += amp * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t * decay)

    # Airy noise sweep settling into a hiss.
    noise = rng.normal(0, 1, len(t))
    hp = np.diff(noise, prepend=0)
    sweep = hp * np.exp(-t * 3.0) * 0.18
    # Slow "power lock" rumble.
    rumble = 0.18 * np.sin(2 * np.pi * 46 * t) * np.exp(-np.maximum(0, t - 0.5) * 1.4)
    return fade(thump + ring + sweep + rumble, 0.004, 0.25)


def reveal() -> np.ndarray:
    duration = 2.4
    t = np.arange(int(duration * RATE)) / RATE
    rng = np.random.default_rng(13)

    chord = np.zeros_like(t)
    for f, amp in [(261.6, 0.13), (392.0, 0.09), (523.3, 0.07), (659.3, 0.05), (784.9, 0.035)]:
        attack = np.clip(t / 0.5, 0, 1)
        chord += amp * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * attack * np.exp(-np.maximum(0, t - 0.6) * 1.5)

    # Shimmer partials.
    shimmer = np.zeros_like(t)
    for i in range(9):
        f = rng.uniform(1400, 5200)
        start = rng.uniform(0.0, 0.7)
        env = np.clip((t - start) / 0.1, 0, 1) * np.exp(-np.maximum(0, t - start) * 3.5)
        shimmer += 0.018 * np.sin(2 * np.pi * f * t) * env

    # Slow air sweep.
    noise = rng.normal(0, 1, len(t))
    air = np.diff(noise, prepend=0) * np.clip(t / 0.8, 0, 1) * np.exp(-np.maximum(0, t - 0.8) * 1.6) * 0.1
    return fade(chord + shimmer + air, 0.02, 0.4)


def ambient() -> np.ndarray:
    duration = 12.0
    t = np.arange(int(duration * RATE)) / RATE
    rng = np.random.default_rng(17)
    drone = np.zeros_like(t)
    for f, amp in [(55.0, 0.2), (82.41, 0.12), (110.0, 0.06), (164.81, 0.035)]:
        drift = 1 + 0.0015 * np.sin(2 * np.pi * 0.07 * t + f)
        drone += amp * np.sin(2 * np.pi * f * t * drift)
    slow = 0.55 + 0.45 * np.sin(2 * np.pi * 0.045 * t - 1.2)
    noise = rng.normal(0, 1, len(t))
    air = np.diff(noise, prepend=0) * 0.012 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.03 * t))
    wave = (drone * slow) + air
    # Crossfade the tail into the head for seamless looping.
    fade_len = int(1.2 * RATE)
    env = np.ones_like(wave)
    env[:fade_len] = np.linspace(0.55, 1.0, fade_len)
    env[-fade_len:] = np.linspace(1.0, 0.55, fade_len)
    return wave * env


write_wav("sfx-beep.wav", beep())
write_wav("sfx-solidify.wav", solidify())
write_wav("sfx-reveal.wav", reveal())
write_wav("ambient.wav", ambient())
