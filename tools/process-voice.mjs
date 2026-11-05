/**
 * Offline voice design for the boot animation.
 *
 * Source lines come from Microsoft Edge neural TTS (zh-CN-XiaoxiaoNeural,
 * slow rate) prepared by tools/prepare-edge-voice.py.
 *
 * Clarity is the priority: the dry voice keeps a light presence lift and a
 * gentle compressor, with only a faint ring-mod shimmer underneath for the
 * synthetic read. No echoes or distortion are applied to the words.
 *
 * Usage: node tools/process-voice.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets');

function readWav(file) {
  const buf = fs.readFileSync(file);
  let pos = 12;
  let fmt = null;
  let dataOffset = 0;
  let dataLength = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        rate: buf.readUInt32LE(pos + 12),
        channels: buf.readUInt16LE(pos + 10),
        bits: buf.readUInt16LE(pos + 22),
      };
    }
    if (id === 'data') {
      dataOffset = pos + 8;
      dataLength = size;
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || fmt.bits !== 16) throw new Error('Expected 16-bit PCM: ' + file);
  const count = Math.floor(dataLength / 2 / fmt.channels);
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c += 1) sum += buf.readInt16LE(dataOffset + (i * fmt.channels + c) * 2);
    samples[i] = sum / fmt.channels / 32768;
  }
  return { rate: fmt.rate, samples };
}

function writeWav(file, rate, samples) {
  const dataSize = samples.length * 2;
  const out = Buffer.alloc(44 + dataSize);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + dataSize, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, out);
}

function highpass(samples, rate, cutoff, passes = 1) {
  const dt = 1 / rate;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = rc / (rc + dt);
  let out = Float64Array.from(samples);
  for (let p = 0; p < passes; p += 1) {
    const next = new Float64Array(out.length);
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i < out.length; i += 1) {
      const y = alpha * (prevY + out[i] - prevX);
      next[i] = y;
      prevX = out[i];
      prevY = y;
    }
    out = next;
  }
  return out;
}

function lowpass(samples, rate, cutoff) {
  const alpha = Math.exp((-2 * Math.PI * cutoff) / rate);
  const out = new Float64Array(samples.length);
  let lp = 0;
  for (let i = 0; i < samples.length; i += 1) {
    lp = (1 - alpha) * samples[i] + alpha * lp;
    out[i] = lp;
  }
  return out;
}

function peaking(samples, rate, freq, q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha / A;
  const b0 = (1 + alpha * A) / a0;
  const b1 = (-2 * cos) / a0;
  const b2 = (1 - alpha * A) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha / A) / a0;
  const out = new Float64Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

function comb(samples, rate, ms, gain) {
  const delay = Math.max(1, Math.round((ms / 1000) * rate));
  const out = Float64Array.from(samples);
  for (let i = delay; i < out.length; i += 1) out[i] += samples[i - delay] * gain;
  return out;
}

function normalizePeak(samples, target) {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? target / peak : 1;
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * gain;
  return out;
}

function softCompress(samples, rate) {
  let env = 0;
  const attack = Math.exp(-1 / (0.0025 * rate));
  const release = Math.exp(-1 / (0.13 * rate));
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const abs = Math.abs(samples[i]);
    env = abs > env ? attack * env + (1 - attack) * abs : release * env + (1 - release) * abs;
    const over = Math.max(0, env - 0.11);
    const gain = 1 / (1 + over * 3.4);
    out[i] = samples[i] * gain * 1.7;
  }
  return out;
}

function process(file, outFile) {
  const { rate, samples } = readWav(file);
  const n = samples.length;

  // --- Dry, intelligible voice with a stronger chest and presence ------------
  let dry = highpass(samples, rate, 95, 1);
  dry = peaking(dry, rate, 3220, 1.0, 3.8);
  dry = peaking(dry, rate, 178, 0.85, 3.2);
  dry = peaking(dry, rate, 620, 1.1, 1.4);
  dry = lowpass(dry, rate, 11800);
  dry = normalizePeak(dry, 0.86);

  // --- A parallel machine layer, mixed under the clear dry voice -------------
  const robot = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const mod = 1 - 0.38 + 0.38 * Math.sin((2 * Math.PI * 56 * i) / rate);
    robot[i] = dry[i] * mod;
  }
  const combDelay = Math.max(1, Math.round(0.0026 * rate));
  for (let i = combDelay; i < n; i += 1) robot[i] += robot[i - combDelay] * 0.24;
  const levels = 4096;
  for (let i = 0; i < n; i += 1) {
    robot[i] = robot[i] * 0.82 + (Math.round(robot[i] * levels) / levels) * 0.18;
  }
  const mixed = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    mixed[i] = dry[i] * 0.74 + robot[i] * 0.26;
  }

  // --- Compression + a touch of harmonic edge for a commanding read ----------
  let signal = softCompress(mixed, rate);
  for (let i = 0; i < n; i += 1) {
    signal[i] = Math.tanh(signal[i] * 1.35) / Math.tanh(1.35);
  }
  signal = normalizePeak(signal, 0.98);

  const fadeIn = Math.floor(0.012 * rate);
  const fadeOut = Math.floor(0.06 * rate);
  for (let i = 0; i < n; i += 1) {
    let v = signal[i];
    if (i < fadeIn) v *= i / fadeIn;
    const tail = n - i;
    if (tail < fadeOut) v *= tail / fadeOut;
    signal[i] = Math.max(-0.99, Math.min(0.99, v));
  }

  writeWav(outFile, rate, signal);

  let peakOut = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    peakOut = Math.max(peakOut, Math.abs(signal[i]));
    sumSq += signal[i] * signal[i];
  }
  console.log(
    `${path.basename(file)} -> ${path.basename(outFile)}`,
    `${(n / rate).toFixed(2)}s`,
    `peak ${peakOut.toFixed(3)}`,
    `rms ${(20 * Math.log10(Math.sqrt(sumSq / n))).toFixed(1)} dBFS`,
    `${Math.round(fs.statSync(outFile).size / 1024)} KiB`,
  );
}

process(path.join(assets, 'welcome-edge.wav'), path.join(assets, 'welcome-bot.wav'));
process(path.join(assets, 'tagline-edge.wav'), path.join(assets, 'tagline-bot.wav'));
