export const RATIOS = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
  "4:5": [1080, 1350],
  "4:3": [1440, 1080],
  "3:4": [1080, 1440],
};

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clipLen(c) {
  return Math.max(0.05, (c.outPoint - c.inPoint) / (c.speed || 1));
}

export function clipEnd(c) {
  return c.start + clipLen(c);
}

export function projectDuration(p) {
  let m = 0;
  for (const c of p.clips) m = Math.max(m, clipEnd(c));
  for (const a of p.music) m = Math.max(m, a.start + a.duration);
  for (const a of p.voice) m = Math.max(m, a.start + a.duration);
  for (const o of p.overlays) m = Math.max(m, o.start + o.duration);
  return Math.max(m, 1);
}

export function newProject(name = "Untitled") {
  return {
    id: uid("p_"),
    name,
    created: Date.now(),
    updated: Date.now(),
    ratio: "9:16",
    fps: 30,
    clips: [],
    music: [],
    voice: [],
    overlays: [],
    duckOriginal: 0.22,
    snapBeats: true,
    bg: "#000000",
  };
}

export function newClip(media, start, extra = {}) {
  const dur = media.duration || 3;
  return {
    id: uid("c_"),
    mediaId: media.id,
    type: media.type,
    name: media.name || "Clip",
    start,
    inPoint: 0,
    outPoint: dur,
    speed: 1,
    volume: 1,
    muted: media.type === "image",
    reverse: false,
    transform: { x: 0, y: 0, scale: 1, rotate: 0, flipH: false, flipV: false },
    filter: "none",
    adjust: { brightness: 0, contrast: 0, saturate: 0, warmth: 0, vignette: 0, fade: 0, grain: 0 },
    transitionIn: { type: "none", duration: 0.35 },
    ...extra,
  };
}

export function newAudioItem(kind, start, duration, extra = {}) {
  return {
    id: uid(kind === "music" ? "m_" : "v_"),
    kind,
    start,
    duration,
    inPoint: 0,
    volume: kind === "music" ? 0.85 : 1,
    fadeIn: 0.05,
    fadeOut: 0.2,
    loop: false,
    ...extra,
  };
}

export function newOverlay(start, extra = {}) {
  return {
    id: uid("o_"),
    type: extra.type || "text",
    start,
    duration: 3,
    text: extra.text || "Your text",
    emoji: extra.emoji || "",
    x: 0.5,
    y: extra.type === "sticker" ? 0.42 : 0.78,
    scale: extra.type === "sticker" ? 1.4 : 1,
    rotate: 0,
    style: extra.style || "classic",
    ...extra,
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export class Store {
  constructor() {
    this.project = null;
    this.time = 0;
    this.playing = false;
    this.pxPerSec = 64;
    this.tool = null;
    this.selected = { clips: [], music: [], voice: [], overlays: [] };
    this.beats = [];
    this.history = [];
    this.future = [];
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(why = "change") {
    for (const fn of this.listeners) fn(why, this);
  }

  load(project) {
    this.project = project;
    this.time = 0;
    this.playing = false;
    this.selected = { clips: [], music: [], voice: [], overlays: [] };
    this.history = [];
    this.future = [];
    this.beats = [];
    this.emit("load");
  }

  snapshot() {
    if (!this.project) return;
    this.history.push(clone(this.project));
    if (this.history.length > 60) this.history.shift();
    this.future = [];
  }

  undo() {
    if (!this.history.length) return;
    this.future.push(clone(this.project));
    this.project = this.history.pop();
    this.clearSel();
    this.emit("undo");
  }

  redo() {
    if (!this.future.length) return;
    this.history.push(clone(this.project));
    this.project = this.future.pop();
    this.clearSel();
    this.emit("redo");
  }

  clearSel() {
    this.selected = { clips: [], music: [], voice: [], overlays: [] };
  }

  select(kind, id, additive = false) {
    if (!additive) this.clearSel();
    const arr = this.selected[kind];
    if (!arr) return;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    this.emit("select");
  }

  selectedClip() {
    const id = this.selected.clips[0];
    return this.project?.clips.find((c) => c.id === id) || null;
  }

  selectedAudio() {
    const mid = this.selected.music[0];
    if (mid) return this.project.music.find((a) => a.id === mid) || null;
    const vid = this.selected.voice[0];
    if (vid) return this.project.voice.find((a) => a.id === vid) || null;
    return null;
  }

  selectedOverlay() {
    const id = this.selected.overlays[0];
    return this.project?.overlays.find((o) => o.id === id) || null;
  }

  setTime(t) {
    const d = this.project ? projectDuration(this.project) : 1;
    this.time = Math.max(0, Math.min(d, t));
    this.emit("time");
  }
}
