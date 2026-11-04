window.__ModuleLoader__.load({
  id: '@local/dsh-boot-animation',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useState } = React;

    /* ------------------------------------------------------------------ *
     * Data
     * ------------------------------------------------------------------ */
    const WHALE_VIEWBOX = __WHALE_VIEWBOX__;
    const WHALE_PATH = __WHALE_PATH__;
    const VOICE_WELCOME = '__VOICE_WELCOME__';
    const VOICE_TAGLINE = '__VOICE_TAGLINE__';
    const SFX_BEEP = '__SFX_BEEP__';
    const SFX_SOLIDIFY = '__SFX_SOLIDIFY__';
    const SFX_REVEAL = '__SFX_REVEAL__';

    const TITLE = '探索未至之境';

    const TIMING = {
      gather: 900,
      welcome: 1050,
      form: 4800,
      reveal: 6600,
      tagline: 8100,
      ready: 11200,
    };

    const STATUS = {
      boot: 'SYSTEM CHECK · 系统自检',
      gather: 'NEURAL LINK · 粒子同步',
      form: 'IDENTITY LOCKED · 标识实体化',
      reveal: 'MISSION ONLINE · 意识接入',
      ready: 'WELCOME BACK · 欢迎回来',
    };

    const PROGRESS = { boot: 9, gather: 38, form: 64, reveal: 86, ready: 100 };

    const REDUCED = (() => {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    })();

    /* ------------------------------------------------------------------ *
     * Small utilities
     * ------------------------------------------------------------------ */
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const rand = (a, b) => a + Math.random() * (b - a);
    const pad2 = (n) => String(n).padStart(2, '0');
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const quadPoint = (a, c, b, t) => {
      const u = 1 - t;
      return u * u * a + 2 * u * t * c + t * t * b;
    };

    function b64ToBuffer(b64) {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      return bytes.buffer;
    }

    /* ------------------------------------------------------------------ *
     * Voice: pre-rendered Chinese TTS, processed offline into a synthetic
     * android-female timbre. Playback uses HTMLAudioElement (the most
     * direct output path in the desktop shell); speechSynthesis is the
     * fallback when media playback is unavailable or blocked.
     * ------------------------------------------------------------------ */
    function createVoice() {
      const state = {
        welcome: null,
        tagline: null,
        beep: null,
        solidify: null,
        reveal: null,
        pendingTimers: new Set(),
        stopped: false,
      };

      function makeAudio(b64, volume) {
        const audio = new Audio('data:audio/wav;base64,' + b64);
        audio.preload = 'auto';
        audio.volume = volume;
        audio.setAttribute('playsinline', '');
        audio.load();
        return audio;
      }

      function init() {
        if (state.welcome || state.stopped) return;
        try {
          state.welcome = makeAudio(VOICE_WELCOME, 1);
          state.tagline = makeAudio(VOICE_TAGLINE, 1);
          state.beep = makeAudio(SFX_BEEP, 0.1);
          state.solidify = makeAudio(SFX_SOLIDIFY, 0.24);
          state.reveal = makeAudio(SFX_REVEAL, 0.12);
          const report = (label, el) => {
            try {
              window.console.info('[dsh-boot-animation] voice ready', label, {
                duration: Number.isFinite(el.duration) ? Number(el.duration.toFixed(2)) : null,
                readyState: el.readyState,
              });
            } catch (e) { /* ignore */ }
          };
          if (state.welcome.readyState >= 2) report('welcome', state.welcome);
          else state.welcome.addEventListener('canplay', () => report('welcome', state.welcome), { once: true });
          if (state.tagline.readyState >= 2) report('tagline', state.tagline);
          else state.tagline.addEventListener('canplay', () => report('tagline', state.tagline), { once: true });
        } catch (e) {
          state.welcome = null;
          state.tagline = null;
        }
      }

      function speakFallback(text) {
        if (state.stopped || !('speechSynthesis' in window)) return;
        try {
          const synth = window.speechSynthesis;
          synth.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = 'zh-CN';
          utter.pitch = 1.14;
          utter.rate = 0.96;
          utter.volume = 1;
          const pick = () => {
            const voices = synth.getVoices() || [];
            return voices.find((v) => /^zh/i.test(v.lang) && /(female|huihui|yaoyao|xiaoxiao|xiaoyi|女)/i.test(v.name))
              || voices.find((v) => /^zh/i.test(v.lang));
          };
          const found = pick();
          if (found) utter.voice = found;
          else {
            try {
              synth.addEventListener('voiceschanged', () => {
                const later = pick();
                if (later) utter.voice = later;
              }, { once: true });
            } catch (e) { /* ignore */ }
          }
          synth.speak(utter);
        } catch (e) { /* ignore */ }
      }

      function play(el, label, text) {
        const isVoice = label === 'welcome' || label === 'tagline';
        if (state.stopped || !el) {
          if (isVoice) speakFallback(text);
          return;
        }
        try {
          el.currentTime = 0;
          const started = el.play();
          if (started && typeof started.then === 'function') {
            started.then(() => {
              if (state.stopped) return;
              try {
                if (isVoice) {
                  window.console.info('[dsh-boot-animation] voice started', label, {
                    currentTime: Number(el.currentTime.toFixed(2)),
                    paused: el.paused,
                    volume: el.volume,
                  });
                }
              } catch (e) { /* ignore */ }
            }).catch((error) => {
              if (state.stopped || !isVoice) return;
              try { window.console.warn('[dsh-boot-animation] media playback blocked, speechSynthesis fallback', String(error)); } catch (e) { /* ignore */ }
              speakFallback(text);
            });
          }
        } catch (e) {
          if (isVoice) speakFallback(text);
        }
      }

      function say(kind) {
        if (state.stopped) return;
        const el = kind === 'welcome' ? state.welcome : state.tagline;
        const text = kind === 'welcome' ? '欢迎回来' : '探索未至之境';
        // A short comm beep precedes each AI line, like a tactical channel.
        try {
          if (state.beep) {
            state.beep.currentTime = 0;
            const beep = state.beep.play();
            if (beep && beep.catch) beep.catch(() => {});
          }
        } catch (e) { /* ignore */ }
        const timer = window.setTimeout(() => {
          state.pendingTimers.delete(timer);
          play(el, kind, text);
        }, 130);
        state.pendingTimers.add(timer);
      }

      function accent(kind) {
        if (state.stopped) return;
        const el = kind === 'solidify' ? state.solidify : kind === 'reveal' ? state.reveal : null;
        if (!el) return;
        try {
          el.currentTime = 0;
          const started = el.play();
          if (started && started.catch) started.catch(() => {});
        } catch (e) { /* ignore */ }
      }

      function stopAll() {
        state.stopped = true;
        state.pendingTimers.forEach((timer) => window.clearTimeout(timer));
        state.pendingTimers.clear();
        ['welcome', 'tagline', 'beep', 'solidify', 'reveal'].forEach((key) => {
          try { if (state[key]) state[key].pause(); } catch (e) { /* ignore */ }
        });
        try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      }

      return { init, say, accent, stopAll, dispose: stopAll };
    }

    /* ------------------------------------------------------------------ *
     * Background: WebGL2 fluid shader, a distilled version of the
     * deepseek.com/harness hero background. Falls back to the CSS
     * gradient underneath when WebGL is unavailable.
     * ------------------------------------------------------------------ */
    const FLUID_VERT = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

    const FLUID_FRAG = `#version 300 es
precision mediump float;
uniform vec2 u_loop1;
uniform vec2 u_loop2;
uniform vec2 u_loop3;
uniform vec2 u_loop4;
uniform vec2 u_resolution;
uniform vec2 u_grainResolution;
uniform float u_lightCore;
uniform float u_lightHalo;

const vec3 u_c1 = vec3(0.0);
const vec3 u_c2 = vec3(0.0);
const vec3 u_c3 = vec3(32.0, 74.0, 126.0) / 255.0;
const vec3 u_c4 = vec3(206.0, 200.0, 187.0) / 255.0;
const vec3 u_c5 = vec3(0.0);
const float u_scale = 1.19;
const vec2 u_offset = vec2(-1.24, -0.48);
const float u_grain = 0.0045;
const vec2 u_lightPos = vec2(0.89, 0.46);
const float u_vignette = 0.42;
const float u_bloomThreshold = 0.61;
const float u_bloomRange = 0.18;
const float u_bloomStrength = 0.4;

out vec4 fragColor;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float fbm(vec3 p) {
  return 0.6 * snoise(p);
}

float fluidNoise(vec2 uv) {
  float n1 = fbm(vec3(uv * 0.6, 0.0) + vec3(u_loop1.y, 0.0, u_loop1.x));
  float n2 = fbm(vec3(uv * 0.6 + 5.2, 1.3) + vec3(0.0, u_loop1.y, u_loop1.x));
  vec2 w1 = vec2(n1, n2) * 0.6;
  float n3 = fbm(vec3((uv + w1) * 0.7 + 1.7, 3.1) + vec3(u_loop2.y, 0.0, u_loop2.x));
  float n4 = fbm(vec3((uv + w1) * 0.7 + 9.2, 5.7) + vec3(0.0, u_loop2.y, u_loop2.x));
  vec2 w2 = vec2(n3, n4) * 0.5;
  return fbm(vec3((uv + w1 + w2) * 0.5, 0.0) + vec3(u_loop3.y, 0.0, u_loop3.x));
}

vec2 curlish(vec2 uv) {
  float eps = 0.02;
  float n = snoise(vec3(uv * 0.8, 0.0) + vec3(0.0, u_loop3.y, u_loop3.x));
  float nx = snoise(vec3((uv + vec2(eps, 0.0)) * 0.8, 0.0) + vec3(0.0, u_loop3.y, u_loop3.x));
  float ny = snoise(vec3((uv + vec2(0.0, eps)) * 0.8, 0.0) + vec3(0.0, u_loop3.y, u_loop3.x));
  return vec2(-(ny - n) / eps, (nx - n) / eps) * 0.003;
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 suv = vec2(uv.x * aspect, uv.y) * u_scale + u_offset;

  vec2 curl = curlish(suv);
  vec2 uvD = suv + curl * 12.0;
  float f = fluidNoise(uvD);
  float swirl = snoise(vec3(uvD * 0.8 + f * 1.5, 0.0) + vec3(u_loop4.y, 0.0, u_loop4.x)) * 0.5 + 0.5;
  float n = f * 0.5 + 0.5;
  vec3 col = mix(u_c1, u_c2, smoothstep(0.2, 0.5, n));
  col = mix(col, u_c3, smoothstep(0.35, 0.65, n + swirl * 0.25));
  col = mix(col, u_c4, smoothstep(0.6, 0.85, swirl) * 0.55);
  col = mix(col, u_c5, smoothstep(0.5, 0.8, n * swirl) * 0.35);

  vec2 flowOffset = (uvD - suv) * u_grainResolution.y;
  vec2 gp = floor((uv * u_grainResolution + flowOffset) / 5.0);
  float gr = hash(gp) * 2.0 - 1.0;
  col += gr * u_grain;

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  float bloom = smoothstep(u_bloomThreshold - u_bloomRange, u_bloomThreshold + u_bloomRange, luma);
  col += (col * 0.85 + vec3(0.15, 0.145, 0.13)) * bloom * u_bloomStrength;

  float ld = length((uv - u_lightPos) * vec2(aspect, 1.0));
  float core = exp(-ld * ld * 4.5);
  float halo = exp(-ld * 1.8);
  col += vec3(1.0, 0.97, 0.9) * core * u_lightCore + vec3(0.72, 0.8, 1.0) * halo * u_lightHalo;

  float vig = 1.0 - smoothstep(0.35, 0.75, length(uv - 0.5));
  col = mix(col * (1.0 - u_vignette), col, vig);
  fragColor = vec4(col, 1.0);
}`;

    function startFluid(canvas) {
      let gl = null;
      try {
        gl = canvas.getContext('webgl2', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
      } catch (e) {
        gl = null;
      }
      if (!gl) return null;

      function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          return null;
        }
        return shader;
      }

      const vs = compile(gl.VERTEX_SHADER, FLUID_VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FLUID_FRAG);
      if (!vs || !fs) return null;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const names = [
        'u_loop1', 'u_loop2', 'u_loop3', 'u_loop4',
        'u_resolution', 'u_grainResolution', 'u_lightCore', 'u_lightHalo',
      ];
      const uniforms = {};
      names.forEach((name) => { uniforms[name] = gl.getUniformLocation(program, name); });

      const reduce = REDUCED;
      let raf = 0;
      let disposed = false;
      let lastFrame = 0;
      const start = performance.now();

      function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const scale = reduce ? 0.4 : 0.58;
        const w = Math.max(2, Math.round(rect.width * dpr * scale));
        const h = Math.max(2, Math.round(rect.height * dpr * scale));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      function frame(now) {
        if (disposed) return;
        // The fluid is ambient: 30 fps is indistinguishable and leaves GPU
        // headroom for the particle and text animations layered above it.
        if (now - lastFrame < 33) {
          raf = window.requestAnimationFrame(frame);
          return;
        }
        lastFrame = now;
        const t = (now - start) / 1000;
        resize();
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniforms.u_loop1, t * 0.042, t * 0.05);
        gl.uniform2f(uniforms.u_loop2, t * 0.031 + 1.7, -t * 0.039);
        gl.uniform2f(uniforms.u_loop3, t * 0.027 + 4.2, t * 0.034);
        gl.uniform2f(uniforms.u_loop4, t * 0.021 + 9.1, -t * 0.029);
        gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.u_grainResolution, canvas.width / 2, canvas.height / 2);
        gl.uniform1f(uniforms.u_lightCore, 0.22 + 0.05 * Math.sin(t * 0.55));
        gl.uniform1f(uniforms.u_lightHalo, 0.11 + 0.03 * Math.sin(t * 0.4 + 1.2));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        raf = window.requestAnimationFrame(frame);
      }

      resize();
      raf = window.requestAnimationFrame(frame);

      return {
        resize,
        dispose() {
          disposed = true;
          window.cancelAnimationFrame(raf);
          try {
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
          } catch (e) { /* ignore */ }
        },
      };
    }

    /* ------------------------------------------------------------------ *
     * Particle engine: dust that converges into the whale silhouette.
     * ------------------------------------------------------------------ */
    function createParticles(canvas) {
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return null;
      const start = performance.now();
      const sprites = [];
      let raf = 0;
      let disposed = false;
      let W = 0;
      let H = 0;
      let dpr = 1;
      let particles = [];
      let ambient = [];
      let outline = [];
      let burst = [];
      let burstSpawned = false;
      let rect = null;
      let skipAt = 0;
      let markReady = false;

      const spriteDefs = [
        'rgba(210,224,255,0.95)',
        'rgba(143,178,255,0.95)',
        'rgba(233,221,200,0.9)',
      ];
      spriteDefs.forEach((color) => {
        const sprite = document.createElement('canvas');
        sprite.width = 64;
        sprite.height = 64;
        const g = sprite.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.16, color);
        grad.addColorStop(0.5, color.replace('0.9', '0.32').replace('0.95', '0.32'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        sprites.push(sprite);
      });
      const ambientSprite = (() => {
        const sprite = document.createElement('canvas');
        sprite.width = 48;
        sprite.height = 48;
        const g = sprite.getContext('2d');
        const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
        grad.addColorStop(0, 'rgba(226,237,255,0.9)');
        grad.addColorStop(0.35, 'rgba(143,178,255,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 48, 48);
        return sprite;
      })();

      function resize() {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return false;
        W = bounds.width;
        H = bounds.height;
        dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        const cw = Math.max(2, Math.round(W * dpr));
        const ch = Math.max(2, Math.round(H * dpr));
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      }

      function buildAmbient() {
        ambient = [];
        const count = Math.round(clamp((W * H) / 14500, 60, 135));
        for (let i = 0; i < count; i += 1) {
          ambient.push({
            x: rand(0, W),
            y: rand(0, H),
            vx: rand(-0.06, 0.06),
            vy: rand(-0.055, -0.008),
            size: rand(0.5, 1.9),
            alpha: rand(0.05, 0.3),
            phase: rand(0, Math.PI * 2),
          });
        }
      }

      function samplePoints() {
        if (!rect || !rect.width || !rect.height) return null;
        const vb = WHALE_VIEWBOX.trim().split(/\s+/).map(Number);
        if (vb.length !== 4) return null;
        const offW = 340;
        const scale = offW / vb[2];
        const offH = Math.max(2, Math.round(vb[3] * scale));
        const off = document.createElement('canvas');
        off.width = offW;
        off.height = offH;
        const og = off.getContext('2d', { willReadFrequently: true });
        og.fillStyle = '#fff';
        og.save();
        og.setTransform(scale, 0, 0, scale, -vb[0] * scale, -vb[1] * scale);
        try { og.fill(new Path2D(WHALE_PATH)); } catch (e) { og.restore(); return null; }
        og.restore();
        const data = og.getImageData(0, 0, offW, offH).data;
        const alphaAt = (x, y) => data[(y * offW + x) * 4 + 3];
        const fill = [];
        const edge = [];
        for (let y = 1; y < offH - 1; y += 2) {
          for (let x = 1; x < offW - 1; x += 2) {
            if (alphaAt(x, y) > 120) {
              fill.push(x, y);
              if (alphaAt(x - 1, y) < 90 || alphaAt(x + 1, y) < 90 || alphaAt(x, y - 1) < 90 || alphaAt(x, y + 1) < 90) {
                edge.push(x, y);
              }
            }
          }
        }
        return { offW, offH, fill, edge };
      }

      function build() {
        if (!rect) return;
        const sample = samplePoints();
        if (!sample) return;
        markReady = true;
        const { offW, offH, fill, edge } = sample;
        const density = REDUCED ? 360 : 300;
        const count = Math.round(clamp((W * H) / density, REDUCED ? 1900 : 2600, REDUCED ? 3000 : 5200));
        const edgeShare = Math.min(edge.length / 2, Math.round(count * 0.42));
        const maxDim = Math.max(W, H);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        outline = [];
        for (let k = 0; k < edge.length; k += 2) {
          outline.push({
            x: rect.x + (edge[k] / offW) * rect.width,
            y: rect.y + (edge[k + 1] / offH) * rect.height,
          });
        }
        burst = [];
        burstSpawned = false;
        const next = [];
        for (let i = 0; i < count; i += 1) {
          const useEdge = i < edgeShare;
          const arr = useEdge ? edge : fill;
          if (!arr.length) continue;
          const idx = Math.floor(Math.random() * (arr.length / 2)) * 2;
          const tx = rect.x + ((arr[idx] + rand(-0.8, 0.8)) / offW) * rect.width;
          const ty = rect.y + ((arr[idx + 1] + rand(-0.8, 0.8)) / offH) * rect.height;
          const angle = rand(0, Math.PI * 2);
          const radius = maxDim * rand(0.55, 1.05);
          const sx = cx + Math.cos(angle) * radius * 1.12;
          const sy = cy + Math.sin(angle) * radius;
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const swirl = maxDim * rand(0.05, 0.2) * (Math.random() < 0.5 ? -1 : 1);
          const mx = (sx + tx) / 2 + (-dy / dist) * swirl + rand(-24, 24);
          const my = (sy + ty) / 2 + (dx / dist) * swirl + rand(-24, 24);
          const roll = Math.random();
          const spriteIdx = roll < 0.66 ? 0 : roll < 0.93 ? 1 : 2;
          next.push({
            sx, sy, mx, my, tx, ty,
            delay: rand(0, REDUCED ? 150 : 800),
            dur: rand(REDUCED ? 700 : 1500, REDUCED ? 1000 : 2600),
            size: rand(0.7, 2.5),
            alpha: rand(0.65, 1),
            phase: rand(0, Math.PI * 2),
            sprite: spriteIdx,
            prevX: sx,
            prevY: sy,
            line: roll < 0.66 ? 'rgba(200,220,255,0.85)' : roll < 0.93 ? 'rgba(130,168,255,0.85)' : 'rgba(238,226,205,0.8)',
          });
        }
        particles = next;
      }

      function drawAmbient(t) {
        for (let i = 0; i < ambient.length; i += 1) {
          const p = ambient[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = W + 20;
          if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20;
          if (p.y > H + 20) p.y = -20;
          const twinkle = 0.65 + 0.35 * Math.sin(t * 0.0012 + p.phase);
          const size = p.size * 7;
          ctx.globalAlpha = p.alpha * twinkle;
          ctx.drawImage(ambientSprite, p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
      }

      function drawRings(t) {
        if (!rect) return;
        const formT = skipAt ? -1 : t - TIMING.form;
        if (formT < 0 || formT > 2000) return;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const base = Math.max(rect.width, rect.height);
        [0, 320].forEach((delay, index) => {
          const u = clamp((formT - delay) / 1500, 0, 1);
          if (u <= 0 || u >= 1) return;
          const radius = base * (0.12 + u * 0.62);
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = index === 0 ? 'rgba(210,226,255,0.9)' : 'rgba(120,158,255,0.55)';
          ctx.lineWidth = (1 - u) * 2;
          ctx.globalAlpha = (1 - u) * 0.6;
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }

      function drawFilaments(t) {
        if (skipAt || !rect) return;
        const gatherT = t - TIMING.gather;
        const formT = TIMING.form - TIMING.gather;
        if (gatherT < 0 || gatherT > formT) return;
        const k = clamp(gatherT / formT, 0, 1);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const maxR = Math.max(W, H) * 0.46;
        for (let i = 0; i < 8; i += 1) {
          const phase = (i / 8) * Math.PI * 2 + t * 0.00022;
          const radius = maxR * (1.06 - k * 0.34);
          const x0 = cx + Math.cos(phase) * radius * 1.12;
          const y0 = cy + Math.sin(phase) * radius;
          const targetAngle = phase + 1.9;
          const x1 = cx + Math.cos(targetAngle) * maxR * 0.16;
          const y1 = cy + Math.sin(targetAngle) * maxR * 0.16;
          const mx = (x0 + x1) / 2 + Math.cos(phase + 0.7) * maxR * 0.2;
          const my = (y0 + y1) / 2 + Math.sin(phase + 0.7) * maxR * 0.2;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(mx, my, x1, y1);
          ctx.strokeStyle = 'rgba(205,224,255,' + (0.05 + 0.075 * (1 - k)).toFixed(3) + ')';
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
      }

      function spawnBurst() {
        if (!rect || !outline.length) return;
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const count = REDUCED ? 120 : 260;
        for (let i = 0; i < count; i += 1) {
          const edgePoint = outline[Math.floor(Math.random() * outline.length)];
          const angle = Math.atan2(edgePoint.y - cy, edgePoint.x - cx) + rand(-0.65, 0.65);
          const speed = rand(0.03, 0.24);
          burst.push({
            x: edgePoint.x,
            y: edgePoint.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: rand(650, 1650),
            size: rand(0.6, 2.0),
            sprite: Math.random() < 0.75 ? 0 : 1,
          });
        }
      }

      function drawBurst(t) {
        if (skipAt) return;
        const age = t - TIMING.form;
        if (age < 0) return;
        if (!burstSpawned) {
          spawnBurst();
          burstSpawned = true;
        }
        if (age > 1700) return;
        for (let i = 0; i < burst.length; i += 1) {
          const p = burst[i];
          const k = age / p.life;
          if (k >= 1) continue;
          const travel = age * (1 - 0.35 * k);
          const x = p.x + p.vx * travel;
          const y = p.y + p.vy * travel;
          const size = p.size * 5.2;
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.drawImage(sprites[p.sprite], x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
      }

      function draw(t) {
        if (!W || !H) return;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';

        drawFilaments(t);
        drawAmbient(t);

        if (markReady && particles.length) {
          const active = !skipAt && t < TIMING.form + 1400;
          if (active) {
            const gatherT = t - TIMING.gather;
            for (let i = 0; i < particles.length; i += 1) {
              const p = particles[i];
              let x;
              let y;
              let alpha = 0;
              if (gatherT <= 0) {
                const k = clamp(t / TIMING.gather, 0, 1);
                x = p.sx + Math.cos(p.phase + t * 0.0004) * 10;
                y = p.sy + Math.sin(p.phase + t * 0.0005) * 10;
                alpha = 0.32 * k;
              } else {
                const local = gatherT - p.delay;
                const u = clamp(local / p.dur, 0, 1);
                if (u <= 0) {
                  x = p.sx;
                  y = p.sy;
                  alpha = 0.45;
                } else {
                  const e = easeInOutCubic(u);
                  x = quadPoint(p.sx, p.mx, p.tx, e);
                  y = quadPoint(p.sy, p.my, p.ty, e);
                  x += Math.sin(t * 0.0022 + p.phase) * 2.4 * (1 - e);
                  y += Math.cos(t * 0.0019 + p.phase) * 2.4 * (1 - e);
                  alpha = 0.4 + 0.6 * easeOutCubic(u);
                  if (u >= 1) alpha *= 0.92 + 0.08 * Math.sin(t * 0.004 + p.phase);
                }
                if (t > TIMING.form) alpha *= clamp(1 - (t - TIMING.form) / 1300, 0, 1);
              }
              alpha *= p.alpha;
              if (alpha <= 0.01) continue;
              const dx = x - p.prevX;
              const dy = y - p.prevY;
              const dist = Math.hypot(dx, dy);
              if (dist > 0.6 && dist < 180) {
                ctx.globalAlpha = alpha * 0.3;
                ctx.strokeStyle = p.line;
                ctx.lineWidth = p.size * 0.75;
                ctx.beginPath();
                ctx.moveTo(p.prevX, p.prevY);
                ctx.lineTo(x, y);
                ctx.stroke();
              }
              p.prevX = x;
              p.prevY = y;
              const size = p.size * (REDUCED ? 3.8 : 5.6);
              ctx.globalAlpha = alpha;
              ctx.drawImage(sprites[p.sprite], x - size / 2, y - size / 2, size, size);
            }
            ctx.globalAlpha = 1;
          }
          drawRings(t);
        }
        drawBurst(t);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      function frame(now) {
        if (disposed) return;
        draw(now - start);
        raf = window.requestAnimationFrame(frame);
      }

      resize();
      buildAmbient();
      raf = window.requestAnimationFrame(frame);

      return {
        setMarkRect(nextRect) {
          if (!nextRect || !nextRect.width) return;
          rect = { x: nextRect.x, y: nextRect.y, width: nextRect.width, height: nextRect.height };
          build();
        },
        resize() {
          const ok = resize();
          if (ok) {
            buildAmbient();
            if (rect) build();
          }
        },
        finish() {
          skipAt = performance.now();
        },
        dispose() {
          disposed = true;
          window.cancelAnimationFrame(raf);
        },
      };
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */
    const CSS = `
body > *:not(#root) { display: none !important; }
[data-windows-menu] { display: none !important; }
.dsh-boot, .dsh-boot * { box-sizing: border-box; }
.dsh-boot {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: #04060a;
  color: var(--boot-ink);
  pointer-events: auto;
  cursor: default;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
  font-family: "Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  -webkit-font-smoothing: antialiased;
  --boot-ink: #eaf1ff;
  --boot-muted: rgba(203, 219, 255, 0.54);
  --boot-line: rgba(166, 194, 255, 0.16);
  --boot-blue: #4d6bfe;
  --boot-light: #a6c2ff;
  --boot-pale: #d2e0ff;
  --boot-warm: #e9ddc8;
  --boot-mono: "Cascadia Mono", "Cascadia Code", "Consolas", "SFMono-Regular", "Menlo", monospace;
  --boot-mark-w: min(38vw, calc(47vh * 1.3589), 720px);
  opacity: 1;
  transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.dsh-boot--exit {
  opacity: 0;
  transform: scale(1.035);
  pointer-events: none;
}
.dsh-boot-fallback {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 89% 46%, #777f89 0%, #204a7e 35%, #000 75%);
}
.dsh-boot-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  animation: dshBootBgIn 2.2s ease-out 0.1s forwards;
}
.dsh-boot-tint {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 62% 56% at 50% 50%, rgba(5, 8, 14, 0.42) 0%, rgba(5, 8, 14, 0.16) 55%, rgba(5, 8, 14, 0) 78%),
    radial-gradient(ellipse at 50% 50%, rgba(4, 6, 10, 0) 32%, rgba(4, 6, 10, 0.42) 74%, rgba(3, 5, 9, 0.82) 100%),
    linear-gradient(180deg, rgba(2, 4, 8, 0.72) 0%, rgba(2, 4, 8, 0) 24%, rgba(2, 4, 8, 0) 68%, rgba(2, 4, 8, 0.82) 100%);
}
.dsh-boot-grid {
  position: absolute;
  inset: 0;
  background-size: 90px 90px;
  background-image:
    linear-gradient(rgba(166, 194, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(166, 194, 255, 0.055) 1px, transparent 1px);
  -webkit-mask-image: radial-gradient(ellipse 74% 64% at 50% 48%, #000 8%, transparent 78%);
  mask-image: radial-gradient(ellipse 74% 64% at 50% 48%, #000 8%, transparent 78%);
  opacity: 0.6;
}
.dsh-boot-particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.dsh-boot-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 34%, rgba(0, 0, 0, 0.5) 100%);
  pointer-events: none;
}
.dsh-boot-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.022) 0px, rgba(255, 255, 255, 0.022) 1px, transparent 1px, transparent 3px);
  mix-blend-mode: overlay;
  opacity: 0.45;
  pointer-events: none;
  animation: dshBootScan 22s linear infinite;
}
.dsh-boot-hud {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 clamp(20px, 2.2vw, 40px);
  font-family: var(--boot-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--boot-muted);
  pointer-events: none;
  opacity: 0;
  animation: dshBootFadeIn 1.4s ease-out 0.6s forwards;
}
.dsh-boot-hud-top { top: clamp(18px, 2.4vh, 32px); }
.dsh-boot-hud-bottom { bottom: clamp(18px, 2.4vh, 30px); }
.dsh-boot-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: rgba(232, 240, 255, 0.82);
}
.dsh-boot-brand svg { width: 24px; height: auto; color: var(--boot-pale); filter: drop-shadow(0 0 8px rgba(120, 158, 255, 0.55)); }
.dsh-boot-brand-name { letter-spacing: 0.28em; }
.dsh-boot-brand em {
  font-style: normal;
  font-size: 8px;
  letter-spacing: 0.24em;
  padding: 3px 6px 2px;
  border: 1px solid rgba(166, 194, 255, 0.28);
  border-radius: 3px;
  color: rgba(166, 194, 255, 0.6);
}
.dsh-boot-status { display: flex; align-items: center; gap: 10px; }
.dsh-boot-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--boot-light);
  box-shadow: 0 0 9px rgba(120, 158, 255, 0.95), 0 0 20px rgba(77, 107, 254, 0.55);
  animation: dshBootPulse 2.2s ease-in-out infinite;
}
.dsh-boot-hud-bottom .dsh-boot-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.dsh-boot-progress {
  position: relative;
  width: clamp(110px, 12vw, 220px);
  height: 2px;
  overflow: hidden;
  background: rgba(166, 194, 255, 0.16);
}
.dsh-boot-progress i {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  background: linear-gradient(90deg, rgba(77, 107, 254, 0.9), var(--boot-pale));
  box-shadow: 0 0 10px rgba(120, 158, 255, 0.7);
  transition: width 1.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.dsh-boot-progress-num { font-size: 9px; letter-spacing: 0.14em; color: rgba(166, 194, 255, 0.6); min-width: 38px; }
.dsh-boot-hud-right { text-align: right; }
.dsh-boot-center {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
  transition: transform 3.2s cubic-bezier(0.16, 0.84, 0.24, 1), opacity 1.2s ease;
  will-change: transform;
}
.dsh-boot[data-phase="reveal"] .dsh-boot-center,
.dsh-boot[data-phase="ready"] .dsh-boot-center {
  transform: translate(calc(-50% - clamp(220px, 18vw, 380px)), -50%) scale(0.34);
}
.dsh-boot-mark-wrap {
  position: relative;
  width: var(--boot-mark-w);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dsh-boot-whale-color,
.dsh-boot-whale-mono { transition: opacity 1.8s ease; }
.dsh-boot-whale-mono { opacity: 0; }
.dsh-boot-whale-stroke { stroke: rgba(166, 194, 255, 0.55); transition: stroke 1.6s ease; }
.dsh-boot[data-phase="form"] .dsh-boot-whale-color,
.dsh-boot[data-phase="reveal"] .dsh-boot-whale-color,
.dsh-boot[data-phase="ready"] .dsh-boot-whale-color { opacity: 0; }
.dsh-boot[data-phase="form"] .dsh-boot-whale-mono,
.dsh-boot[data-phase="reveal"] .dsh-boot-whale-mono,
.dsh-boot[data-phase="ready"] .dsh-boot-whale-mono { opacity: 1; }
.dsh-boot[data-phase="form"] .dsh-boot-whale-stroke,
.dsh-boot[data-phase="reveal"] .dsh-boot-whale-stroke,
.dsh-boot[data-phase="ready"] .dsh-boot-whale-stroke { stroke: rgba(255, 255, 255, 0.82); }
.dsh-boot-aurora {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 146%;
  aspect-ratio: 1.2;
  transform: translate(-50%, -50%);
  background: radial-gradient(ellipse at center, rgba(77, 107, 254, 0.35) 0%, rgba(77, 107, 254, 0.13) 36%, rgba(77, 107, 254, 0) 70%);
  filter: blur(22px);
  opacity: 0.75;
  animation: dshBootAurora 6.5s ease-in-out infinite;
  pointer-events: none;
}
.dsh-boot-ghost {
  position: absolute;
  inset: 0;
  width: 100%;
  height: auto;
  opacity: 0;
  transition: opacity 1.3s ease;
  pointer-events: none;
}
.dsh-boot-ghost path {
  fill: rgba(166, 194, 255, 0.07);
  stroke: rgba(166, 194, 255, 0.22);
  stroke-width: 0.22;
}
.dsh-boot[data-phase="gather"] .dsh-boot-ghost,
.dsh-boot[data-phase="form"] .dsh-boot-ghost { opacity: 1; }
.dsh-boot-whale {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  opacity: 0;
  transform: scale(0.985);
  filter: blur(22px);
  transition: opacity 1.7s ease, filter 1.6s ease, transform 2.2s cubic-bezier(0.16, 0.84, 0.24, 1);
  will-change: transform;
}
.dsh-boot[data-phase="form"] .dsh-boot-whale,
.dsh-boot[data-phase="reveal"] .dsh-boot-whale,
.dsh-boot[data-phase="ready"] .dsh-boot-whale {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}
.dsh-boot[data-phase="ready"] .dsh-boot-whale {
  animation: dshBootWhaleFloat 7s ease-in-out infinite;
}
.dsh-boot-flash {
  position: absolute;
  inset: -55%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(238, 244, 255, 0.95) 0%, rgba(166, 194, 255, 0.5) 20%, rgba(77, 107, 254, 0) 62%);
  opacity: 0;
  pointer-events: none;
}
.dsh-boot[data-phase="form"] .dsh-boot-flash { animation: dshBootFlash 1.7s ease-out forwards; }
.dsh-boot-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 12%;
  aspect-ratio: 1;
  border: 1px solid rgba(206, 224, 255, 0.85);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.2);
  opacity: 0;
  box-shadow: 0 0 24px rgba(140, 176, 255, 0.65), inset 0 0 18px rgba(140, 176, 255, 0.35);
  pointer-events: none;
}
.dsh-boot[data-phase="form"] .dsh-boot-ring { animation: dshBootRing 2.2s cubic-bezier(0.16, 0.8, 0.3, 1) forwards; }
.dsh-boot-sparks {
  position: absolute;
  inset: -9%;
  opacity: 0;
  transition: opacity 1.6s ease 1.2s;
  pointer-events: none;
}
.dsh-boot[data-phase="reveal"] .dsh-boot-sparks,
.dsh-boot[data-phase="ready"] .dsh-boot-sparks { opacity: 1; }
.dsh-boot-sparks i {
  position: absolute;
  width: 4px;
  height: 4px;
  margin: -2px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.95), 0 0 26px rgba(255, 255, 255, 0.4);
  animation: dshBootTwinkle 3.8s ease-in-out infinite;
}
.dsh-boot-sparks i:nth-child(1) { left: 7%; top: 24%; animation-delay: 0.1s; }
.dsh-boot-sparks i:nth-child(2) { left: 19%; top: 7%; animation-delay: 0.5s; }
.dsh-boot-sparks i:nth-child(3) { left: 39%; top: 3%; animation-delay: 0.9s; }
.dsh-boot-sparks i:nth-child(4) { left: 63%; top: 9%; animation-delay: 1.3s; }
.dsh-boot-sparks i:nth-child(5) { left: 84%; top: 20%; animation-delay: 1.7s; }
.dsh-boot-sparks i:nth-child(6) { left: 93%; top: 43%; animation-delay: 2.1s; }
.dsh-boot-sparks i:nth-child(7) { left: 85%; top: 66%; animation-delay: 2.5s; }
.dsh-boot-sparks i:nth-child(8) { left: 61%; top: 84%; animation-delay: 2.9s; }
.dsh-boot-sparks i:nth-child(9) { left: 35%; top: 87%; animation-delay: 3.3s; }
.dsh-boot-sparks i:nth-child(10) { left: 12%; top: 68%; animation-delay: 3.7s; }
.dsh-boot-hello {
  margin-top: clamp(26px, 4.2vh, 48px);
  display: flex;
  align-items: center;
  gap: 16px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 1.2s ease, transform 1.2s ease;
  white-space: nowrap;
}
.dsh-boot[data-phase="gather"] .dsh-boot-hello,
.dsh-boot[data-phase="form"] .dsh-boot-hello { opacity: 1; transform: none; }
.dsh-boot[data-phase="reveal"] .dsh-boot-hello,
.dsh-boot[data-phase="ready"] .dsh-boot-hello { opacity: 0; transform: translateY(-6px); }
.dsh-boot-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 19px;
  filter: drop-shadow(0 0 7px rgba(143, 178, 255, 0.65));
}
.dsh-boot-wave i {
  display: block;
  width: 2px;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(180deg, #f2f7ff, #6f95ff);
  transform-origin: center;
  animation: dshBootWave 1.15s ease-in-out infinite;
}
.dsh-boot-wave i:nth-child(2) { animation-duration: 0.85s; animation-delay: 0.08s; }
.dsh-boot-wave i:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.16s; }
.dsh-boot-wave i:nth-child(4) { animation-duration: 0.95s; animation-delay: 0.24s; }
.dsh-boot-wave i:nth-child(5) { animation-duration: 0.8s; animation-delay: 0.32s; }
.dsh-boot-hello-text {
  font-size: clamp(17px, 1.35vw, 23px);
  letter-spacing: 0.46em;
  text-indent: 0.46em;
  color: rgba(232, 240, 255, 0.88);
  font-weight: 400;
}
.dsh-boot-tagline {
  position: absolute;
  left: 42%;
  top: 50%;
  z-index: 4;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 1.5s ease 0.15s;
  pointer-events: none;
  --tag-a: #f6f9ff;
  --tag-b: #d6e3ff;
  --tag-c: #9fbcff;
  --tag-d: #eef4ff;
  --tag-title: #eef4ff;
  --tag-eyebrow: rgba(166, 194, 255, 0.75);
  --tag-rule: rgba(166, 194, 255, 0.85);
  --tag-foot: rgba(166, 194, 255, 0.46);
}
.dsh-boot[data-phase="form"] .dsh-boot-tagline,
.dsh-boot[data-phase="reveal"] .dsh-boot-tagline,
.dsh-boot[data-phase="ready"] .dsh-boot-tagline {
  --tag-a: #ffffff;
  --tag-b: #ededed;
  --tag-c: #c6c6c6;
  --tag-d: #ffffff;
  --tag-title: #f5f5f5;
  --tag-eyebrow: rgba(255, 255, 255, 0.72);
  --tag-rule: rgba(255, 255, 255, 0.82);
  --tag-foot: rgba(255, 255, 255, 0.48);
}
.dsh-boot[data-phase="reveal"] .dsh-boot-tagline,
.dsh-boot[data-phase="ready"] .dsh-boot-tagline { opacity: 1; }
.dsh-boot-eyebrow {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: var(--boot-mono);
  font-size: 10px;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: var(--tag-eyebrow);
}
.dsh-boot-eyebrow::before {
  content: "";
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--tag-rule));
}
.dsh-boot-title {
  position: relative;
  display: inline-block;
  margin: 20px 0 0;
  font-weight: 500;
  font-size: clamp(46px, 4.6vw, 88px);
  line-height: 1.16;
  letter-spacing: 0.1em;
  color: var(--tag-title);
  text-shadow: none;
  white-space: nowrap;
}
.dsh-boot-title::after {
  content: "";
  position: absolute;
  top: -18%;
  bottom: -18%;
  left: 0;
  width: 26%;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.82) 0%, rgba(196, 220, 255, 0.34) 40%, rgba(196, 220, 255, 0) 72%);
  mix-blend-mode: screen;
  opacity: 0;
  pointer-events: none;
}
.dsh-boot[data-phase="reveal"] .dsh-boot-title::after {
  animation: dshBootTextSweep 2.7s ease-in-out 0.15s both;
}
.dsh-boot-ch {
  display: inline-block;
  opacity: 0;
  transform: translateY(22px);
}
.dsh-boot[data-phase="reveal"] .dsh-boot-ch {
  animation: dshBootCharGlow 1.6s cubic-bezier(0.16, 0.84, 0.24, 1) both;
  animation-delay: calc(var(--i) * 150ms + 300ms);
}
.dsh-boot[data-phase="ready"] .dsh-boot-ch {
  opacity: 1;
  transform: none;
  text-shadow: none;
}
.dsh-boot-tagline-rule {
  width: 0;
  height: 1px;
  margin-top: 30px;
  background: linear-gradient(90deg, var(--tag-rule), transparent);
  transition: width 2.4s cubic-bezier(0.16, 0.84, 0.24, 1) 0.6s;
}
.dsh-boot[data-phase="reveal"] .dsh-boot-tagline-rule,
.dsh-boot[data-phase="ready"] .dsh-boot-tagline-rule { width: min(520px, 36vw); }
.dsh-boot-tagline-foot {
  margin-top: 16px;
  font-family: var(--boot-mono);
  font-size: 9.5px;
  letter-spacing: 0.44em;
  text-transform: uppercase;
  color: var(--tag-foot);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 1.4s ease 1.1s, transform 1.4s ease 1.1s;
}
.dsh-boot[data-phase="reveal"] .dsh-boot-tagline-foot,
.dsh-boot[data-phase="ready"] .dsh-boot-tagline-foot { opacity: 1; transform: none; }
.dsh-boot-fshint {
  position: absolute;
  left: 50%;
  top: clamp(78px, 11vh, 124px);
  transform: translateX(-50%);
  z-index: 7;
  font-family: var(--boot-mono);
  font-size: 10px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: rgba(205, 222, 255, 0.55);
  pointer-events: none;
  white-space: nowrap;
  opacity: 0;
  animation: dshBootFadeIn 1s ease 0.9s forwards;
}
.dsh-boot-hint {
  position: absolute;
  left: 50%;
  bottom: clamp(54px, 8.4vh, 96px);  z-index: 7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  transform: translate(-50%, 18px);
  opacity: 0;
  transition: opacity 1.3s ease, transform 1.3s cubic-bezier(0.16, 0.84, 0.24, 1);
  pointer-events: none;
  white-space: nowrap;
}
.dsh-boot[data-phase="ready"] .dsh-boot-hint { opacity: 1; transform: translate(-50%, 0); }
.dsh-boot-hint-eyebrow {
  font-family: var(--boot-mono);
  font-size: 9px;
  letter-spacing: 0.36em;
  color: rgba(166, 194, 255, 0.5);
}
.dsh-boot-hint-line {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: clamp(13px, 1vw, 15px);
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: rgba(236, 244, 255, 0.94);
}
.dsh-boot-hint-orb {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(190, 214, 255, 0.48);
  background: radial-gradient(circle at 50% 45%, rgba(77, 107, 254, 0.3), rgba(77, 107, 254, 0.03) 70%);
  box-shadow: 0 0 24px rgba(77, 107, 254, 0.3);
  animation: dshBootOrb 3.2s ease-in-out infinite;
}
.dsh-boot-hint-orb::after {
  content: "";
  position: absolute;
  inset: -9px;
  border-radius: 50%;
  border: 1px solid rgba(120, 158, 255, 0.24);
  animation: dshBootHalo 2.8s ease-out infinite;
}
.dsh-boot-hint-orb svg { width: 14px; height: 14px; opacity: 0.9; }
.dsh-boot-hint-sub {
  font-family: var(--boot-mono);
  font-size: 8.5px;
  letter-spacing: 0.34em;
  color: rgba(166, 194, 255, 0.38);
}
.dsh-boot-lens {
  position: fixed;
  inset: 0;
  z-index: 12;
  display: none;
  pointer-events: none;
}
.dsh-boot-lens-clip {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 38% 32%, rgba(20, 34, 58, 0.97), rgba(4, 8, 16, 0.98) 70%);
}
.dsh-boot-lens-zoom {
  position: fixed;
  inset: 0;
  will-change: transform;
}
.dsh-boot-lens-clone .dsh-boot-center { transition: none !important; }
.dsh-boot-lens-clone .dsh-boot-whale { animation: none !important; }
.dsh-boot-lens-clone .dsh-boot-ch { animation: none !important; opacity: 1; transform: none; }
.dsh-boot-lens-ring {
  position: fixed;
  left: 0;
  top: 0;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 1px solid rgba(226, 238, 255, 0.8);
  box-shadow: 0 0 26px rgba(130, 170, 255, 0.42), inset 0 0 20px rgba(180, 210, 255, 0.12);
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0) 58%);
}
.dsh-boot-wipe {
  position: absolute;
  inset: 0;
  z-index: 9;
  background: radial-gradient(circle at 50% 50%, rgba(236, 243, 255, 0.92) 0%, rgba(120, 158, 255, 0.3) 34%, rgba(77, 107, 254, 0) 68%);
  opacity: 0;
  pointer-events: none;
  animation: dshBootWipe 0.95s ease-out forwards;
}
.dsh-boot-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@keyframes dshBootBgIn { from { opacity: 0; } to { opacity: 0.88; } }
@keyframes dshBootFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes dshBootScan { from { background-position: 0 0; } to { background-position: 0 300px; } }
@keyframes dshBootPulse {
  0%, 100% { opacity: 0.45; transform: scale(0.82); }
  50% { opacity: 1; transform: scale(1.1); }
}
@keyframes dshBootAurora {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.94); }
  50% { opacity: 0.92; transform: translate(-50%, -50%) scale(1.06); }
}
@keyframes dshBootWhaleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
@keyframes dshBootFlash {
  0% { opacity: 0; transform: scale(0.35); }
  14% { opacity: 0.92; }
  100% { opacity: 0; transform: scale(1.35); }
}
@keyframes dshBootRing {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
  12% { opacity: 0.9; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(6.4); }
}
@keyframes dshBootSheen {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes dshBootWave {
  0%, 100% { transform: scaleY(0.26); opacity: 0.65; }
  50% { transform: scaleY(1); opacity: 1; }
}
@keyframes dshBootOrb {
  0%, 100% { transform: scale(1); box-shadow: 0 0 22px rgba(77, 107, 254, 0.26); }
  50% { transform: scale(1.055); box-shadow: 0 0 34px rgba(77, 107, 254, 0.46); }
}
@keyframes dshBootHalo {
  0% { opacity: 0.75; transform: scale(0.9); }
  75% { opacity: 0; transform: scale(1.4); }
  100% { opacity: 0; transform: scale(1.4); }
}
@keyframes dshBootTwinkle {
  0%, 100% { opacity: 0.08; transform: scale(0.55); }
  38% { opacity: 0.95; transform: scale(1.2); }
  62% { opacity: 0.35; transform: scale(0.8); }
}
@keyframes dshBootCharGlow {
  0% {
    opacity: 0;
    transform: translateY(22px);
    text-shadow: 0 0 0 rgba(255, 255, 255, 0);
  }
  24% {
    opacity: 1;
    transform: translateY(0);
    text-shadow: 0 0 28px rgba(255, 255, 255, 1), 0 0 78px rgba(190, 218, 255, 0.95), 0 0 132px rgba(125, 170, 255, 0.5);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
    text-shadow: 0 0 0 rgba(255, 255, 255, 0);
  }
}
@keyframes dshBootTextSweep {
  0% { opacity: 0; transform: translateX(-120%); }
  14% { opacity: 1; }
  82% { opacity: 0.65; }
  100% { opacity: 0; transform: translateX(440%); }
}
@keyframes dshBootWipe {
  0% { opacity: 0; }
  16% { opacity: 1; }
  100% { opacity: 0; }
}
@media (max-width: 900px), (max-height: 620px) {
  .dsh-boot {
    --boot-mark-w: min(58vw, calc(28vh * 1.3589), 460px);
  }
  .dsh-boot[data-phase="reveal"] .dsh-boot-center,
  .dsh-boot[data-phase="ready"] .dsh-boot-center {
    transform: translate(-50%, calc(-50% - 21vh)) scale(0.52);
  }
  .dsh-boot-tagline {
    left: 50%;
    top: calc(50% + 12.5vh);
    width: 92vw;
    transform: translate(-50%, 0);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .dsh-boot-eyebrow::before { width: 30px; }
  .dsh-boot-title {
    font-size: clamp(36px, 8.4vw, 60px);
    letter-spacing: 0.06em;
    margin-top: 14px;
  }
  .dsh-boot-tagline-rule { width: 0; margin-top: 20px; }
  .dsh-boot[data-phase="reveal"] .dsh-boot-tagline-rule,
  .dsh-boot[data-phase="ready"] .dsh-boot-tagline-rule { width: min(340px, 68vw); }
  .dsh-boot[data-phase="reveal"] .dsh-boot-tagline-foot,
  .dsh-boot[data-phase="ready"] .dsh-boot-tagline-foot { margin-top: 12px; }
  .dsh-boot-hint { bottom: 34px; }
  .dsh-boot-hint-eyebrow { display: none; }
  .dsh-boot-hint-sub { letter-spacing: 0.2em; }
  .dsh-boot-hud-bottom .dsh-boot-progress-wrap { display: none; }
  .dsh-boot-brand-name { display: none; }
}
@media (max-width: 520px) {
  .dsh-boot-hello-text { letter-spacing: 0.3em; text-indent: 0.3em; }
  .dsh-boot-status { font-size: 8.5px; letter-spacing: 0.12em; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-boot * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.18s !important;
  }
}
`;

    /* ------------------------------------------------------------------ *
     * Component
     * ------------------------------------------------------------------ */
    function BootScreen() {
      const [phase, setPhase] = useState('boot');
      const [exiting, setExiting] = useState(false);
      const [done, setDone] = useState(false);
      const [isFullscreen, setIsFullscreen] = useState(false);
      const rootRef = useRef(null);
      const bgRef = useRef(null);
      const particleRef = useRef(null);
      const markRef = useRef(null);
      const phaseRef = useRef('boot');
      const audioRef = useRef(null);
      const engineRef = useRef(null);
      const timersRef = useRef([]);
      const teardownRef = useRef(null);
      const taglineSaidRef = useRef(false);
      const enteredRef = useRef(false);
      const actedRef = useRef(false);
      const fullscreenRef = useRef(false);
      const requestFullscreenRef = useRef(null);
      const markWrapRef = useRef(null);
      const taglineRef = useRef(null);
      const lensRef = useRef(null);
      const lensClipRef = useRef(null);
      const lensZoomRef = useRef(null);
      const lensRingRef = useRef(null);
      const lensActiveRef = useRef(false);

      function advance(next) {
        phaseRef.current = next;
        setPhase(next);
      }

      function clearTimers() {
        timersRef.current.forEach((id) => window.clearTimeout(id));
        timersRef.current = [];
      }

      function hideLens() {
        lensActiveRef.current = false;
        if (lensRef.current) lensRef.current.style.display = 'none';
      }

      function showLens(x, y) {
        const lens = lensRef.current;
        const clip = lensClipRef.current;
        const zoom = lensZoomRef.current;
        const ring = lensRingRef.current;
        if (!lens || !clip || !zoom || !ring) return;
        const radius = 80;
        lens.style.display = 'block';
        clip.style.clipPath = 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)';
        zoom.style.transformOrigin = x + 'px ' + y + 'px';
        zoom.style.transform = 'scale(2)';
        ring.style.transform = 'translate(' + (x - radius) + 'px, ' + (y - radius) + 'px)';
        lensActiveRef.current = true;
      }

      function onOverlayPointerMove(event) {
        if (phaseRef.current !== 'ready' || enteredRef.current) {
          if (lensActiveRef.current) hideLens();
          return;
        }
        const hit = (element) => {
          if (!element) return false;
          const r = element.getBoundingClientRect();
          return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
        };
        if (hit(markWrapRef.current) || hit(taglineRef.current)) {
          showLens(event.clientX, event.clientY);
        } else if (lensActiveRef.current) {
          hideLens();
        }
      }

      function enter() {
        if (enteredRef.current) return;
        enteredRef.current = true;
        hideLens();
        clearTimers();
        try { audioRef.current && audioRef.current.stopAll(); } catch (e) { /* ignore */ }
        setExiting(true);
        window.setTimeout(() => {
          setDone(true);
          if (teardownRef.current) teardownRef.current();
        }, 920);
        window.setTimeout(() => {
          try {
            if (fullscreenRef.current && document.fullscreenElement) {
              fullscreenRef.current = false;
              const exit = document.exitFullscreen();
              if (exit && exit.catch) exit.catch(() => {});
            }
          } catch (e) { /* ignore */ }
        }, 1150);
      }

      function onStageClick() {
        if (enteredRef.current) return;
        if (phaseRef.current === 'ready') {
          enter();
          return;
        }
        // Before the end card, a click is a real user gesture: use it to enter
        // real fullscreen without skipping the sequence.
        if (!document.fullscreenElement) {
          try { requestFullscreenRef.current && requestFullscreenRef.current(); } catch (e) { /* ignore */ }
        }
      }

      useEffect(() => {
        let disposed = false;
        const root = rootRef.current;
        const audio = createVoice();
        audioRef.current = audio;
        audio.init();

        const fluid = startFluid(bgRef.current);
        const engine = createParticles(particleRef.current);
        engineRef.current = engine;

        const timers = timersRef.current;
        function later(ms, fn) {
          const id = window.setTimeout(() => {
            if (disposed) return;
            try { fn(); } catch (e) { /* keep the sequence alive */ }
          }, ms);
          timers.push(id);
        }

        later(TIMING.gather, () => advance('gather'));
        later(TIMING.welcome, () => {
          try { audio.say('welcome'); } catch (e) { /* ignore */ }
        });
        later(TIMING.form, () => {
          advance('form');
          try { audio.accent('solidify'); } catch (e) { /* ignore */ }
        });
        later(TIMING.reveal, () => {
          advance('reveal');
          try { audio.accent('reveal'); } catch (e) { /* ignore */ }
        });
        later(TIMING.tagline, () => {
          if (taglineSaidRef.current) return;
          taglineSaidRef.current = true;
          try { audio.say('tagline'); } catch (e) { /* ignore */ }
        });
        later(TIMING.ready, () => advance('ready'));

        let layoutRaf = 0;
        function layout() {
          layoutRaf = 0;
          if (disposed) return;
          try { engine && engine.resize(); } catch (e) { /* ignore */ }
          try {
            if (markRef.current) {
              const r = markRef.current.getBoundingClientRect();
              if (r && r.width > 4) engine && engine.setMarkRect(r);
            }
          } catch (e) { /* ignore */ }
        }
        function requestLayout() {
          if (layoutRaf) return;
          layoutRaf = window.requestAnimationFrame(layout);
        }
        window.requestAnimationFrame(() => {
          requestLayout();
          window.requestAnimationFrame(layout);
        });
        later(700, layout);
        later(1600, layout);

        window.addEventListener('resize', requestLayout);
        const onKeyDown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (phaseRef.current === 'ready') {
              event.preventDefault();
              enter();
            } else if (!document.fullscreenElement) {
              try { requestFullscreenRef.current && requestFullscreenRef.current(); } catch (e) { /* ignore */ }
            }
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        const preventScroll = (event) => {
          if (event.target === root || (root && root.contains(event.target))) event.preventDefault();
        };
        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });

        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) { /* ignore */ }

        // Fullscreen: try on mount, and fall back to the first real gesture.
        const requestFullscreen = () => {
          if (document.fullscreenElement || fullscreenRef.current) return;
          try {
            const element = document.documentElement;
            if (typeof element.requestFullscreen !== 'function') return;
            const request = element.requestFullscreen({ navigationUI: 'hide' });
            if (request && request.then) {
              request.then(() => {
                fullscreenRef.current = true;
                try { window.console.info('[dsh-boot-animation] fullscreen entered'); } catch (e) { /* ignore */ }
              }).catch(() => { /* the overlay still fills the maximized window */ });
            }
          } catch (e) { /* the overlay still fills the maximized window */ }
        };
        requestFullscreenRef.current = requestFullscreen;
        const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onFullscreenChange);
        onFullscreenChange();
        requestFullscreen();

        window.setTimeout(() => {
          if (!disposed && root) {
            try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
          }
        }, 60);

        teardownRef.current = () => {
          disposed = true;
          clearTimers();
          if (layoutRaf) window.cancelAnimationFrame(layoutRaf);
          window.removeEventListener('resize', requestLayout);
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('wheel', preventScroll);
          window.removeEventListener('touchmove', preventScroll);
          document.removeEventListener('fullscreenchange', onFullscreenChange);
          requestFullscreenRef.current = null;
          document.documentElement.style.overflow = previousOverflow;
          try { engine && engine.dispose(); } catch (e) { /* ignore */ }
          try { fluid && fluid.dispose(); } catch (e) { /* ignore */ }
          try { audio.dispose(); } catch (e) { /* ignore */ }
          try {
            if (fullscreenRef.current && document.fullscreenElement) {
              fullscreenRef.current = false;
              const exit = document.exitFullscreen();
              if (exit && exit.catch) exit.catch(() => {});
            }
          } catch (e) { /* ignore */ }
          audioRef.current = null;
          engineRef.current = null;
        };

        return () => {
          if (teardownRef.current) teardownRef.current();
          teardownRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      if (done) return null;

      const progress = PROGRESS[phase] || 0;
      const status = STATUS[phase] || STATUS.boot;
      const brandMark = h('svg', {
        viewBox: WHALE_VIEWBOX,
        'aria-hidden': true,
        focusable: false,
      }, h('path', { d: WHALE_PATH, fill: 'currentColor' }));

      return h('div', {
        className: 'dsh-boot' + (exiting ? ' dsh-boot--exit' : ''),
        'data-phase': phase,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'DeepSeek Harness 启动动画',
        tabIndex: -1,
        ref: rootRef,
        onClick: onStageClick,
        onPointerMove: onOverlayPointerMove,
        onPointerLeave: hideLens,
      },
        h('style', { key: 'boot-style' }, CSS),
        h('div', { key: 'fallback', className: 'dsh-boot-fallback', 'aria-hidden': true }),
        h('canvas', { key: 'bg', ref: bgRef, className: 'dsh-boot-bg', 'aria-hidden': true }),
        h('div', { key: 'tint', className: 'dsh-boot-tint', 'aria-hidden': true }),
        h('div', { key: 'grid', className: 'dsh-boot-grid', 'aria-hidden': true }),
        h('canvas', { key: 'particles', ref: particleRef, className: 'dsh-boot-particles', 'aria-hidden': true }),
        h('div', { key: 'vignette', className: 'dsh-boot-vignette', 'aria-hidden': true }),
        h('div', { key: 'scanlines', className: 'dsh-boot-scanlines', 'aria-hidden': true }),

        h('header', { key: 'hud-top', className: 'dsh-boot-hud dsh-boot-hud-top' },
          h('div', { className: 'dsh-boot-brand' },
            h('span', { className: 'dsh-boot-brand-mark', 'aria-hidden': true }, brandMark),
            h('span', { className: 'dsh-boot-brand-name' }, 'DEEPSEEK HARNESS'),
            h('em', null, 'PREVIEW'),
          ),
          h('div', { className: 'dsh-boot-status' },
            h('i', { className: 'dsh-boot-dot', 'aria-hidden': true }),
            h('span', null, status),
          ),
        ),

        !isFullscreen && phase !== 'ready' ? h('div', { key: 'fs-hint', className: 'dsh-boot-fshint' }, '点击任意处 · 进入全屏') : null,

        h('div', { key: 'center', className: 'dsh-boot-center' },
          h('div', { className: 'dsh-boot-mark-wrap', ref: markWrapRef },
            h('div', { className: 'dsh-boot-aurora', 'aria-hidden': true }),
            h('svg', {
              className: 'dsh-boot-ghost',
              viewBox: WHALE_VIEWBOX,
              'aria-hidden': true,
              focusable: false,
            }, h('path', { d: WHALE_PATH })),
            h('svg', {
              className: 'dsh-boot-whale',
              viewBox: WHALE_VIEWBOX,
              ref: markRef,
              role: 'img',
              'aria-label': 'DeepSeek 鲸鱼标识',
            },
              h('defs', null,
                h('linearGradient', {
                  id: 'dshBootWhaleFill',
                  x1: '0.163',
                  y1: '20',
                  x2: '26.5',
                  y2: '4',
                  gradientUnits: 'userSpaceOnUse',
                },
                  h('stop', { offset: '0%', stopColor: '#3f63ec' }),
                  h('stop', { offset: '38%', stopColor: '#7fa6ff' }),
                  h('stop', { offset: '72%', stopColor: '#cfe0ff' }),
                  h('stop', { offset: '100%', stopColor: '#f3f8ff' }),
                ),
                h('linearGradient', {
                  id: 'dshBootWhaleMono',
                  x1: '0.163',
                  y1: '20',
                  x2: '26.5',
                  y2: '4',
                  gradientUnits: 'userSpaceOnUse',
                },
                  h('stop', { offset: '0%', stopColor: '#8d8d8d' }),
                  h('stop', { offset: '34%', stopColor: '#d6d6d6' }),
                  h('stop', { offset: '70%', stopColor: '#ffffff' }),
                  h('stop', { offset: '100%', stopColor: '#f4f4f4' }),
                ),
              ),
              h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-color', fill: 'url(#dshBootWhaleFill)' }),
              h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-mono', fill: 'url(#dshBootWhaleMono)' }),
              h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-stroke', fill: 'none', strokeWidth: 0.09, opacity: 0.9 }),
            ),
            h('div', { className: 'dsh-boot-flash', 'aria-hidden': true }),
            h('div', { className: 'dsh-boot-ring', 'aria-hidden': true }),
            h('div', { className: 'dsh-boot-sparks', 'aria-hidden': true },
              Array.from({ length: 10 }, (_, index) => h('i', { key: index })),
            ),
          ),
          h('div', { className: 'dsh-boot-hello' },
            h('span', { className: 'dsh-boot-wave', 'aria-hidden': true },
              h('i', null), h('i', null), h('i', null), h('i', null), h('i', null),
            ),
            h('span', { className: 'dsh-boot-hello-text' }, '欢迎回来'),
          ),
        ),

        h('div', { key: 'tagline', className: 'dsh-boot-tagline', ref: taglineRef },
          h('div', { className: 'dsh-boot-eyebrow' }, 'DEEPSEEK HARNESS'),
          h('h1', { className: 'dsh-boot-title', 'aria-label': TITLE },
            TITLE.split('').map((ch, index) => h('span', {
              key: index,
              className: 'dsh-boot-ch',
              'aria-hidden': true,
              style: { '--i': index },
            }, ch)),
          ),
          h('div', { className: 'dsh-boot-tagline-rule', 'aria-hidden': true }),
          h('div', { className: 'dsh-boot-tagline-foot' }, 'EXPLORE THE UNDISCOVERED'),
        ),

        h('footer', { key: 'hud-bottom', className: 'dsh-boot-hud dsh-boot-hud-bottom' },
          h('span', { className: 'dsh-boot-hud-left' }, 'NEURAL CORE · ONLINE'),
          h('div', { className: 'dsh-boot-progress-wrap' },
            h('span', { className: 'dsh-boot-progress-num' }, 'BOOT ' + pad2(Math.min(4, Math.ceil(progress / 25)))),
            h('span', { className: 'dsh-boot-progress' }, h('i', { style: { width: progress + '%' } })),
            h('span', { className: 'dsh-boot-progress-num' }, pad2(progress) + '%'),
          ),
          h('span', { className: 'dsh-boot-hud-right' }, '© DEEPSEEK · 共探智能上限'),
        ),

        h('div', { key: 'hint', className: 'dsh-boot-hint' },
          h('div', { className: 'dsh-boot-hint-eyebrow' }, 'SYSTEM READY · 工作界面已就绪'),
          h('div', { className: 'dsh-boot-hint-line' },
            h('span', { className: 'dsh-boot-hint-orb', 'aria-hidden': true },
              h('svg', { viewBox: '0 0 16 16', fill: 'none' },
                h('path', { d: 'M3 8h9.4M8.5 3.5 13 8l-4.5 4.5', stroke: 'currentColor', strokeWidth: '1.2', strokeLinecap: 'round', strokeLinejoin: 'round' }),
              ),
            ),
            h('span', null, '点击屏幕进入'),
          ),
          h('div', { className: 'dsh-boot-hint-sub' }, 'CLICK ANYWHERE OR PRESS ENTER'),
        ),

        h('div', { key: 'lens', className: 'dsh-boot-lens', ref: lensRef, 'aria-hidden': true, style: { display: 'none' } },
          h('div', { className: 'dsh-boot-lens-clip', ref: lensClipRef },
            h('div', { className: 'dsh-boot-lens-zoom', ref: lensZoomRef },
              h('div', { className: 'dsh-boot-lens-clone' },
                h('div', { className: 'dsh-boot-center' },
                  h('div', { className: 'dsh-boot-mark-wrap' },
                    h('div', { className: 'dsh-boot-aurora', 'aria-hidden': true }),
                    h('svg', { className: 'dsh-boot-whale', viewBox: WHALE_VIEWBOX, 'aria-hidden': true, focusable: false },
                      h('defs', null,
                        h('linearGradient', {
                          id: 'dshBootWhaleFillLens', x1: '0.163', y1: '20', x2: '26.5', y2: '4', gradientUnits: 'userSpaceOnUse',
                        },
                          h('stop', { offset: '0%', stopColor: '#3f63ec' }),
                          h('stop', { offset: '38%', stopColor: '#7fa6ff' }),
                          h('stop', { offset: '72%', stopColor: '#cfe0ff' }),
                          h('stop', { offset: '100%', stopColor: '#f3f8ff' }),
                        ),
                        h('linearGradient', {
                          id: 'dshBootWhaleMonoLens', x1: '0.163', y1: '20', x2: '26.5', y2: '4', gradientUnits: 'userSpaceOnUse',
                        },
                          h('stop', { offset: '0%', stopColor: '#8d8d8d' }),
                          h('stop', { offset: '34%', stopColor: '#d6d6d6' }),
                          h('stop', { offset: '70%', stopColor: '#ffffff' }),
                          h('stop', { offset: '100%', stopColor: '#f4f4f4' }),
                        ),
                      ),
                      h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-color', fill: 'url(#dshBootWhaleFillLens)' }),
                      h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-mono', fill: 'url(#dshBootWhaleMonoLens)' }),
                      h('path', { d: WHALE_PATH, className: 'dsh-boot-whale-stroke', fill: 'none', strokeWidth: 0.09, opacity: 0.9 }),
                    ),
                  ),
                ),
                h('div', { className: 'dsh-boot-tagline' },
                  h('div', { className: 'dsh-boot-eyebrow' }, 'DEEPSEEK HARNESS'),
                  h('h1', { className: 'dsh-boot-title', 'aria-hidden': true },
                    TITLE.split('').map((ch, index) => h('span', {
                      key: index,
                      className: 'dsh-boot-ch',
                      style: { '--i': index },
                    }, ch)),
                  ),
                  h('div', { className: 'dsh-boot-tagline-rule', 'aria-hidden': true }),
                  h('div', { className: 'dsh-boot-tagline-foot' }, 'EXPLORE THE UNDISCOVERED'),
                ),
              ),
            ),
          ),
          h('div', { className: 'dsh-boot-lens-ring', ref: lensRingRef, 'aria-hidden': true }),
        ),

        exiting ? h('div', { key: 'wipe', className: 'dsh-boot-wipe', 'aria-hidden': true }) : null,
        h('div', { key: 'a11y', className: 'dsh-boot-sr', role: 'status', 'aria-live': 'polite' },
          phase === 'ready' ? '启动完成。点击屏幕进入 DeepSeek Harness 工作界面。' : status,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-boot-animation',
          order: 1000,
          label: 'DeepSeek Harness boot animation',
        }, BootScreen));
      },
    };
  },
});
