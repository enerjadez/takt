function midiHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function pat(str) {
  return str.replace(/\s+/g, "").split("").map((c) => {
    if (c === "0" || c === "." || c === "-") return 0;
    if (c === "1") return 1;
    const v = parseInt(c, 16);
    return Number.isFinite(v) ? v / 15 : 0;
  });
}

function fill(bars, notes) {
  const out = [];
  for (let b = 0; b < bars; b++) {
    for (const n of notes) out.push([b + (n[0] || 0), n[1], n[2], n[3], n[4] ?? 0.85]);
  }
  return out;
}

function noiseBuffer(ctx, seconds = 1) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(ctx, t, peak, a, d, dest) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(dest);
  return g;
}

export const GENRES = ["For you", "Trap", "Drill", "House", "Lo-fi", "Amapiano", "Phonk", "Pop", "Cinematic", "Yours"];

export const TRACKS = [
  {
    id: "night-drive",
    title: "Night Drive",
    artist: "TAKT Originals",
    bpm: 118,
    genre: "Synth",
    mood: "Dark",
    color: "#5b8cff",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "6060606060606060", perc: "0000004000000040" },
    bass: fill(8, [[0, 0, 33, 8, 0.95], [0, 8, 36, 4, 0.8], [0, 12, 33, 4, 0.7]]),
    pad: [
      [0, 0, [57, 60, 64], 32, 0.22],
      [2, 0, [53, 57, 60], 32, 0.22],
      [4, 0, [48, 52, 55, 60], 32, 0.2],
      [6, 0, [55, 59, 62], 32, 0.22],
    ],
    lead: fill(2, [
      [0, 0, 72, 2, 0.45], [0, 4, 76, 2, 0.4], [0, 8, 79, 4, 0.5], [0, 14, 76, 2, 0.35],
      [1, 0, 72, 2, 0.4], [1, 6, 74, 2, 0.35], [1, 10, 76, 4, 0.45],
    ]),
    fx: { vinyl: 0, delay: 0.22, sidechain: 0.55 },
  },
  {
    id: "gold-hour",
    title: "Gold Hour",
    artist: "TAKT Originals",
    bpm: 90,
    genre: "Lo-fi",
    mood: "Warm",
    color: "#ffc857",
    bars: 8,
    swing: 0.18,
    drums: { kick: "8000004080000040", snare: "0000800000008000", hat: "5050505050505050", clap: "0000700000007000" },
    bass: fill(8, [[0, 0, 41, 6, 0.7], [0, 8, 38, 4, 0.6], [0, 12, 36, 4, 0.55]]),
    pad: [
      [0, 0, [65, 69, 72], 32, 0.18],
      [2, 0, [62, 65, 69], 32, 0.18],
      [4, 0, [60, 65, 69], 32, 0.16],
      [6, 0, [62, 67, 70], 32, 0.18],
    ],
    lead: fill(2, [[0, 4, 77, 3, 0.28], [0, 10, 74, 2, 0.24], [1, 2, 72, 4, 0.26], [1, 12, 69, 3, 0.22]]),
    fx: { vinyl: 0.12, delay: 0.18, sidechain: 0.25 },
  },
  {
    id: "concrete",
    title: "Concrete",
    artist: "TAKT Originals",
    bpm: 140,
    genre: "Drill",
    mood: "Cold",
    color: "#9aa4b2",
    bars: 8,
    swing: 0.08,
    drums: { kick: "8000000080800000", snare: "0000000080000000", hat: "a0a0a0a0a0a0a0a0", perc: "0004000400040004" },
    bass: fill(4, [
      [0, 0, 28, 3, 1], [0, 3, 27, 1, 0.8], [0, 4, 28, 4, 0.9], [0, 10, 31, 2, 0.7], [0, 12, 28, 4, 0.85],
      [1, 0, 26, 6, 0.95], [1, 8, 24, 8, 0.9],
    ]),
    pad: [[0, 0, [52, 55, 59], 64, 0.1], [4, 0, [51, 54, 58], 64, 0.1]],
    lead: fill(2, [[0, 8, 64, 1, 0.25], [0, 11, 67, 1, 0.22], [1, 0, 71, 2, 0.28], [1, 8, 67, 2, 0.22]]),
    fx: { vinyl: 0, delay: 0.12, sidechain: 0.4 },
  },
  {
    id: "soft-focus",
    title: "Soft Focus",
    artist: "TAKT Originals",
    bpm: 78,
    genre: "Cinematic",
    mood: "Dream",
    color: "#c4b5fd",
    bars: 8,
    swing: 0,
    drums: { kick: "8000000000004000", snare: "0000000000000000", hat: "2020202020202020" },
    bass: fill(8, [[0, 0, 36, 16, 0.45]]),
    pad: [
      [0, 0, [60, 64, 67, 71], 32, 0.28],
      [2, 0, [59, 62, 67, 71], 32, 0.26],
      [4, 0, [57, 60, 64, 67], 32, 0.28],
      [6, 0, [55, 59, 62, 67], 32, 0.24],
    ],
    lead: fill(4, [[0, 8, 79, 6, 0.2], [1, 0, 76, 8, 0.18], [2, 4, 74, 8, 0.18], [3, 10, 71, 6, 0.16]]),
    fx: { vinyl: 0.04, delay: 0.35, sidechain: 0.15 },
  },
  {
    id: "afterglow",
    title: "Afterglow",
    artist: "TAKT Originals",
    bpm: 124,
    genre: "Pop",
    mood: "Bright",
    color: "#ff7ab6",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "9090909090909090", clap: "0000800000008000" },
    bass: fill(8, [[0, 0, 40, 4, 0.85], [0, 4, 40, 2, 0.5], [0, 8, 45, 4, 0.8], [0, 12, 43, 4, 0.75]]),
    pad: [
      [0, 0, [64, 68, 71], 16, 0.16],
      [1, 0, [64, 69, 73], 16, 0.16],
      [2, 0, [62, 66, 69], 16, 0.16],
      [3, 0, [60, 64, 67], 16, 0.16],
    ],
    lead: fill(2, [
      [0, 0, 76, 2, 0.42], [0, 4, 76, 2, 0.32], [0, 8, 79, 4, 0.5], [0, 14, 81, 2, 0.4],
      [1, 2, 79, 2, 0.38], [1, 6, 76, 2, 0.34], [1, 10, 74, 4, 0.4],
    ]),
    fx: { vinyl: 0, delay: 0.2, sidechain: 0.6 },
  },
  {
    id: "voltage",
    title: "Voltage",
    artist: "TAKT Originals",
    bpm: 148,
    genre: "Phonk",
    mood: "Aggressive",
    color: "#ff4d4d",
    bars: 8,
    swing: 0.12,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "c0c0c0c0c0c0c0c0", clap: "0000a0000000a000" },
    bass: fill(4, [[0, 0, 26, 2, 1], [0, 4, 26, 2, 0.9], [0, 8, 29, 2, 0.95], [0, 12, 26, 2, 0.85], [1, 0, 24, 8, 1], [1, 8, 22, 8, 0.95]]),
    pad: [[0, 0, [50, 53, 57], 64, 0.08], [4, 0, [48, 53, 56], 64, 0.08]],
    lead: fill(2, [[0, 0, 69, 1, 0.3], [0, 2, 72, 1, 0.28], [0, 4, 76, 2, 0.34], [0, 8, 74, 2, 0.3], [1, 0, 69, 4, 0.32], [1, 8, 65, 4, 0.28]]),
    fx: { vinyl: 0.05, delay: 0.25, sidechain: 0.7 },
  },
  {
    id: "durban-heat",
    title: "Durban Heat",
    artist: "TAKT Originals",
    bpm: 112,
    genre: "Amapiano",
    mood: "Groove",
    color: "#3dffc4",
    bars: 8,
    swing: 0.06,
    drums: { kick: "8000000080000000", snare: "0000000000008000", hat: "4040404040404040", perc: "0040004000400040" },
    bass: fill(4, [
      [0, 0, 38, 2, 0.55], [0, 3, 45, 2, 0.8], [0, 6, 50, 2, 0.9], [0, 9, 45, 2, 0.7], [0, 12, 43, 3, 0.75],
      [1, 0, 36, 2, 0.55], [1, 4, 43, 2, 0.8], [1, 8, 48, 2, 0.85], [1, 12, 43, 3, 0.7],
    ]),
    pad: [
      [0, 0, [62, 65, 69], 32, 0.14],
      [2, 0, [60, 64, 67], 32, 0.14],
      [4, 0, [62, 65, 69], 32, 0.14],
      [6, 0, [59, 62, 67], 32, 0.14],
    ],
    lead: fill(2, [[0, 6, 74, 2, 0.28], [0, 10, 77, 2, 0.3], [1, 2, 74, 2, 0.26], [1, 8, 69, 4, 0.28]]),
    fx: { vinyl: 0, delay: 0.16, sidechain: 0.3, log: true },
  },
  {
    id: "silk",
    title: "Silk",
    artist: "TAKT Originals",
    bpm: 88,
    genre: "Pop",
    mood: "Smooth",
    color: "#f9a8d4",
    bars: 8,
    swing: 0.1,
    drums: { kick: "8000004080000040", snare: "0000800000008000", hat: "3030303030303030", clap: "0000600000006000" },
    bass: fill(8, [[0, 0, 37, 8, 0.7], [0, 8, 40, 4, 0.6], [0, 12, 35, 4, 0.55]]),
    pad: [
      [0, 0, [61, 64, 68], 32, 0.2],
      [2, 0, [59, 64, 68], 32, 0.2],
      [4, 0, [56, 61, 64], 32, 0.18],
      [6, 0, [59, 63, 66], 32, 0.2],
    ],
    lead: fill(2, [[0, 4, 73, 4, 0.3], [0, 12, 76, 3, 0.28], [1, 2, 73, 2, 0.24], [1, 8, 68, 6, 0.3]]),
    fx: { vinyl: 0.03, delay: 0.28, sidechain: 0.3 },
  },
  {
    id: "run-it",
    title: "Run It",
    artist: "TAKT Originals",
    bpm: 128,
    genre: "House",
    mood: "Peak",
    color: "#60a5fa",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "00a000a000a000a0", clap: "0000a0000000a000" },
    bass: fill(8, [[0, 0, 36, 2, 0.9], [0, 4, 36, 2, 0.7], [0, 8, 39, 2, 0.85], [0, 12, 36, 2, 0.75]]),
    pad: [[0, 0, [60, 64, 67], 16, 0.12], [1, 0, [62, 65, 69], 16, 0.12], [2, 0, [59, 62, 67], 16, 0.12], [3, 0, [60, 64, 67], 16, 0.12]],
    lead: fill(2, [[0, 4, 72, 1, 0.35], [0, 6, 74, 1, 0.32], [0, 8, 76, 2, 0.4], [0, 12, 79, 2, 0.38], [1, 0, 76, 2, 0.34], [1, 8, 72, 4, 0.36]]),
    fx: { vinyl: 0, delay: 0.18, sidechain: 0.75 },
  },
  {
    id: "smoke-room",
    title: "Smoke Room",
    artist: "TAKT Originals",
    bpm: 86,
    genre: "Trap",
    mood: "Dusty",
    color: "#d6b28a",
    bars: 8,
    swing: 0.2,
    drums: { kick: "8000000080004000", snare: "0000800000008000", hat: "8080808080808080", perc: "0000002000000020" },
    bass: fill(8, [[0, 0, 32, 8, 0.85], [0, 10, 35, 2, 0.55], [0, 12, 32, 4, 0.7]]),
    pad: [[0, 0, [56, 60, 63], 64, 0.14], [4, 0, [55, 58, 63], 64, 0.14]],
    lead: fill(2, [[0, 4, 68, 2, 0.22], [0, 12, 70, 2, 0.2], [1, 6, 63, 4, 0.22]]),
    fx: { vinyl: 0.16, delay: 0.2, sidechain: 0.2 },
  },
  {
    id: "neon-grid",
    title: "Neon Grid",
    artist: "TAKT Originals",
    bpm: 174,
    genre: "House",
    mood: "Rush",
    color: "#22d3ee",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "ffffffff00000000".replace(/f/g, "9") && "9090909090909090", perc: "0002000200020002" },
    bass: fill(4, [[0, 0, 38, 2, 0.85], [0, 4, 41, 2, 0.7], [0, 8, 38, 2, 0.8], [0, 12, 36, 2, 0.7], [1, 0, 33, 4, 0.9], [1, 8, 31, 4, 0.85], [1, 12, 33, 4, 0.8]]),
    pad: [[0, 0, [62, 65, 69], 32, 0.1], [2, 0, [64, 67, 71], 32, 0.1], [4, 0, [62, 65, 69], 32, 0.1], [6, 0, [60, 64, 67], 32, 0.1]],
    lead: fill(1, [[0, 0, 74, 1, 0.28], [0, 2, 77, 1, 0.26], [0, 4, 81, 2, 0.32], [0, 8, 79, 2, 0.28], [0, 12, 77, 2, 0.26]]),
    fx: { vinyl: 0, delay: 0.14, sidechain: 0.65 },
  },
  {
    id: "coastline",
    title: "Coastline",
    artist: "TAKT Originals",
    bpm: 104,
    genre: "Pop",
    mood: "Sun",
    color: "#38bdf8",
    bars: 8,
    swing: 0.05,
    drums: { kick: "8000000080004000", snare: "0000800000008000", hat: "5050505050505050", clap: "0000700000007000" },
    bass: fill(8, [[0, 0, 40, 6, 0.7], [0, 8, 44, 4, 0.65], [0, 12, 42, 4, 0.6]]),
    pad: [
      [0, 0, [64, 67, 71], 32, 0.16],
      [2, 0, [64, 68, 71], 32, 0.16],
      [4, 0, [62, 66, 69], 32, 0.16],
      [6, 0, [60, 64, 67], 32, 0.16],
    ],
    lead: fill(2, [[0, 2, 76, 2, 0.32], [0, 8, 79, 3, 0.34], [1, 0, 76, 2, 0.28], [1, 6, 71, 4, 0.3]]),
    fx: { vinyl: 0, delay: 0.22, sidechain: 0.35 },
  },
  {
    id: "heavy-crown",
    title: "Heavy Crown",
    artist: "TAKT Originals",
    bpm: 140,
    genre: "Trap",
    mood: "Boss",
    color: "#a78bfa",
    bars: 8,
    swing: 0.1,
    drums: { kick: "8000000080008000", snare: "0000000080000000", hat: "b0b0b0b0b0b0b0b0", clap: "00000000a0000000" },
    bass: fill(4, [[0, 0, 27, 6, 1], [0, 8, 27, 2, 0.7], [0, 12, 30, 4, 0.85], [1, 0, 25, 8, 0.95], [1, 10, 22, 6, 0.9]]),
    pad: [[0, 0, [51, 54, 58], 64, 0.1], [4, 0, [50, 53, 58], 64, 0.1]],
    lead: fill(2, [[0, 8, 63, 2, 0.24], [0, 12, 66, 2, 0.22], [1, 0, 70, 4, 0.28], [1, 10, 66, 2, 0.22]]),
    fx: { vinyl: 0, delay: 0.12, sidechain: 0.45 },
  },
  {
    id: "paper-lantern",
    title: "Paper Lantern",
    artist: "TAKT Originals",
    bpm: 76,
    genre: "Lo-fi",
    mood: "Night",
    color: "#fdba74",
    bars: 8,
    swing: 0.16,
    drums: { kick: "8000000000004000", snare: "0000000080000000", hat: "4040004040400040" },
    bass: fill(8, [[0, 0, 39, 16, 0.4]]),
    pad: [
      [0, 0, [63, 66, 70], 32, 0.22],
      [2, 0, [62, 66, 69], 32, 0.2],
      [4, 0, [58, 63, 66], 32, 0.22],
      [6, 0, [61, 65, 68], 32, 0.2],
    ],
    lead: fill(4, [[0, 8, 75, 4, 0.2], [1, 4, 73, 6, 0.18], [2, 0, 70, 8, 0.2], [3, 10, 66, 4, 0.16]]),
    fx: { vinyl: 0.18, delay: 0.3, sidechain: 0.12 },
  },
  {
    id: "flash",
    title: "Flash",
    artist: "TAKT Originals",
    bpm: 150,
    genre: "Drill",
    mood: "Rage",
    color: "#fb7185",
    bars: 8,
    swing: 0.14,
    drums: { kick: "8000008080000080", snare: "0000000080000000", hat: "d0d0d0d0d0d0d0d0" },
    bass: fill(4, [[0, 0, 30, 2, 1], [0, 3, 29, 1, 0.8], [0, 4, 30, 4, 0.95], [0, 10, 33, 2, 0.75], [1, 0, 28, 6, 0.95], [1, 8, 26, 8, 0.9]]),
    pad: [[0, 0, [54, 57, 61], 64, 0.08]],
    lead: fill(2, [[0, 8, 66, 1, 0.26], [0, 10, 70, 1, 0.24], [1, 0, 73, 2, 0.3], [1, 8, 70, 2, 0.24]]),
    fx: { vinyl: 0, delay: 0.1, sidechain: 0.35 },
  },
  {
    id: "midnight-taxi",
    title: "Midnight Taxi",
    artist: "TAKT Originals",
    bpm: 120,
    genre: "House",
    mood: "Night",
    color: "#818cf8",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "00a000a000a000a0", clap: "0000800000008000" },
    bass: fill(8, [[0, 0, 38, 4, 0.8], [0, 6, 41, 2, 0.6], [0, 8, 38, 4, 0.75], [0, 14, 36, 2, 0.55]]),
    pad: [[0, 0, [62, 65, 69], 16, 0.14], [1, 0, [60, 64, 67], 16, 0.14], [2, 0, [62, 66, 69], 16, 0.14], [3, 0, [64, 67, 71], 16, 0.14]],
    lead: fill(2, [[0, 4, 77, 2, 0.32], [0, 10, 74, 2, 0.28], [1, 0, 72, 4, 0.3], [1, 10, 69, 4, 0.28]]),
    fx: { vinyl: 0, delay: 0.24, sidechain: 0.62 },
  },
  {
    id: "dust-trail",
    title: "Dust Trail",
    artist: "TAKT Originals",
    bpm: 92,
    genre: "Cinematic",
    mood: "Wide",
    color: "#fbbf24",
    bars: 8,
    swing: 0,
    drums: { kick: "8000000000008000", snare: "0000000080000000", hat: "2020002020200020" },
    bass: fill(8, [[0, 0, 34, 16, 0.5]]),
    pad: [
      [0, 0, [58, 62, 65], 32, 0.24],
      [2, 0, [57, 60, 65], 32, 0.22],
      [4, 0, [53, 58, 62], 32, 0.24],
      [6, 0, [55, 58, 62], 32, 0.2],
    ],
    lead: fill(4, [[0, 8, 77, 6, 0.22], [1, 4, 74, 8, 0.2], [2, 0, 70, 8, 0.22], [3, 8, 65, 6, 0.18]]),
    fx: { vinyl: 0.06, delay: 0.32, sidechain: 0.18 },
  },
  {
    id: "heartline",
    title: "Heartline",
    artist: "TAKT Originals",
    bpm: 70,
    genre: "Cinematic",
    mood: "Sad",
    color: "#fda4af",
    bars: 8,
    swing: 0,
    drums: { kick: "8000000000000000", hat: "1010101010101010" },
    bass: fill(8, [[0, 0, 32, 16, 0.4]]),
    pad: [
      [0, 0, [59, 63, 66], 32, 0.3],
      [2, 0, [56, 59, 63], 32, 0.28],
      [4, 0, [54, 59, 63], 32, 0.3],
      [6, 0, [51, 54, 59], 32, 0.26],
    ],
    lead: fill(4, [[0, 0, 71, 8, 0.22], [1, 0, 68, 8, 0.2], [2, 0, 66, 8, 0.22], [3, 0, 63, 8, 0.18]]),
    fx: { vinyl: 0.02, delay: 0.4, sidechain: 0.1 },
  },
  {
    id: "arcade-blood",
    title: "Arcade Blood",
    artist: "TAKT Originals",
    bpm: 130,
    genre: "Phonk",
    mood: "Retro",
    color: "#f472b6",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "a0a0a0a0a0a0a0a0", perc: "0004000000040000" },
    bass: fill(8, [[0, 0, 29, 4, 0.9], [0, 4, 29, 2, 0.55], [0, 8, 32, 4, 0.85], [0, 12, 31, 4, 0.8]]),
    pad: [[0, 0, [53, 56, 60], 32, 0.12], [2, 0, [52, 56, 59], 32, 0.12], [4, 0, [53, 57, 60], 32, 0.12], [6, 0, [50, 53, 57], 32, 0.12]],
    lead: fill(2, [[0, 0, 65, 2, 0.34], [0, 4, 68, 2, 0.3], [0, 8, 72, 4, 0.38], [1, 0, 68, 2, 0.3], [1, 6, 65, 2, 0.28], [1, 10, 60, 4, 0.32]]),
    fx: { vinyl: 0.04, delay: 0.2, sidechain: 0.55 },
  },
  {
    id: "low-tide",
    title: "Low Tide",
    artist: "TAKT Originals",
    bpm: 100,
    genre: "Lo-fi",
    mood: "Calm",
    color: "#67e8f9",
    bars: 8,
    swing: 0.12,
    drums: { kick: "8000004080000000", snare: "0000800000008000", hat: "4040404040404040" },
    bass: fill(8, [[0, 0, 35, 8, 0.6], [0, 8, 38, 8, 0.55]]),
    pad: [
      [0, 0, [59, 62, 66], 32, 0.18],
      [2, 0, [57, 62, 66], 32, 0.18],
      [4, 0, [54, 59, 62], 32, 0.18],
      [6, 0, [57, 61, 64], 32, 0.18],
    ],
    lead: fill(2, [[0, 4, 71, 3, 0.24], [0, 12, 74, 3, 0.22], [1, 4, 69, 4, 0.24], [1, 12, 66, 3, 0.2]]),
    fx: { vinyl: 0.1, delay: 0.26, sidechain: 0.22 },
  },
  {
    id: "redline",
    title: "Redline",
    artist: "TAKT Originals",
    bpm: 132,
    genre: "House",
    mood: "Dark",
    color: "#fb7185",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "00c000c000c000c0" },
    bass: fill(8, [[0, 0, 31, 2, 0.95], [0, 4, 31, 2, 0.7], [0, 8, 34, 2, 0.9], [0, 12, 31, 2, 0.75]]),
    pad: [[0, 0, [55, 58, 62], 32, 0.1], [2, 0, [53, 58, 62], 32, 0.1], [4, 0, [55, 59, 62], 32, 0.1], [6, 0, [50, 55, 58], 32, 0.1]],
    lead: fill(2, [[0, 4, 67, 1, 0.3], [0, 8, 70, 2, 0.34], [0, 12, 74, 2, 0.32], [1, 0, 70, 4, 0.3], [1, 8, 67, 4, 0.28]]),
    fx: { vinyl: 0, delay: 0.16, sidechain: 0.72 },
  },
  {
    id: "wolfpack",
    title: "Wolfpack",
    artist: "TAKT Originals",
    bpm: 144,
    genre: "Trap",
    mood: "Dark",
    color: "#94a3b8",
    bars: 8,
    swing: 0.08,
    drums: { kick: "8000000080800000", snare: "0000000080000000", hat: "c0c0c0c0c0c0c0c0" },
    bass: fill(4, [[0, 0, 25, 6, 1], [0, 8, 25, 2, 0.7], [0, 12, 28, 4, 0.85], [1, 0, 23, 8, 0.95], [1, 10, 20, 6, 0.9]]),
    pad: [[0, 0, [49, 52, 56], 64, 0.09]],
    lead: fill(2, [[0, 8, 61, 2, 0.22], [1, 0, 64, 3, 0.26], [1, 8, 68, 3, 0.24]]),
    fx: { vinyl: 0, delay: 0.1, sidechain: 0.4 },
  },
  {
    id: "sunday-market",
    title: "Sunday Market",
    artist: "TAKT Originals",
    bpm: 102,
    genre: "Amapiano",
    mood: "Light",
    color: "#86efac",
    bars: 8,
    swing: 0.07,
    drums: { kick: "8000000080000000", snare: "0000000000007000", hat: "3030303030303030", perc: "0040004000400040" },
    bass: fill(4, [
      [0, 2, 43, 2, 0.7], [0, 5, 47, 2, 0.8], [0, 8, 50, 2, 0.85], [0, 12, 47, 3, 0.7],
      [1, 2, 41, 2, 0.65], [1, 6, 45, 2, 0.75], [1, 10, 48, 3, 0.8],
    ]),
    pad: [[0, 0, [64, 67, 71], 32, 0.14], [2, 0, [62, 66, 69], 32, 0.14], [4, 0, [64, 67, 71], 32, 0.14], [6, 0, [60, 64, 67], 32, 0.14]],
    lead: fill(2, [[0, 8, 76, 2, 0.26], [1, 4, 79, 2, 0.28], [1, 12, 71, 3, 0.24]]),
    fx: { vinyl: 0, delay: 0.18, sidechain: 0.28, log: true },
  },
  {
    id: "glasshouse",
    title: "Glasshouse",
    artist: "TAKT Originals",
    bpm: 118,
    genre: "Pop",
    mood: "Clean",
    color: "#e2e8f0",
    bars: 8,
    swing: 0,
    drums: { kick: "8000800080008000", snare: "0000800000008000", hat: "7070707070707070" },
    bass: fill(8, [[0, 0, 40, 8, 0.7], [0, 8, 43, 4, 0.65], [0, 12, 38, 4, 0.6]]),
    pad: [
      [0, 0, [64, 67, 71], 16, 0.16],
      [1, 0, [64, 68, 71], 16, 0.16],
      [2, 0, [62, 66, 69], 16, 0.16],
      [3, 0, [60, 64, 67], 16, 0.16],
    ],
    lead: fill(2, [[0, 0, 76, 4, 0.32], [0, 8, 79, 4, 0.34], [1, 0, 81, 4, 0.32], [1, 8, 76, 6, 0.3]]),
    fx: { vinyl: 0, delay: 0.2, sidechain: 0.5 },
  },
];

