const APP = "TAKT";
const HOSTS = [
  "https://api.audius.co",
  "https://discoveryprovider.audius.co",
];

export const SONG_GENRES = [
  "For you",
  "Trap",
  "Drill",
  "House",
  "Lo-fi",
  "Amapiano",
  "Phonk",
  "Pop",
  "R&B",
  "Rap",
  "EDM",
  "Afro",
];

const GENRE_QUERY = {
  Trap: "trap beat",
  Drill: "drill beat",
  House: "house music",
  "Lo-fi": "lofi beats",
  Amapiano: "amapiano",
  Phonk: "phonk",
  Pop: "pop",
  "R&B": "rnb soul",
  Rap: "rap hip hop",
  EDM: "edm dance",
  Afro: "afrobeats",
};

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("audius " + r.status);
  return r.json();
}

function normalize(t) {
  const art = t.artwork || {};
  return {
    id: "au_" + t.id,
    audiusId: t.id,
    title: t.title || "Untitled",
    artist: (t.user && (t.user.name || t.user.handle)) || "Artist",
    duration: t.duration || 30,
    genre: t.genre || "",
    mood: t.mood || "",
    art: art["150x150"] || art["480x480"] || "",
    color: "#3dffc4",
    streamUrl: `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=${APP}`,
  };
}

export async function searchSongs(query, genre = "For you") {
  const q = (query || "").trim() || (genre !== "For you" ? GENRE_QUERY[genre] || genre : "");
  const path = q
    ? `/v1/tracks/search?query=${encodeURIComponent(q)}&limit=24&app_name=${APP}`
    : `/v1/tracks/trending?limit=24&app_name=${APP}`;
  let lastErr;
  for (const host of HOSTS) {
    try {
      const data = await getJson(host + path);
      const list = (data.data || []).map(normalize);
      if (list.length) return list;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

export async function fetchSongBlob(audiusId) {
  const urls = [
    `https://discoveryprovider.audius.co/v1/tracks/${audiusId}/stream?app_name=${APP}`,
    `https://api.audius.co/v1/tracks/${audiusId}/stream?app_name=${APP}`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const blob = await r.blob();
      if (blob && blob.size > 8000) {
        const type = blob.type && blob.type.startsWith("audio") ? blob.type : "audio/mpeg";
        return blob.slice(0, blob.size, type);
      }
    } catch {}
  }
  throw new Error("Could not pull that song");
}
