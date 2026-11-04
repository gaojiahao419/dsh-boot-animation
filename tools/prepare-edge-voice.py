"""
Prepare the Edge-TTS neural lines for the offline robot-voice processor.

MP3 (24 kHz) -> 22.05 kHz mono PCM WAV, trimmed and padded so the two lines
start/stop cleanly for cinematic timing.

Usage: python tools/prepare-edge-voice.py
"""
import os
import wave

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
TARGET_RATE = 22050
SILENCE = 0.008


def trim(samples: np.ndarray, pad_seconds: float = 0.025) -> np.ndarray:
    peak = float(np.max(np.abs(samples))) or 1.0
    threshold = max(SILENCE, peak * 0.02)
    above = np.flatnonzero(np.abs(samples) > threshold)
    if above.size == 0:
        return samples
    start = max(0, int(above[0] - TARGET_RATE * pad_seconds))
    end = min(len(samples), int(above[-1] + TARGET_RATE * pad_seconds))
    return samples[start:end]


def convert(source: str, target: str) -> None:
    data, rate = sf.read(os.path.join(ASSETS, source), dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if rate != TARGET_RATE:
        gcd = np.gcd(rate, TARGET_RATE)
        mono = resample_poly(mono, TARGET_RATE // gcd, rate // gcd)
    mono = trim(mono)
    peak = float(np.max(np.abs(mono))) or 1.0
    mono = mono / peak * 0.72
    pcm = np.clip(mono * 32767.0, -32768, 32767).astype("<i2")
    out = os.path.join(ASSETS, target)
    with wave.open(out, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(TARGET_RATE)
        handle.writeframes(pcm.tobytes())
    print(f"{source} -> {target}: {len(pcm) / TARGET_RATE:.2f}s, peak 0.72, {os.path.getsize(out)} bytes")


convert("welcome-edge.mp3", "welcome-edge.wav")
convert("tagline-edge.mp3", "tagline-edge.wav")