const SFX = [
  { id: "whoosh", title: "Whoosh", color: "#93c5fd" },
  { id: "impact", title: "Impact", color: "#fca5a5" },
  { id: "pop", title: "Pop", color: "#fde68a" },
  { id: "riser", title: "Riser", color: "#c4b5fd" },
  { id: "click", title: "Click", color: "#a7f3d0" },
  { id: "reverse", title: "Reverse", color: "#fdba74" },
];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || null;
}

export function trackDuration(track) {
  return (track.bars * 4 * 60) / track.bpm;
}

export function trackBeats(track) {
  const step = 60 / track.bpm;
  const beats = [];
  for (let i = 0; i < track.bars * 4; i++) beats.push(i * step);
  return beats;
}

function stepTime(track, bar, step) {
  const six = 60 / track.bpm / 4;
  let t = (bar * 16 + step) * six;
  if (track.swing && step % 2 === 1) t += six * track.swing;
  return t;
}

function hitKick(ctx, dest, t, vel) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(172, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.07);
  g.gain.setValueAtTime(vel * 1.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.3);
  const click = ctx.createOscillator();
  const cg = ctx.createGain();
  click.type = "square";
  click.frequency.value = 1400;
  cg.gain.setValueAtTime(vel * 0.12, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  click.connect(cg);
  cg.connect(dest);
  click.start(t);
  click.stop(t + 0.03);
}

