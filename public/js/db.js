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

export class DB {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await openDb();
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
    return this._req(this.tx("projects", "readwrite").put(p));
  }

  getProject(id) {
    return this._req(this.tx("projects").get(id));
  }

  async listProjects() {
    const all = await this._req(this.tx("projects").getAll());
    return (all || []).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }

  deleteProject(id) {
    return this._req(this.tx("projects", "readwrite").delete(id));
  }

  putMedia(rec) {
    return this._req(this.tx("media", "readwrite").put(rec));
  }

  getMedia(id) {
    return this._req(this.tx("media").get(id));
  }

  deleteMedia(id) {
    return this._req(this.tx("media", "readwrite").delete(id));
  }

  getPref(k) {
    return this._req(this.tx("prefs").get(k));
  }

  setPref(k, v) {
    return this._req(this.tx("prefs", "readwrite").put({ k, v }));
  }
}
