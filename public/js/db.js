const DB_NAME = "takt";
const DB_VER = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", { keyPath: "id" });
      if (!db.objectStoreNames.contains("prefs")) db.createObjectStore("prefs", { keyPath: "k" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class MemoryDB {
  constructor() {
    this.projects = new Map();
    this.media = new Map();
    this.prefs = new Map();
    try {
      const raw = localStorage.getItem("takt-projects");
      if (raw) for (const p of JSON.parse(raw)) this.projects.set(p.id, p);
    } catch {}
  }
  persist() {
    try {
      localStorage.setItem("takt-projects", JSON.stringify([...this.projects.values()]));
    } catch {}
  }
}

export class DB {
  constructor() {
    this.db = null;
    this.mem = null;
  }

  async init() {
    try {
      this.db = await openDb();
    } catch {
      this.mem = new MemoryDB();
    }
  }

  tx(store, mode = "readonly") {
    return this.db.transaction(store, mode).objectStore(store);
  }

  _req(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  putProject(p) {
    if (this.mem) {
      this.mem.projects.set(p.id, p);
      this.mem.persist();
      return p;
    }
    return this._req(this.tx("projects", "readwrite").put(p));
  }

  getProject(id) {
    if (this.mem) return this.mem.projects.get(id);
    return this._req(this.tx("projects").get(id));
  }

  async listProjects() {
    if (this.mem) {
      return [...this.mem.projects.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0));
    }
    const all = await this._req(this.tx("projects").getAll());
    return (all || []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }

  deleteProject(id) {
    if (this.mem) {
      this.mem.projects.delete(id);
      this.mem.persist();
      return;
    }
    return this._req(this.tx("projects", "readwrite").delete(id));
  }

  putMedia(rec) {
    if (this.mem) {
      this.mem.media.set(rec.id, rec);
      return rec;
    }
    return this._req(this.tx("media", "readwrite").put(rec));
  }

  getMedia(id) {
    if (this.mem) return this.mem.media.get(id);
    return this._req(this.tx("media").get(id));
  }

  deleteMedia(id) {
    if (this.mem) {
      this.mem.media.delete(id);
      return;
    }
    return this._req(this.tx("media", "readwrite").delete(id));
  }

  getPref(k) {
    if (this.mem) return this.mem.prefs.get(k);
    return this._req(this.tx("prefs").get(k));
  }

  setPref(k, v) {
    if (this.mem) {
      this.mem.prefs.set(k, { k, v });
      return;
    }
    return this._req(this.tx("prefs", "readwrite").put({ k, v }));
  }
}