function hitNoise(ctx, dest, t, vel, dur, hp, peak = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 1);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function hitSnare(ctx, dest, t, vel) {
  hitNoise(ctx, dest, t, vel, 0.18, 900, 0.55);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(196, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
  g.gain.setValueAtTime(vel * 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.16);
}

function hitClap(ctx, dest, t, vel) {
  hitNoise(ctx, dest, t, vel, 0.16, 1200, 0.45);
  hitNoise(ctx, dest, t + 0.012, vel * 0.8, 0.12, 1400, 0.35);
}

function hitHat(ctx, dest, t, vel, open = false) {
  hitNoise(ctx, dest, t, vel, open ? 0.22 : 0.045, open ? 6000 : 8000, open ? 0.22 : 0.18);
}

function hitPerc(ctx, dest, t, vel) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(540, t);
  o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
  g.gain.setValueAtTime(vel * 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + 0.13);
}

function playBass(ctx, dest, t, midi, dur, vel, log = false) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = log ? "sine" : "sawtooth";
  o2.type = "sine";
  const hz = midiHz(midi);
  o.frequency.setValueAtTime(hz, t);
  o2.frequency.setValueAtTime(hz * 0.5, t);
  if (log) {
    o.frequency.exponentialRampToValueAtTime(hz * 1.06, t + dur * 0.4);
    o.frequency.exponentialRampToValueAtTime(hz, t + dur);
  }
  f.type = "lowpass";
  f.frequency.setValueAtTime(log ? 900 : 280, t);
  f.Q.value = log ? 6 : 1.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * (log ? 0.7 : 0.55), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  o2.connect(g);
  f.connect(g);
  g.connect(dest);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.02);
  o2.stop(t + dur + 0.02);
}

