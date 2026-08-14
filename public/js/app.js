import { DB } from "./db.js";
import { Store } from "./store.js";
import { Engine } from "./engine.js";
import { UI } from "./ui.js";

const db = new DB();
const store = new Store();
const engine = new Engine(store, db);
const ui = new UI({ root: document.getElementById("app"), store, db, engine });

async function boot() {
  await db.init();
  const unlock = () => engine.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", (e) => {
    if (!store.project) return;
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      engine.toggle();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      ui.saveDraft(true);
    }
    if (e.key === "s" && !e.ctrlKey && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") ui.split();
    if (e.key === "Delete" || e.key === "Backspace") {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      ui.removeSelected();
    }
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  await ui.showHome();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML =
    `<div class="home"><h1>TAKT</h1><p>Could not start. Open this from the TAKT window on your PC, not as a raw file.</p></div>`;
});
