import { RATIOS, clipEnd, clipLen, projectDuration } from "./store.js";
import {
  detectBeats,
  getTrack,
  renderSfx,
  renderTrack,
  trackBeats,
} from "./library.js";

const FILTERS = {
  none: "",
  vivid: "contrast(1.18) saturate(1.35)",
  cine: "contrast(1.12) saturate(0.82) sepia(0.12)",
  fade: "contrast(0.9) saturate(0.75) brightness(1.08)",
  noir: "grayscale(1) contrast(1.2)",
  polaroid: "sepia(0.35) contrast(1.05) saturate(0.9) brightness(1.08)",
  tokyo: "saturate(1.25) hue-rotate(-12deg) contrast(1.1)",
  miami: "saturate(1.4) hue-rotate(18deg) contrast(1.08)",
  golden: "sepia(0.28) saturate(1.2) brightness(1.06) contrast(1.05)",
  arctic: "saturate(0.7) contrast(1.1) brightness(1.08) hue-rotate(12deg)",
  punch: "contrast(1.28) saturate(1.2)",
  dream: "blur(0.4px) brightness(1.1) saturate(1.15) contrast(0.95)",
  retro: "sepia(0.45) contrast(1.15) saturate(1.3)",
  matrix: "hue-rotate(80deg) saturate(1.4) contrast(1.15)",
  blush: "saturate(1.15) contrast(1.05) hue-rotate(-18deg) brightness(1.05)",
};

export const FILTER_IDS = Object.keys(FILTERS);

function wait(el, ev) {
  return new Promise((res) => el.addEventListener(ev, res, { once: true }));
}

function cssFilter(clip) {
  const a = clip.adjust || {};
  const parts = [FILTERS[clip.filter] || ""];
  if (a.brightness) parts.push(`brightness(${1 + a.brightness / 100})`);
  if (a.contrast) parts.push(`contrast(${1 + a.contrast / 100})`);
  if (a.saturate) parts.push(`saturate(${1 + a.saturate / 100})`);
  if (a.warmth) parts.push(`sepia(${Math.max(0, a.warmth) / 200}) hue-rotate(${-a.warmth * 0.35}deg)`);
  return parts.filter(Boolean).join(" ") || "none";
}

export class Engine {
  constructor(store, db) {
    this.store = store;
    this.db = db;
    this.canvas = null;
    this.ctx = null;
    this.stage = null;
    this.pool = [];
    this.assign = new Map();
    this.media = new Map();
    this.urls = new Map();
    this.images = new Map();
    this.audioBuf = new Map();
    this.audioCtx = null;
    this.master = null;
    this.musicGain = null;
    this.voiceGain = null;
    this.clipGain = null;
    this.liveNodes = [];
    this.raf = 0;
    this.originPerf = 0;
    this.originTime = 0;
    this.exporting = false;
    this.onFrame = null;
  }

  attach(stage, canvas) {
    this.stage = stage;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.pool = [];
    for (let i = 0; i < 3; i++) {
      const v = document.createElement("video");
      v.playsInline = true;
      v.muted = true;
      v.preload = "auto";
      v.className = "pool";
      stage.appendChild(v);
      this.pool.push(v);
    }
    this.resize();
    this.draw(this.store.time);
  }

  resize() {
    if (!this.canvas || !this.store.project) return;
    const [w, h] = RATIOS[this.store.project.ratio] || RATIOS["9:16"];
    const wrap = this.stage.parentElement;
    const maxW = wrap.clientWidth - 8;
    const maxH = wrap.clientHeight - 8;
    const scale = Math.min(maxW / w, maxH / h, 1);
    const cw = Math.max(2, Math.round(w * scale));
    const ch = Math.max(2, Math.round(h * scale));
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.stage.style.width = cw + "px";
    this.stage.style.height = ch + "px";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.draw(this.now());
  }