function playVoice(ctx, dest, t, midi, dur, vel, kind) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = kind === "lead" ? "sawtooth" : "triangle";
  o2.type = "sine";
  const hz = midiHz(midi);
  o.frequency.value = hz;
  o2.frequency.value = hz * 1.003;
  f.type = "lowpass";
  f.frequency.setValueAtTime(kind === "pad" ? 1400 : 2800, t);
  f.frequency.exponentialRampToValueAtTime(kind === "pad" ? 800 : 900, t + dur);
  const atk = kind === "pad" ? 0.18 : 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * (kind === "pad" ? 0.22 : 0.18), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  o2.connect(f);
  f.connect(g);
  g.connect(dest);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.02);
  o2.stop(t + dur + 0.02);
}

function playChord(ctx, dest, t, notes, dur, vel) {
  for (const n of notes) playVoice(ctx, dest, t, n, dur, vel, "pad");
}

function makeDelay(ctx, dest, mix) {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const d = ctx.createDelay(1);
  const fb = ctx.createGain();
  const f = ctx.createBiquadFilter();
  d.delayTime.value = 0.28;
  fb.gain.value = 0.32;
  wet.gain.value = mix;
  dry.gain.value = 1;
  f.type = "lowpass";
  f.frequency.value = 2400;
  dry.connect(dest);
  wet.connect(dest);
  d.connect(f);
  f.connect(fb);
  fb.connect(d);
  f.connect(wet);
  const input = ctx.createGain();
  input.connect(dry);
  input.connect(d);
  return input;
}

