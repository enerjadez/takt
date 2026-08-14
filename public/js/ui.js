import {
  RATIOS,
  clipEnd,
  clipLen,
  newAudioItem,
  newClip,
  newOverlay,
  newProject,
  projectDuration,
} from "./store.js";
import { FILTER_IDS, downloadBlob, importMediaFile } from "./engine.js";
import { GENRES, SFX, TRACKS, getTrack, trackDuration } from "./library.js";

const TEXT_STYLES = ["classic", "outline", "box", "neon", "karaoke", "poster", "typewriter"];
const TRANS = ["none", "fade", "flash", "dissolve"];
const SPEEDS = [0.3, 0.5, 0.8, 1, 1.5, 2, 3];
const EMOJI = ["🔥","😂","😍","✨","💀","😭","💯","❤️","👀","🙌","😎","🎵","⚡","🌙","☀️","💧","🖤","🤍","👑","💥","🎧","🕺","💃","⭐","✅","🤯","🫠","🫧","🎀","🎬","📸","🚀"];

function $(sel, root = document) {
  return root.querySelector(sel);
}
function fmt(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${f}`;
}
function ago(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return new Date(ts).toLocaleDateString();
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export class UI {
  constructor({ root, store, db, engine }) {
    this.root = root;
    this.store = store;
    this.db = db;
    this.engine = engine;
    this.sheet = null;
    this.genre = "For you";
    this.soundQ = "";
    this.previewId = null;
    this.previewStop = null;
    this.recents = [];
    this.userSounds = [];
    this.store.on((why) => {
      if (!this.root.querySelector(".editor")) return;
      if (why === "time" || why === "play" || why === "pause") this.syncTransport();
      if (why !== "time") this.renderTimeline();
      else this.syncPlayhead();
    });
  }

  async showHome() {
    this.recents = await this.db.listProjects();
    this.root.innerHTML = `
      <div class="home">
        <div class="home-top">
          <div class="brand">
            <img src="/icons/icon-512.jpg" alt="" />
            <div>
              <h1>TAKT</h1>
              <p>Cut to the music. Local. Yours.</p>
            </div>
          </div>
        </div>
        <div class="home-actions">
          <button class="hero-card" id="new-project">
            <div class="kicker">New</div>
            <h2>Start a project</h2>
          </button>
          <button class="action-card" id="import-clips">
            <div class="kicker">Clips</div>
            <h2>Add videos</h2>
          </button>
          <button class="action-card mint" id="open-sounds">
            <div class="kicker">Sounds</div>
            <h2>Browse music</h2>
          </button>
        </div>
        <div class="section-h"><h3>Drafts</h3><span style="color:var(--muted);font-size:12px">${this.recents.length} saved on this device</span></div>
        <div class="recents" id="recents"></div>
      </div>`;
    $("#new-project").onclick = () => this.startNew(false);
    $("#import-clips").onclick = () => this.startNew(true);
    $("#open-sounds").onclick = async () => {
      await this.startNew(false);
      this.openSheet("sounds");
    };
    const box = $("#recents");
    if (!this.recents.length) {
      box.innerHTML = `<div class="empty-recents">Nothing yet. Start a project and it lives on this tablet — drafts stay in the browser.</div>`;
      return;
    }
    for (const p of this.recents) {
      const b = document.createElement("button");
      b.className = "recent";
      b.innerHTML = `
        <div class="thumb ${p.thumb ? "" : "empty"}" style="${p.thumb ? `background-image:url(${p.thumb})` : ""}">${p.thumb ? "" : "▶"}</div>
        <div class="meta"><b>${p.name || "Untitled"}</b><span>${ago(p.updated)} · ${p.ratio || "9:16"}</span></div>`;
      b.onclick = () => this.openProject(p);
      b.oncontextmenu = (e) => {
        e.preventDefault();
        if (confirm("Delete this draft?")) this.deleteProject(p.id);
      };
      box.appendChild(b);
    }
  }

  async deleteProject(id) {
    await this.db.deleteProject(id);
    this.showHome();
  }

  async startNew(pickFiles) {
    const p = newProject("Reel " + new Date().toLocaleDateString());
    this.store.load(p);
    this.showEditor();
    if (pickFiles) this.pickClips();
  }

  async openProject(row) {
    this.store.load(row.data);
    this.store.project.id = row.id;
    this.store.project.name = row.name;
    this.showEditor();
    await this.engine.ensureClipMedia();
    await this.engine.syncVideos(0);
    this.engine.draw(0);
    this.engine.analyzeMusicBeats().then(() => this.renderTimeline());
  }

  showEditor() {
    this.root.innerHTML = `
      <div class="editor">
        <div class="topbar">
          <button class="icon-btn ghost" id="back">←</button>
          <input class="name" id="proj-name" value="${this.esc(this.store.project.name)}" />
          <button class="icon-btn" id="undo">Undo</button>
          <button class="icon-btn" id="redo">Redo</button>
          <button class="text-btn accent" id="export">Export</button>
        </div>
        <div class="workspace">
          <div class="stage-wrap">
            <div class="stage" id="stage">
              <canvas id="stage-c"></canvas>
              <div class="stage-hud" id="hud">9:16</div>
            </div>
          </div>
        </div>
        <div class="side">
          <div class="transport">
            <button class="play-btn" id="play">▶</button>
            <div class="time-read" id="time-read">0:00.0 / 0:01.0</div>
            <div class="grow"></div>
            <button class="text-btn" id="split">Split</button>
            <button class="text-btn" id="dup">Copy</button>
            <button class="text-btn" id="del">Delete</button>
          </div>
          <div class="dock" id="dock"></div>
        </div>
        <div class="timeline" id="timeline">
          <div class="tl-scroll" id="tl-scroll">
            <div class="tl-inner" id="tl-inner">
              <div class="tl-ruler" id="tl-ruler"></div>
              <div class="tl-beats" id="tl-beats"></div>
              <div class="tl-track" data-label="VIDEO"></div>
              <div class="tl-track" data-label="TEXT"></div>
              <div class="tl-track" data-label="SOUND"></div>
              <div class="tl-playhead" id="tl-playhead"></div>
            </div>
          </div>
        </div>
      </div>`;
    this.engine.attach($("#stage"), $("#stage-c"));
    $("#back").onclick = () => {
      this.saveDraft();
      this.showHome();
    };
    $("#proj-name").onchange = (e) => {
      this.store.project.name = e.target.value.trim() || "Untitled";
      this.saveDraft();
    };
    $("#undo").onclick = () => this.store.undo();
    $("#redo").onclick = () => this.store.redo();
    $("#export").onclick = () => this.openSheet("export");
    $("#play").onclick = () => this.engine.toggle();
    $("#split").onclick = () => this.split();
    $("#dup").onclick = () => this.duplicate();
    $("#del").onclick = () => this.removeSelected();
    this.buildDock();
    this.bindTimeline();
    this.renderTimeline();
    this.syncTransport();
    this.engine.resize();
    window.onresize = () => this.engine.resize();
    this.saveDraft();
  }

  buildDock() {
    const items = [
      ["clips", "＋", "Clips"],
      ["sounds", "♪", "Sounds"],
      ["text", "Aa", "Text"],
      ["stickers", "★", "Stickers"],
      ["filters", "◎", "Filters"],
      ["adjust", "◐", "Adjust"],
      ["speed", "⏩", "Speed"],
      ["trans", "⧉", "Trans"],
      ["voice", "🎙", "Voice"],
      ["canvas", "▢", "Canvas"],
      ["beats", "▮", "Beats"],
      ["camera", "◉", "Camera"],
    ];
    const dock = $("#dock");
    dock.innerHTML = items
      .map(
        ([id, ic, label]) =>
          `<button class="dock-item" data-id="${id}"><span class="ic">${ic}</span>${label}</button>`
      )
      .join("");
    dock.onclick = (e) => {
      const b = e.target.closest(".dock-item");
      if (!b) return;
      this.onDock(b.dataset.id);
    };
  }

  onDock(id) {
    if (id === "clips") return this.pickClips();
    if (id === "camera") return this.recordCamera();
    if (id === "voice") return this.recordVoice();
    if (id === "beats") return this.autoCut();
    this.openSheet(id);
  }

  esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  bindTimeline() {
    const scroll = $("#tl-scroll");
    const inner = $("#tl-inner");
    let dragging = null;
    inner.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".handle");
      const clip = e.target.closest(".tl-clip");
      if (handle && clip) {
        dragging = {
          kind: "trim",
          side: handle.classList.contains("l") ? "l" : "r",
          id: clip.dataset.id,
          track: clip.dataset.track,
          x: e.clientX,
        };
        this.store.snapshot();
        e.preventDefault();
        return;
      }
      if (clip) {
        dragging = { kind: "move", id: clip.dataset.id, track: clip.dataset.track, x: e.clientX, start: 0 };
        const item = this.findItem(clip.dataset.track, clip.dataset.id);
        dragging.start = item?.start || 0;
        this.store.select(clip.dataset.track === "video" ? "clips" : clip.dataset.track, clip.dataset.id);
        this.store.snapshot();
        e.preventDefault();
        return;
      }
      const rect = inner.getBoundingClientRect();
      const x = e.clientX - rect.left + scroll.scrollLeft;
      this.engine.seek(x / this.store.pxPerSec);
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = (e.clientX - dragging.x) / this.store.pxPerSec;
      const item = this.findItem(dragging.track, dragging.id);
      if (!item) return;
      if (dragging.kind === "move") {
        item.start = Math.max(0, dragging.start + dx);
      } else if (dragging.track === "video") {
        if (dragging.side === "l") {
          const nextIn = Math.min(item.outPoint - 0.08, Math.max(0, item.inPoint + dx * (item.speed || 1)));
          const delta = (nextIn - item.inPoint) / (item.speed || 1);
          item.inPoint = nextIn;
          item.start += delta;
        } else {
          item.outPoint = Math.max(item.inPoint + 0.08, item.outPoint + dx * (item.speed || 1));
          const rec = this.engine.media.get(item.mediaId);
          if (rec?.duration) item.outPoint = Math.min(rec.duration, item.outPoint);
        }
      } else {
        if (dragging.side === "l") {
          item.duration = Math.max(0.2, item.duration - dx);
          item.start = Math.max(0, item.start + dx);
        } else item.duration = Math.max(0.2, item.duration + dx);
      }
      this.renderTimeline();
      this.engine.draw(this.store.time);
    });
    window.addEventListener("pointerup", () => {
      if (dragging) {
        dragging = null;
        this.saveDraft();
        this.engine.analyzeMusicBeats();
      }
    });
    scroll.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && Math.abs(e.deltaY) < 8) return;
        e.preventDefault();
        const next = Math.max(28, Math.min(180, this.store.pxPerSec * (e.deltaY > 0 ? 0.9 : 1.1)));
        this.store.pxPerSec = next;
        this.renderTimeline();
      },
      { passive: false }
    );
  }

  findItem(track, id) {
    const p = this.store.project;
    if (track === "video") return p.clips.find((c) => c.id === id);
    if (track === "overlays") return p.overlays.find((c) => c.id === id);
    if (track === "music") return p.music.find((c) => c.id === id) || p.voice.find((c) => c.id === id);
    return null;
  }

  renderTimeline() {
    const inner = $("#tl-inner");
    if (!inner || !this.store.project) return;
    const dur = Math.max(8, projectDuration(this.store.project) + 4);
    const w = dur * this.store.pxPerSec;
    inner.style.width = w + "px";
    const ruler = $("#tl-ruler");
    ruler.innerHTML = "";
    for (let s = 0; s <= dur; s++) {
      const tick = document.createElement("div");
      tick.className = "tl-tick";
      tick.style.left = s * this.store.pxPerSec + "px";
      tick.textContent = fmt(s).slice(0, 4);
      ruler.appendChild(tick);
    }
    const beats = $("#tl-beats");
    beats.innerHTML = "";
    for (const b of this.store.beats) {
      const el = document.createElement("div");
      el.className = "tl-beat";
      el.style.left = b * this.store.pxPerSec + "px";
      beats.appendChild(el);
    }
    const tracks = inner.querySelectorAll(".tl-track");
    const videoT = tracks[0];
    const textT = tracks[1];
    const soundT = tracks[2];
    videoT.innerHTML = "";
    textT.innerHTML = "";
    soundT.innerHTML = "";
    for (const c of this.store.project.clips) {
      videoT.appendChild(this.clipEl("video", c.id, c.start, clipLen(c), c.name || "Clip", c.type, this.store.selected.clips.includes(c.id)));
    }
    for (const o of this.store.project.overlays) {
      textT.appendChild(
        this.clipEl("overlays", o.id, o.start, o.duration, o.type === "sticker" ? o.emoji || "★" : o.text || "Text", "overlay", this.store.selected.overlays.includes(o.id))
      );
    }
    for (const a of this.store.project.music) {
      soundT.appendChild(this.clipEl("music", a.id, a.start, a.duration, a.title || "Sound", "music", this.store.selected.music.includes(a.id)));
    }
    for (const a of this.store.project.voice) {
      soundT.appendChild(this.clipEl("music", a.id, a.start, a.duration, a.title || "Voice", "voice", this.store.selected.voice.includes(a.id)));
    }
    this.syncPlayhead();
    $("#hud").textContent = `${this.store.project.ratio} · ${fmt(this.store.time)}`;
  }

  clipEl(track, id, start, len, label, kind, selected) {
    const el = document.createElement("div");
    el.className = `tl-clip ${kind}${selected ? " selected" : ""}`;
    el.dataset.id = id;
    el.dataset.track = track;
    el.style.left = start * this.store.pxPerSec + "px";
    el.style.width = Math.max(18, len * this.store.pxPerSec) + "px";
    el.innerHTML = `<i class="handle l"></i><span>${this.esc(label)}</span><i class="handle r"></i>`;
    return el;
  }

  syncPlayhead() {
    const head = $("#tl-playhead");
    if (!head) return;
    head.style.left = this.store.time * this.store.pxPerSec + "px";
    const scroll = $("#tl-scroll");
    if (this.store.playing && scroll) {
      const x = this.store.time * this.store.pxPerSec;
      if (x > scroll.scrollLeft + scroll.clientWidth - 80) scroll.scrollLeft = x - 80;
    }
  }

  syncTransport() {
    const play = $("#play");
    const read = $("#time-read");
    if (!play) return;
    play.textContent = this.store.playing ? "❚❚" : "▶";
    read.textContent = `${fmt(this.store.time)} / ${fmt(projectDuration(this.store.project))}`;
    $("#hud").textContent = `${this.store.project.ratio} · ${fmt(this.store.time)}`;
  }

  pickClips() {
    const input = document.getElementById("file-clips");
    input.value = "";
    input.onchange = async () => {
      const files = [...input.files];
      if (!files.length) return;
      this.store.snapshot();
      let t = this.store.project.clips.length ? Math.max(...this.store.project.clips.map(clipEnd)) : 0;
      for (const f of files) {
        const rec = await importMediaFile(this.db, f);
        const clip = newClip(rec, t);
        this.store.project.clips.push(clip);
        t = clipEnd(clip);
      }
      this.store.emit("clips");
      await this.engine.ensureClipMedia();
      this.engine.draw(this.store.time);
      this.saveDraft(true);
      toast(files.length + " clip" + (files.length > 1 ? "s" : "") + " added");
    };
    input.click();
  }

  pickAudio() {
    const input = document.getElementById("file-audio");
    input.value = "";
    input.onchange = async () => {
      for (const f of [...input.files]) {
        const rec = await importMediaFile(this.db, f);
        this.userSounds.push(rec);
        this.addMusic({ mediaId: rec.id, title: rec.name, duration: rec.duration });
      }
      this.closeSheet();
    };
    input.click();
  }

  addMusic({ trackId, mediaId, sfxId, title, duration }) {
    this.store.snapshot();
    const start = 0;
    let dur = duration;
    if (trackId) dur = Math.max(trackDuration(getTrack(trackId)), projectDuration(this.store.project));
    const item = newAudioItem("music", start, dur || 8, { trackId, mediaId, sfxId, title: title || "Sound" });
    if (!sfxId) this.store.project.music = this.store.project.music.filter((m) => m.sfxId);
    this.store.project.music.push(item);
    if (trackId) this.engine.bufferForMusic(item).catch(() => {});
    this.store.emit("music");
    this.engine.analyzeMusicBeats().then(() => this.renderTimeline());
    this.saveDraft();
    toast("Sound on the timeline");
  }

  split() {
    const c = this.store.selectedClip();
    const t = this.store.time;
    if (!c || t <= c.start + 0.05 || t >= clipEnd(c) - 0.05) {
      toast("Park the playhead on a clip");
      return;
    }
    this.store.snapshot();
    const local = this.engine.sourceTime(c, t);
    const right = JSON.parse(JSON.stringify(c));
    right.id = "c_" + Math.random().toString(36).slice(2, 9);
    if (c.reverse) {
      c.inPoint = local;
    } else {
      c.outPoint = local;
    }
    right.start = t;
    if (c.reverse) right.outPoint = local;
    else right.inPoint = local;
    right.transitionIn = { type: "none", duration: 0.25 };
    const i = this.store.project.clips.indexOf(c);
    this.store.project.clips.splice(i + 1, 0, right);
    this.store.emit("split");
    this.saveDraft();
  }

  duplicate() {
    const c = this.store.selectedClip();
    if (!c) return toast("Select a clip");
    this.store.snapshot();
    const copy = JSON.parse(JSON.stringify(c));
    copy.id = "c_" + Math.random().toString(36).slice(2, 9);
    copy.start = clipEnd(c);
    this.store.project.clips.push(copy);
    this.store.emit("dup");
    this.saveDraft();
  }

  removeSelected() {
    const p = this.store.project;
    this.store.snapshot();
    p.clips = p.clips.filter((c) => !this.store.selected.clips.includes(c.id));
    p.music = p.music.filter((c) => !this.store.selected.music.includes(c.id));
    p.voice = p.voice.filter((c) => !this.store.selected.voice.includes(c.id));
    p.overlays = p.overlays.filter((c) => !this.store.selected.overlays.includes(c.id));
    this.store.clearSel();
    this.store.emit("del");
    this.saveDraft();
  }

  async autoCut() {
    const c = this.store.selectedClip() || this.store.project.clips[0];
    if (!c) return toast("Add a clip first");
    if (!this.store.project.music.length) return toast("Add a sound first");
    await this.engine.unlock();
    const beats = await this.engine.analyzeMusicBeats();
    const hits = beats.filter((b) => b > c.start + 0.12 && b < clipEnd(c) - 0.12);
    if (!hits.length) return toast("No beats in this clip");
    this.store.snapshot();
    let cur = c;
    for (const b of hits) {
      if (b <= cur.start + 0.08 || b >= clipEnd(cur) - 0.08) continue;
      const local = this.engine.sourceTime(cur, b);
      const right = JSON.parse(JSON.stringify(cur));
      right.id = "c_" + Math.random().toString(36).slice(2, 9);
      cur.outPoint = local;
      right.inPoint = local;
      right.start = b;
      right.transitionIn = { type: "flash", duration: 0.12 };
      const i = this.store.project.clips.indexOf(cur);
      this.store.project.clips.splice(i + 1, 0, right);
      cur = right;
    }
    this.store.emit("beats");
    this.saveDraft();
    toast("Cut to " + hits.length + " beats");
  }

  openSheet(kind) {
    this.closeSheet();
    const back = document.createElement("div");
    back.className = "sheet-backdrop";
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.innerHTML = `<div class="sheet-h"><h3></h3><button class="icon-btn" id="sheet-x">Close</button></div><div class="sheet-body"></div>`;
    document.body.appendChild(back);
    document.body.appendChild(sheet);
    this.sheet = { back, sheet, kind };
    back.onclick = () => this.closeSheet();
    $("#sheet-x", sheet).onclick = () => this.closeSheet();
    this.renderSheet(kind);
  }

  closeSheet() {
    if (this.previewStop) {
      this.previewStop();
      this.previewStop = null;
    }
    if (!this.sheet) return;
    this.sheet.back.remove();
    this.sheet.sheet.remove();
    this.sheet = null;
  }

  renderSheet(kind) {
    const title = {
      sounds: "Sounds",
      text: "Text",
      stickers: "Stickers",
      filters: "Filters",
      adjust: "Adjust",
      speed: "Speed",
      trans: "Transitions",
      canvas: "Canvas",
      export: "Export",
    }[kind];
    $(".sheet-h h3", this.sheet.sheet).textContent = title || kind;
    const body = $(".sheet-body", this.sheet.sheet);
    if (kind === "sounds") this.renderSounds(body);
    else if (kind === "text") this.renderText(body);
    else if (kind === "stickers") this.renderStickers(body);
    else if (kind === "filters") this.renderFilters(body);
    else if (kind === "adjust") this.renderAdjust(body);
    else if (kind === "speed") this.renderSpeed(body);
    else if (kind === "trans") this.renderTrans(body);
    else if (kind === "canvas") this.renderCanvas(body);
    else if (kind === "export") this.renderExport(body);
  }

  renderSounds(body) {
    const q = this.soundQ.toLowerCase();
    const list = TRACKS.filter((t) => {
      if (this.genre === "Yours") return false;
      if (this.genre !== "For you" && t.genre !== this.genre) return false;
      if (!q) return true;
      return (t.title + t.mood + t.genre).toLowerCase().includes(q);
    });
    body.innerHTML = `
      <input class="search" id="sq" placeholder="Search original sounds" value="${this.esc(this.soundQ)}" />
      <div class="chips" id="chips"></div>
      <div class="row-btns">
        <button class="pill" id="imp-audio">Import from tablet</button>
      </div>
      <div class="sound-grid" id="sg"></div>
      <div class="section-h" style="margin-top:18px"><h3>SFX</h3></div>
      <div class="sound-grid" id="sfx"></div>`;
    $("#sq", body).oninput = (e) => {
      this.soundQ = e.target.value;
      this.renderSheet("sounds");
    };
    const chips = $("#chips", body);
    for (const g of GENRES) {
      const b = document.createElement("button");
      b.className = "chip" + (this.genre === g ? " on" : "");
      b.textContent = g;
      b.onclick = () => {
        this.genre = g;
        this.renderSheet("sounds");
      };
      chips.appendChild(b);
    }
    $("#imp-audio", body).onclick = () => this.pickAudio();
    const sg = $("#sg", body);
    if (this.genre === "Yours") {
      if (!this.userSounds.length) sg.innerHTML = `<div class="empty-recents">Import songs from this tablet. They never leave the device.</div>`;
      for (const s of this.userSounds) {
        sg.appendChild(this.soundRow({ id: s.id, title: s.name, artist: "Your library", bpm: "", color: "#3dffc4", yours: s }));
      }
    } else {
      for (const t of list) sg.appendChild(this.soundRow(t));
    }
    const sfx = $("#sfx", body);
    for (const s of SFX) {
      const row = this.soundRow({ ...s, artist: "SFX", bpm: "", sfx: true });
      sfx.appendChild(row);
    }
  }

  soundRow(t) {
    const el = document.createElement("div");
    el.className = "sound";
    el.innerHTML = `
      <div class="cover" style="background:${t.color || "#3dffc4"}">${(t.title || "?").slice(0, 1)}</div>
      <div><b>${this.esc(t.title)}</b><span>${this.esc(t.artist || "")}${t.bpm ? " · " + t.bpm + " BPM · " + t.mood : ""}</span></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="preview-btn">▶</button>
        <button class="use-btn">Use</button>
      </div>`;
    $(".preview-btn", el).onclick = () => this.previewSound(t, $(".preview-btn", el));
    $(".use-btn", el).onclick = () => {
      if (t.sfx) this.addMusic({ sfxId: t.id, title: t.title, duration: 1 });
      else if (t.yours) this.addMusic({ mediaId: t.yours.id, title: t.yours.name, duration: t.yours.duration });
      else this.addMusic({ trackId: t.id, title: t.title });
      this.closeSheet();
    };
    return el;
  }

  async previewSound(t, btn) {
    await this.engine.unlock();
    if (this.previewStop) {
      this.previewStop();
      this.previewStop = null;
      btn.textContent = "▶";
      if (this.previewId === t.id) return;
    }
    this.previewId = t.id;
    btn.textContent = "■";
    if (t.sfx) {
      const { renderSfx } = await import("./library.js");
      const buf = await renderSfx(t.id);
      const src = this.engine.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.engine.master);
      src.start();
      this.previewStop = () => {
        try {
          src.stop();
        } catch {}
        btn.textContent = "▶";
      };
      src.onended = () => this.previewStop && this.previewStop();
      return;
    }
    if (t.yours) {
      const rec = t.yours;
      const url = URL.createObjectURL(rec.blob);
      const a = new Audio(url);
      a.play();
      this.previewStop = () => {
        a.pause();
        URL.revokeObjectURL(url);
        btn.textContent = "▶";
      };
      a.onended = () => this.previewStop && this.previewStop();
      return;
    }
    const { playTrackLive } = await import("./library.js");
    const live = playTrackLive(this.engine.audioCtx, this.engine.master, t, 0);
    const stopAt = setTimeout(() => this.previewStop && this.previewStop(), 8000);
    this.previewStop = () => {
      clearTimeout(stopAt);
      live.gain.gain.exponentialRampToValueAtTime(0.0001, this.engine.audioCtx.currentTime + 0.05);
      btn.textContent = "▶";
    };
  }

  renderText(body) {
    const o = this.store.selectedOverlay();
    body.innerHTML = `
      <textarea class="field" id="tx" placeholder="Write a caption">${this.esc(o && o.type !== "sticker" ? o.text : "")}</textarea>
      <div class="style-grid" id="styles"></div>
      <div class="row-btns">
        <button class="pill" id="add-tx">Add text</button>
        ${o && o.type !== "sticker" ? `<button class="pill danger" id="rm-tx">Remove</button>` : ""}
      </div>
      <p style="color:var(--muted);font-size:12px">Drag it on the preview after you add it. Selected text can be restyled.</p>`;
    const styles = $("#styles", body);
    for (const s of TEXT_STYLES) {
      const b = document.createElement("button");
      b.className = "style-card" + (o?.style === s ? " on" : "");
      b.textContent = s;
      b.onclick = () => {
        if (o && o.type !== "sticker") {
          this.store.snapshot();
          o.style = s;
          this.engine.draw(this.store.time);
        }
        this._pendingStyle = s;
        this.renderSheet("text");
      };
      styles.appendChild(b);
    }
    $("#add-tx", body).onclick = () => {
      this.store.snapshot();
      const text = $("#tx", body).value.trim() || "Your text";
      const ov = newOverlay(this.store.time, { text, style: this._pendingStyle || "classic", type: "text" });
      this.store.project.overlays.push(ov);
      this.store.select("overlays", ov.id);
      this.store.emit("overlay");
      this.engine.draw(this.store.time);
      this.saveDraft();
      this.closeSheet();
    };
    const rm = $("#rm-tx", body);
    if (rm) {
      rm.onclick = () => {
        this.store.snapshot();
        this.store.project.overlays = this.store.project.overlays.filter((x) => x.id !== o.id);
        this.store.clearSel();
        this.store.emit("overlay");
        this.closeSheet();
      };
    }
    this.bindOverlayDrag();
  }

  bindOverlayDrag() {
    const canvas = this.engine.canvas;
    if (!canvas || canvas._taktDrag) return;
    canvas._taktDrag = true;
    canvas.addEventListener("pointerdown", (e) => {
      const o = this.store.selectedOverlay();
      if (!o) return;
      const r = canvas.getBoundingClientRect();
      o.x = (e.clientX - r.left) / r.width;
      o.y = (e.clientY - r.top) / r.height;
      this.engine.draw(this.store.time);
      const move = (ev) => {
        o.x = Math.max(0.05, Math.min(0.95, (ev.clientX - r.left) / r.width));
        o.y = Math.max(0.05, Math.min(0.95, (ev.clientY - r.top) / r.height));
        this.engine.draw(this.store.time);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        this.saveDraft();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  renderStickers(body) {
    body.innerHTML = `<div class="sticker-grid" id="st"></div>`;
    const g = $("#st", body);
    for (const e of EMOJI) {
      const b = document.createElement("button");
      b.textContent = e;
      b.onclick = () => {
        this.store.snapshot();
        const ov = newOverlay(this.store.time, { type: "sticker", emoji: e, duration: 2.5 });
        this.store.project.overlays.push(ov);
        this.store.select("overlays", ov.id);
        this.store.emit("overlay");
        this.engine.draw(this.store.time);
        this.saveDraft();
        this.closeSheet();
        this.bindOverlayDrag();
      };
      g.appendChild(b);
    }
  }

  renderFilters(body) {
    const c = this.store.selectedClip() || this.store.project.clips[0];
    body.innerHTML = `<div class="filter-grid" id="fg"></div><p style="color:var(--muted);font-size:12px">Select a clip on the timeline, then tap a look.</p>`;
    const g = $("#fg", body);
    for (const id of FILTER_IDS) {
      const b = document.createElement("button");
      b.className = "filter-card" + (c?.filter === id ? " on" : "");
      b.textContent = id;
      b.onclick = () => {
        if (!c) return toast("Add a clip first");
        this.store.snapshot();
        c.filter = id;
        this.engine.draw(this.store.time);
        this.renderSheet("filters");
        this.saveDraft();
      };
      g.appendChild(b);
    }
  }

  renderAdjust(body) {
    const c = this.store.selectedClip() || this.store.project.clips[0];
    if (!c) {
      body.innerHTML = `<p style="color:var(--muted)">Add a clip first.</p>`;
      return;
    }
    const keys = [
      ["brightness", "Brightness"],
      ["contrast", "Contrast"],
      ["saturate", "Saturate"],
      ["warmth", "Warmth"],
      ["vignette", "Vignette"],
      ["fade", "Fade"],
      ["grain", "Grain"],
    ];
    body.innerHTML = keys
      .map(
        ([k, lab]) =>
          `<div class="slider-row"><label>${lab}</label><input type="range" min="-50" max="100" data-k="${k}" value="${c.adjust[k] || 0}" /><span>${c.adjust[k] || 0}</span></div>`
      )
      .join("");
    body.querySelectorAll("input").forEach((inp) => {
      inp.oninput = () => {
        c.adjust[inp.dataset.k] = Number(inp.value);
        inp.nextElementSibling.textContent = inp.value;
        this.engine.draw(this.store.time);
      };
      inp.onchange = () => this.saveDraft();
    });
  }

  renderSpeed(body) {
    const c = this.store.selectedClip();
    body.innerHTML = `<div class="row-btns" id="sp"></div>
      <div class="row-btns">
        <button class="pill" id="rev">${c?.reverse ? "Forward" : "Reverse"}</button>
        <button class="pill" id="mute">${c?.muted ? "Unmute clip" : "Mute clip"}</button>
      </div>
      <div class="slider-row"><label>Volume</label><input id="vol" type="range" min="0" max="100" value="${Math.round((c?.volume ?? 1) * 100)}" /><span>${Math.round((c?.volume ?? 1) * 100)}</span></div>
      <p style="color:var(--muted);font-size:12px">Select a clip first.</p>`;
    const row = $("#sp", body);
    for (const s of SPEEDS) {
      const b = document.createElement("button");
      b.className = "pill" + (c && c.speed === s ? " on" : "");
      b.textContent = s + "x";
      b.onclick = () => {
        if (!c) return toast("Select a clip");
        this.store.snapshot();
        c.speed = s;
        this.store.emit("speed");
        this.saveDraft();
        this.renderSheet("speed");
      };
      row.appendChild(b);
    }
    $("#rev", body).onclick = () => {
      if (!c) return;
      this.store.snapshot();
      c.reverse = !c.reverse;
      this.saveDraft();
      this.renderSheet("speed");
    };
    $("#mute", body).onclick = () => {
      if (!c) return;
      c.muted = !c.muted;
      this.renderSheet("speed");
    };
    $("#vol", body).oninput = (e) => {
      if (!c) return;
      c.volume = Number(e.target.value) / 100;
      e.target.nextElementSibling.textContent = e.target.value;
    };
  }

  renderTrans(body) {
    const c = this.store.selectedClip();
    body.innerHTML = `<div class="trans-grid" id="tg"></div><div class="slider-row"><label>Length</label><input id="td" type="range" min="8" max="80" value="${Math.round((c?.transitionIn?.duration || 0.35) * 100)}" /><span>${(c?.transitionIn?.duration || 0.35).toFixed(2)}s</span></div>`;
    const g = $("#tg", body);
    for (const t of TRANS) {
      const b = document.createElement("button");
      b.className = "trans-card" + (c?.transitionIn?.type === t ? " on" : "");
      b.textContent = t;
      b.onclick = () => {
        if (!c) return toast("Select the incoming clip");
        this.store.snapshot();
        c.transitionIn = { type: t, duration: c.transitionIn?.duration || 0.35 };
        this.engine.draw(this.store.time);
        this.renderSheet("trans");
        this.saveDraft();
      };
      g.appendChild(b);
    }
    $("#td", body).oninput = (e) => {
      if (!c) return;
      c.transitionIn.duration = Number(e.target.value) / 100;
      e.target.nextElementSibling.textContent = c.transitionIn.duration.toFixed(2) + "s";
    };
  }

  renderCanvas(body) {
    body.innerHTML = `<div class="ratio-grid" id="rg"></div>
      <div class="slider-row"><label>Music vs original</label><input id="duck" type="range" min="0" max="100" value="${Math.round((this.store.project.duckOriginal ?? 0.22) * 100)}" /><span>${Math.round((this.store.project.duckOriginal ?? 0.22) * 100)}</span></div>
      <p style="color:var(--muted);font-size:12px">Lower = original clip audio ducks under the song, like TikTok.</p>`;
    const g = $("#rg", body);
    for (const r of Object.keys(RATIOS)) {
      const b = document.createElement("button");
      b.className = "ratio-card" + (this.store.project.ratio === r ? " on" : "");
      b.textContent = r;
      b.onclick = () => {
        this.store.project.ratio = r;
        this.engine.resize();
        this.renderSheet("canvas");
        this.saveDraft();
      };
      g.appendChild(b);
    }
    $("#duck", body).oninput = (e) => {
      this.store.project.duckOriginal = Number(e.target.value) / 100;
      e.target.nextElementSibling.textContent = e.target.value;
    };
  }

  renderExport(body) {
    body.innerHTML = `
      <div class="export-card">
        <b>Save to this tablet</b>
        <p style="color:var(--muted);margin:8px 0 12px;font-size:13px">Renders the timeline, song, voice and overlays. Lands in Downloads. Share it anywhere.</p>
        <div class="row-btns">
          <button class="pill on" data-q="720">720p — fast</button>
          <button class="pill" data-q="1080">1080p — sharp</button>
        </div>
        <button class="text-btn accent" id="go-ex" style="width:100%;height:48px;margin-top:8px">Export clip</button>
        <div class="progress" id="ex-prog"><i></i></div>
      </div>
      <div class="export-card">
        <b>Draft is already saved</b>
        <p style="color:var(--muted);margin:8px 0 0;font-size:13px">Close the tab, come back later. Projects live in this browser — nothing is uploaded.</p>
      </div>`;
    let q = 720;
    body.querySelectorAll("[data-q]").forEach((b) => {
      b.onclick = () => {
        body.querySelectorAll("[data-q]").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        q = Number(b.dataset.q);
      };
    });
    $("#go-ex", body).onclick = async () => {
      if (!this.store.project.clips.length) return toast("Add a clip first");
      const btn = $("#go-ex", body);
      const bar = $("#ex-prog i", body);
      btn.disabled = true;
      btn.textContent = "Rendering…";
      try {
        const { blob, ext } = await this.engine.export({
          quality: q,
          onProgress: (p) => {
            bar.style.width = Math.round(p * 100) + "%";
          },
        });
        const name = (this.store.project.name || "TAKT").replace(/[^\w\- ]+/g, "") + "." + ext;
        downloadBlob(blob, name);
        toast("Saved · " + name);
        btn.textContent = "Saved to Downloads";
      } catch (err) {
        console.error(err);
        toast("Export failed — try 720p or a shorter cut");
        btn.textContent = "Export clip";
      }
      btn.disabled = false;
    };
  }

  async recordCamera() {
    try {
      await this.engine.unlock();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `<video id="cam" autoplay playsinline muted></video>
        <div class="modal-bar">
          <button class="text-btn" id="flip-cam">Close</button>
          <button class="text-btn accent" id="rec-cam" style="flex:1">Record</button>
        </div>`;
      document.body.appendChild(modal);
      const video = $("#cam", modal);
      video.srcObject = stream;
      let rec = null;
      let chunks = [];
      $("#flip-cam", modal).onclick = () => {
        stream.getTracks().forEach((t) => t.stop());
        modal.remove();
      };
      $("#rec-cam", modal).onclick = async () => {
        if (!rec) {
          const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "";
          rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
          chunks = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.start();
          $("#rec-cam", modal).textContent = "Stop";
          return;
        }
        rec.stop();
        await new Promise((r) => (rec.onstop = r));
        stream.getTracks().forEach((t) => t.stop());
        modal.remove();
        const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
        const file = new File([blob], "camera-" + Date.now() + ".webm", { type: blob.type });
        this.store.snapshot();
        const media = await importMediaFile(this.db, file);
        const start = this.store.project.clips.length ? Math.max(...this.store.project.clips.map(clipEnd)) : 0;
        this.store.project.clips.push(newClip(media, start));
        await this.engine.ensureClipMedia();
        this.store.emit("clips");
        this.saveDraft(true);
        toast("Camera clip added");
      };
    } catch {
      toast("Camera blocked — allow it in Chrome");
    }
  }

  async recordVoice() {
    try {
      await this.engine.unlock();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const modal = document.createElement("div");
      modal.className = "sheet";
      modal.style.maxHeight = "240px";
      modal.innerHTML = `<div class="sheet-h"><h3>Voiceover</h3></div>
        <div class="sheet-body"><p style="color:var(--muted)">Recording from the playhead…</p>
        <button class="text-btn accent" id="stop-vo" style="width:100%;height:48px">Stop & drop</button></div>`;
      document.body.appendChild(modal);
      rec.start();
      $("#stop-vo", modal).onclick = async () => {
        rec.stop();
        await new Promise((r) => (rec.onstop = r));
        stream.getTracks().forEach((t) => t.stop());
        modal.remove();
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], "vo-" + Date.now() + ".webm", { type: blob.type });
        const media = await importMediaFile(this.db, file);
        this.store.snapshot();
        this.store.project.voice.push(
          newAudioItem("voice", this.store.time, media.duration || 3, { mediaId: media.id, title: "Voiceover" })
        );
        this.store.emit("voice");
        this.saveDraft();
        toast("Voiceover dropped");
      };
    } catch {
      toast("Mic blocked — allow it in Chrome");
    }
  }

  async saveDraft(withThumb = false) {
    const p = this.store.project;
    if (!p) return;
    p.updated = Date.now();
    let thumb = "";
    if (withThumb && this.engine.canvas) {
      try {
        thumb = this.engine.canvas.toDataURL("image/jpeg", 0.6);
      } catch {}
    }
    const row = await this.db.getProject(p.id);
    await this.db.putProject({
      id: p.id,
      name: p.name,
      updated: p.updated,
      created: p.created,
      ratio: p.ratio,
      thumb: thumb || row?.thumb || "",
      data: JSON.parse(JSON.stringify(p)),
    });
  }
}