  async unlock() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.audioCtx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.audioCtx.destination);
      this.musicGain = this.audioCtx.createGain();
      this.voiceGain = this.audioCtx.createGain();
      this.clipGain = this.audioCtx.createGain();
      this.musicGain.connect(this.master);
      this.voiceGain.connect(this.master);
      this.clipGain.connect(this.master);
    }
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
  }

  async cacheMedia(id) {
    if (this.media.has(id)) return this.media.get(id);
    const rec = await this.db.getMedia(id);
    if (!rec) return null;
    if (!this.urls.has(id)) this.urls.set(id, URL.createObjectURL(rec.blob));
    this.media.set(id, rec);
    if (rec.type === "image" && !this.images.has(id)) {
      const img = new Image();
      img.src = this.urls.get(id);
      await img.decode().catch(() => {});
      this.images.set(id, img);
    }
    return rec;
  }

  async ensureClipMedia() {
    const p = this.store.project;
    if (!p) return;
    for (const c of p.clips) await this.cacheMedia(c.mediaId);
    for (const a of [...p.music, ...p.voice]) {
      if (a.mediaId) await this.cacheMedia(a.mediaId);
    }
  }

  async getAudioBuffer(key, factory) {
    if (this.audioBuf.has(key)) return this.audioBuf.get(key);
    const buf = await factory();
    if (buf) this.audioBuf.set(key, buf);
    return buf;
  }

  async bufferForMusic(item) {
    if (item.trackId) {
      const track = getTrack(item.trackId);
      if (!track) return null;
      return this.getAudioBuffer("t:" + track.id, () => renderTrack(track));
    }
    if (item.sfxId) {
      return this.getAudioBuffer("s:" + item.sfxId, () => renderSfx(item.sfxId));
    }
    if (item.mediaId) {
      return this.getAudioBuffer("m:" + item.mediaId, async () => {
        const rec = await this.cacheMedia(item.mediaId);
        if (!rec) return null;
        const raw = await rec.blob.arrayBuffer();
        return this.audioCtx.decodeAudioData(raw.slice(0));
      });
    }
    if (item.streamUrl) {
      return this.getAudioBuffer("u:" + item.streamUrl, async () => {
        const r = await fetch(item.streamUrl);
        const raw = await r.arrayBuffer();
        return this.audioCtx.decodeAudioData(raw.slice(0));
      });
    }
    return null;
  }

  now() {
    if (!this.store.playing) return this.store.time;
    const t = this.originTime + (performance.now() - this.originPerf) / 1000;
    const d = projectDuration(this.store.project);
    if (t >= d) {
      this.pause();
      this.store.setTime(d);
      return d;
    }
    return t;
  }

  clipsAt(t) {
    return this.store.project.clips.filter((c) => t >= c.start - 0.0001 && t < clipEnd(c) + 0.0001);
  }

  sourceTime(clip, t) {
    const local = (t - clip.start) * (clip.speed || 1);
    if (clip.reverse) return clip.outPoint - local;
    return clip.inPoint + local;
  }

  async syncVideos(t) {
    const active = this.clipsAt(t).filter((c) => c.type === "video");
    const keep = new Set(active.map((c) => c.id));
    for (const [id, el] of [...this.assign.entries()]) {
      if (!keep.has(id)) {
        el.pause();
        this.assign.delete(id);
      }
    }
    for (const clip of active) {
      let el = this.assign.get(clip.id);
      if (!el) {
        el = this.pool.find((v) => ![...this.assign.values()].includes(v));
        if (!el) continue;
        const rec = await this.cacheMedia(clip.mediaId);
        if (!rec) continue;
        const url = this.urls.get(clip.mediaId);
        if (el.src !== url) {
          el.src = url;
          await wait(el, "loadeddata").catch(() => {});
        }
        this.assign.set(clip.id, el);
      }
      const want = this.sourceTime(clip, t);
      if (Number.isFinite(want) && Math.abs((el.currentTime || 0) - want) > 0.12) {
        try {
          el.currentTime = Math.max(0, want);
        } catch {}
      }
      el.playbackRate = Math.min(16, Math.max(0.25, clip.speed || 1));
      el.muted = false;
      if (this.audioCtx) {
        if (!el._taktSrc) {
          try {
            el._taktSrc = this.audioCtx.createMediaElementSource(el);
            el._taktGain = this.audioCtx.createGain();
            el._taktSrc.connect(el._taktGain);
            el._taktGain.connect(this.clipGain);
          } catch {}
        }
        if (el._taktGain) el._taktGain.gain.value = clip.muted ? 0 : clip.volume ?? 1;
      }
      if (this.store.playing && el.paused) el.play().catch(() => {});
      if (!this.store.playing && !el.paused) el.pause();
    }
  }

  coverDraw(srcW, srcH, dx, dy, dw, dh) {
    const ir = srcW / srcH;
    const or = dw / dh;
    let sw = srcW, sh = srcH, sx = 0, sy = 0;
    if (ir > or) {
      sw = srcH * or;
      sx = (srcW - sw) / 2;
    } else {
      sh = srcW / or;
      sy = (srcH - sh) / 2;
    }
    this.ctx.drawImage(srcW ? arguments[6] : null, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  drawMedia(clip, alpha, t) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const tr = clip.transform || { x: 0, y: 0, scale: 1, rotate: 0 };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = cssFilter(clip);
    ctx.translate(W / 2 + tr.x * W, H / 2 + tr.y * H);
    ctx.rotate(((tr.rotate || 0) * Math.PI) / 180);
    ctx.scale((tr.flipH ? -1 : 1) * (tr.scale || 1), (tr.flipV ? -1 : 1) * (tr.scale || 1));
    ctx.translate(-W / 2, -H / 2);

    if (clip.type === "video") {
      const el = this.assign.get(clip.id);
      if (el && el.readyState >= 2) {
        const ir = el.videoWidth / el.videoHeight || 16 / 9;
        const or = W / H;
        let dw = W, dh = H, dx = 0, dy = 0;
        if (ir > or) {
          dh = W / ir;
          dy = (H - dh) / 2;
        } else {
          dw = H * ir;
          dx = (W - dw) / 2;
        }
        ctx.drawImage(el, dx, dy, dw, dh);
      }
    } else {
      const img = this.images.get(clip.mediaId);
      if (img && img.naturalWidth) {
        const ken = 1 + 0.06 * ((t - clip.start) / clipLen(clip));
        const ir = img.naturalWidth / img.naturalHeight;
        const or = W / H;
        let dw = W * ken, dh = H * ken, dx = (W - dw) / 2, dy = (H - dh) / 2;
        if (ir > or) {
          dh = dw / ir;
          dy = (H - dh) / 2;
        } else {
          dw = dh * ir;
          dx = (W - dw) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    }
    ctx.restore();

    const a = clip.adjust || {};
    if (a.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, a.vignette / 100)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (a.fade) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, a.fade / 180)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (a.grain) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.28, a.grain / 250);
      ctx.fillStyle = "#888";
      for (let i = 0; i < 80; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2);
      }
      ctx.restore();
    }
  }

  drawOverlays(t) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    for (const o of this.store.project.overlays) {
      if (t < o.start || t >= o.start + o.duration) continue;
      const x = o.x * W;
      const y = o.y * H;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((o.rotate || 0) * Math.PI) / 180);
      ctx.scale(o.scale || 1, o.scale || 1);
      if (o.type === "sticker") {
        ctx.font = `${Math.round(W * 0.12)}px "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.emoji || "★", 0, 0);
      } else {
        this.drawText(o, W);
      }
      ctx.restore();
    }
  }

  drawText(o, W) {
    const ctx = this.ctx;
    const size = Math.round(W * 0.062);
    const text = o.text || "";
    const style = o.style || "classic";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size}px ${style === "poster" ? "Syne, Impact, sans-serif" : "Manrope, sans-serif"}`;
    if (style === "outline") {
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#fff";
      ctx.strokeText(text, 0, 0);
      ctx.fillText(text, 0, 0);
    } else if (style === "box") {
      const m = ctx.measureText(text);
      const pad = size * 0.28;
      ctx.fillStyle = "#fff";
      ctx.fillRect(-m.width / 2 - pad, -size * 0.7, m.width + pad * 2, size * 1.3);
      ctx.fillStyle = "#111";
      ctx.fillText(text, 0, 0);
    } else if (style === "neon") {
      ctx.shadowColor = "#3dffc4";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ecfff8";
      ctx.fillText(text, 0, 0);
    } else if (style === "karaoke") {
      const m = ctx.measureText(text);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-m.width / 2 - 12, -size * 0.7, m.width + 24, size * 1.3);
      ctx.fillStyle = "#3dffc4";
      ctx.fillText(text, 0, 0);
    } else if (style === "poster") {
      ctx.lineWidth = size * 0.1;
      ctx.strokeStyle = "#ff2d6a";
      ctx.fillStyle = "#fff";
      ctx.strokeText(text.toUpperCase(), 0, 0);
      ctx.fillText(text.toUpperCase(), 0, 0);
    } else if (style === "typewriter") {
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${size}px ui-monospace, monospace`;
      ctx.fillText(text, 0, 0);
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 0, 0);
    }
  }

  transitionAlpha(clip, t) {
    const tr = clip.transitionIn || { type: "none", duration: 0 };
    if (!tr.type || tr.type === "none") return { a: 1, mode: "cut" };
    const d = Math.max(0.01, tr.duration || 0.3);
    const u = Math.max(0, Math.min(1, (t - clip.start) / d));
    return { a: u, mode: tr.type, u };
  }

  draw(t) {
    if (!this.canvas || !this.store.project) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.store.project.bg || "#000";
    ctx.fillRect(0, 0, W, H);
    const clips = this.clipsAt(t).sort((a, b) => a.start - b.start);
    if (!clips.length) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.font = `600 ${Math.round(W * 0.045)}px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add clips to start", W / 2, H / 2);
    } else if (clips.length === 1) {
      const tr = this.transitionAlpha(clips[0], t);
      this.drawMedia(clips[0], 1, t);
      if (tr.mode === "flash" && tr.u < 1) {
        ctx.fillStyle = `rgba(255,255,255,${1 - tr.u})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      const top = clips[clips.length - 1];
      const under = clips[clips.length - 2];
      const tr = this.transitionAlpha(top, t);
      if (tr.mode === "fade" || tr.mode === "dissolve") {
        this.drawMedia(under, 1, t);
        this.drawMedia(top, tr.a, t);
      } else if (tr.mode === "flash") {
        this.drawMedia(tr.u < 0.5 ? under : top, 1, t);
        ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(tr.u * 2 - 1)})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        this.drawMedia(top, 1, t);
      }
    }
    this.drawOverlays(t);
    if (this.onFrame) this.onFrame(t);
  }

  async tick() {
    const t = this.now();
    if (this.store.playing) this.store.time = t;
    await this.syncVideos(t);
    this.draw(t);
    if (this.store.playing || this.exporting) this.raf = requestAnimationFrame(() => this.tick());
  }

  stopAudio() {
    for (const n of this.liveNodes) {
      try {
        n.stop?.();
      } catch {}
      try {
        n.disconnect?.();
      } catch {}
    }
    this.liveNodes = [];
  }

  async startAudio(from) {
    await this.unlock();
    this.stopAudio();
    const p = this.store.project;
    const ctx = this.audioCtx;
    this.clipGain.gain.value = 1;

    for (const item of p.music) {
      if (from >= item.start + item.duration || from < item.start && false) {
        /* continue below */
      }
      if (from >= item.start + item.duration) continue;
      const when = ctx.currentTime + Math.max(0, item.start - from);
      const offset = Math.max(0, from - item.start) + (item.inPoint || 0);
      const remain = item.duration - Math.max(0, from - item.start);
      if (remain <= 0.02) continue;

      const buf = await this.bufferForMusic(item);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !!item.loop || (item.trackId && remain > buf.duration - 0.05);
      const g = ctx.createGain();
      g.gain.value = item.volume ?? 0.85;
      const fadeIn = item.fadeIn || 0;
      const fadeOut = item.fadeOut || 0;
      const startG = when;
      g.gain.setValueAtTime(fadeIn ? 0.0001 : g.gain.value, startG);
      if (fadeIn) g.gain.linearRampToValueAtTime(item.volume ?? 0.85, startG + fadeIn);
      src.connect(g);
      g.connect(this.musicGain);
      try {
        src.start(when, Math.min(offset, Math.max(0, buf.duration - 0.01)), remain);
      } catch {
        src.start(when);
      }
      this.liveNodes.push(src, g);
    }

    for (const item of p.voice) {
      if (from >= item.start + item.duration) continue;
      const when = ctx.currentTime + Math.max(0, item.start - from);
      const offset = Math.max(0, from - item.start) + (item.inPoint || 0);
      const remain = item.duration - Math.max(0, from - item.start);
      const buf = await this.bufferForMusic(item);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = item.volume ?? 1;
      src.connect(g);
      g.connect(this.voiceGain);
      try {
        src.start(when, Math.min(offset, Math.max(0, buf.duration - 0.01)), remain);
      } catch {
        src.start(when);
      }
      this.liveNodes.push(src, g);
    }

    const duck = p.duckOriginal ?? 0.22;
    const hasMusic = p.music.some((m) => from < m.start + m.duration && from + 0.05 > m.start - 99);
    this.clipGain.gain.value = p.music.length && hasMusic ? duck : 1;
  }

  async play() {
    if (!this.store.project) return;
    await this.ensureClipMedia();
    await this.unlock();
    const d = projectDuration(this.store.project);
    if (this.store.time >= d - 0.05) this.store.time = 0;
    this.originTime = this.store.time;
    this.originPerf = performance.now();
    this.store.playing = true;
    this.store.emit("play");
    await this.startAudio(this.store.time);
    cancelAnimationFrame(this.raf);
    this.tick();
  }

  pause() {
    this.store.time = this.now();
    this.store.playing = false;
    this.stopAudio();
    for (const el of this.pool) el.pause();
    this.store.emit("pause");
    this.draw(this.store.time);
  }

  toggle() {
    if (this.store.playing) this.pause();
    else this.play();
  }

  async seek(t) {
    const playing = this.store.playing;
    if (playing) this.pause();
    this.store.setTime(t);
    await this.syncVideos(this.store.time);
    this.draw(this.store.time);
    if (playing) this.play();
  }

  async analyzeMusicBeats() {
    const item = this.store.project.music[0];
    if (!item) {
      this.store.beats = [];
      return [];
    }
    if (item.trackId) {
      const track = getTrack(item.trackId);
      const beats = trackBeats(track).map((b) => b + item.start - (item.inPoint || 0));
      this.store.beats = beats.filter((b) => b >= item.start && b <= item.start + item.duration);
      return this.store.beats;
    }
    const buf = await this.bufferForMusic(item);
    if (!buf) return [];
    const beats = detectBeats(buf).map((b) => b + item.start - (item.inPoint || 0));
    this.store.beats = beats.filter((b) => b >= 0);
    return this.store.beats;
  }

  pickMime() {
    const types = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const t of types) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "video/webm";
  }

  async export({ quality = 720, onProgress } = {}) {
    const p = this.store.project;
    const [bw, bh] = RATIOS[p.ratio] || RATIOS["9:16"];
    const scale = quality >= 1080 ? 1 : quality / Math.max(bw, bh);
    const w = Math.round(bw * scale) & ~1;
    const h = Math.round(bh * scale) & ~1;
    const was = this.store.playing;
    if (was) this.pause();

    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.exporting = true;

    await this.ensureClipMedia();
    await this.unlock();
    await this.seek(0);

    const fps = p.fps || 30;
    const duration = projectDuration(p);
    const dest = this.audioCtx.createMediaStreamDestination();
    this.master.connect(dest);

    const vstream = this.canvas.captureStream(fps);
    const mixed = new MediaStream([
      ...vstream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    const mime = this.pickMime();
    const rec = new MediaRecorder(mixed, {
      mimeType: mime,
      videoBitsPerSecond: quality >= 1080 ? 10_000_000 : 6_000_000,
      audioBitsPerSecond: 192000,
    });
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const done = new Promise((res) => {
      rec.onstop = () => res(new Blob(chunks, { type: mime.includes("mp4") ? "video/mp4" : "video/webm" }));
    });
    rec.start(200);
    await this.play();
    const start = performance.now();
    await new Promise((resolve) => {
      const check = () => {
        const t = this.now();
        if (onProgress) onProgress(Math.min(1, t / duration));
        if (!this.store.playing || t >= duration - 0.03 || performance.now() - start > duration * 1000 + 4000) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
    this.pause();
    await new Promise((r) => setTimeout(r, 180));
    rec.stop();
    const blob = await done;
    try {
      this.master.disconnect(dest);
    } catch {}
    this.exporting = false;
    this.canvas.width = prevW;
    this.canvas.height = prevH;
    this.resize();
    this.draw(this.store.time);
    if (onProgress) onProgress(1);
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    return { blob, ext, mime: blob.type };
  }
}

export async function importMediaFile(db, file) {
  if (file.type.startsWith("audio/")) {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = url;
    await Promise.race([wait(audio, "loadedmetadata"), new Promise((r) => setTimeout(r, 4000))]);
    const rec = {
      id: "media_" + Math.random().toString(36).slice(2, 10),
      type: "audio",
      name: file.name,
      blob: file,
      duration: audio.duration || 8,
    };
    URL.revokeObjectURL(url);
    await db.putMedia(rec);
    return rec;
  }
  if (file.type.startsWith("image/")) {
    const rec = {
      id: "media_" + Math.random().toString(36).slice(2, 10),
      type: "image",
      name: file.name,
      blob: file,
      duration: 3,
      width: 0,
      height: 0,
      thumb: "",
    };
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {});
    rec.width = img.naturalWidth;
    rec.height = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 320;
    const cx = c.getContext("2d");
    cx.fillRect(0, 0, 180, 320);
    const ir = img.naturalWidth / img.naturalHeight || 1;
    let dw = 180, dh = 180 / ir, dx = 0, dy = (320 - dh) / 2;
    if (dh < 320) {
      dh = 320;
      dw = 320 * ir;
      dx = (180 - dw) / 2;
      dy = 0;
    }
    cx.drawImage(img, dx, dy, dw, dh);
    rec.thumb = c.toDataURL("image/jpeg", 0.7);
    URL.revokeObjectURL(url);
    await db.putMedia(rec);
    return rec;
  }
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.src = url;
  await Promise.race([wait(v, "loadedmetadata"), new Promise((r) => setTimeout(r, 8000))]);
  const rec = {
    id: "media_" + Math.random().toString(36).slice(2, 10),
    type: "video",
    name: file.name,
    blob: file,
    duration: v.duration || 1,
    width: v.videoWidth,
    height: v.videoHeight,
    thumb: "",
  };
  try {
    v.currentTime = Math.min(0.2, (v.duration || 1) * 0.1);
    await Promise.race([wait(v, "seeked"), new Promise((r) => setTimeout(r, 1500))]);
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 320;
    const cx = c.getContext("2d");
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, 180, 320);
    cx.drawImage(v, 0, 0, 180, 320);
    rec.thumb = c.toDataURL("image/jpeg", 0.7);
  } catch {}
  URL.revokeObjectURL(url);
  await db.putMedia(rec);
  return rec;
}

export function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

export { FILTERS };