function scheduleTrack(ctx, dest, track, when, offset = 0, playFor = Infinity) {
  const total = trackDuration(track);
  const bus = ctx.createGain();
  const delayed = makeDelay(ctx, dest, track.fx?.delay || 0);
  bus.connect(delayed);

  const six = 60 / track.bpm / 4;
  const startStep = Math.floor(offset / six);
  const endTime = offset + playFor;

  const drums = track.drums || {};
  for (const [name, pattern] of Object.entries(drums)) {
    const p = pat(pattern);
    if (!p.length) continue;
    for (let bar = 0; bar < track.bars; bar++) {
      for (let s = 0; s < 16; s++) {
        const vel = p[s % p.length];
        if (!vel) continue;
        const st = stepTime(track, bar, s);
        if (st + 0.001 < offset || st > endTime) continue;
        const t = when + (st - offset);
        if (name === "kick") hitKick(ctx, bus, t, vel);
        else if (name === "snare") hitSnare(ctx, bus, t, vel);
        else if (name === "hat") hitHat(ctx, bus, t, vel * 0.7, false);
        else if (name === "clap") hitClap(ctx, bus, t, vel);
        else hitPerc(ctx, bus, t, vel);
      }
    }
  }

  for (const [b, s, midi, len, vel] of track.bass || []) {
    const st = stepTime(track, b, s);
    const dur = len * six;
    if (st + dur < offset || st > endTime) continue;
    const t = when + Math.max(0, st - offset);
    const cut = st < offset ? dur - (offset - st) : dur;
    if (cut > 0.02) playBass(ctx, bus, t, midi, cut, vel, !!track.fx?.log);
  }
  for (const [b, s, notes, len, vel] of track.pad || []) {
    const st = stepTime(track, b, s);
    const dur = len * six;
    if (st + dur < offset || st > endTime) continue;
    const t = when + Math.max(0, st - offset);
    const cut = st < offset ? dur - (offset - st) : dur;
    if (cut > 0.02) playChord(ctx, bus, t, notes, cut, vel);
  }
  for (const [b, s, midi, len, vel] of track.lead || []) {
    const st = stepTime(track, b, s);
    const dur = len * six;
    if (st + dur < offset || st > endTime) continue;
    const t = when + Math.max(0, st - offset);
    const cut = st < offset ? dur - (offset - st) : dur;
    if (cut > 0.02) playVoice(ctx, bus, t, midi, cut, vel, "lead");
  }

  if (track.fx?.vinyl) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = track.fx.vinyl * 0.08;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(when);
    const stopAt = when + Math.min(playFor, total - offset) + 0.05;
    src.stop(stopAt);
  }

  return { total, stopAt: when + Math.min(playFor, Math.max(0.05, total - offset)) };
}

export async function renderTrack(track, bars = track.bars) {
  const seconds = (bars * 4 * 60) / track.bpm;
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const sliced = { ...track, bars };
  scheduleTrack(ctx, master, sliced, 0, 0, seconds);
  return ctx.startRendering();
}

export function playTrackLive(ctx, dest, track, offset = 0) {
  const g = ctx.createGain();
  g.connect(dest);
  const info = scheduleTrack(ctx, g, track, ctx.currentTime + 0.03, offset, trackDuration(track));
  return { gain: g, ...info };
}

function renderWhoosh(ctx) {
  const t = 0.02;
  hitNoise(ctx, ctx.destination, t, 1, 0.45, 400, 0.5);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.46);
}

function renderImpact(ctx) {
  hitKick(ctx, ctx.destination, 0.01, 1);
  hitNoise(ctx, ctx.destination, 0.01, 0.8, 0.4, 200, 0.6);
}

function renderPop(ctx) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(880, 0.01);
  o.frequency.exponentialRampToValueAtTime(220, 0.12);
  g.gain.setValueAtTime(0.5, 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.14);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(0.01);
  o.stop(0.15);
}

function renderRiser(ctx) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, 0.01);
  o.frequency.exponentialRampToValueAtTime(900, 1.4);
  g.gain.setValueAtTime(0.02, 0.01);
  g.gain.linearRampToValueAtTime(0.22, 1.35);
  g.gain.exponentialRampToValueAtTime(0.0001, 1.5);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(0.01);
  o.stop(1.52);
}

function renderClick(ctx) {
  hitNoise(ctx, ctx.destination, 0.01, 0.8, 0.04, 4000, 0.5);
}

function renderReverse(ctx) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(200, 0.01);
  o.frequency.exponentialRampToValueAtTime(80, 0.7);
  g.gain.setValueAtTime(0.01, 0.01);
  g.gain.linearRampToValueAtTime(0.35, 0.62);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.75);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(0.01);
  o.stop(0.76);
}

const SFX_RENDER = {
  whoosh: [renderWhoosh, 0.5],
  impact: [renderImpact, 0.5],
  pop: [renderPop, 0.2],
  riser: [renderRiser, 1.55],
  click: [renderClick, 0.08],
  reverse: [renderReverse, 0.8],
};

export async function renderSfx(id) {
  const pair = SFX_RENDER[id];
  if (!pair) return null;
  const [fn, sec] = pair;
  const ctx = new OfflineAudioContext(1, Math.ceil(44100 * sec), 44100);
  fn(ctx);
  return ctx.startRendering();
}

export { SFX };

export function detectBeats(buffer) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = 512;
  const env = [];
  for (let i = 0; i < data.length; i += hop) {
    let s = 0;
    const end = Math.min(data.length, i + hop);
    for (let j = i; j < end; j++) s += data[j] * data[j];
    env.push(Math.sqrt(s / (end - i || 1)));
  }
  const flux = [0];
  for (let i = 1; i < env.length; i++) flux.push(Math.max(0, env[i] - env[i - 1]));
  let sum = 0;
  for (const v of flux) sum += v;
  const avg = sum / (flux.length || 1);
  const beats = [];
  let last = -999;
  const minGap = Math.round((0.27 * sr) / hop);
  for (let i = 0; i < flux.length; i++) {
    if (flux[i] > avg * 1.55 && i - last > minGap) {
      beats.push((i * hop) / sr);
      last = i;
    }
  }
  return beats;
}

export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const bytes = n * ch * 2;
  const out = new ArrayBuffer(44 + bytes);
  const v = new DataView(out);
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, bytes, true);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}
