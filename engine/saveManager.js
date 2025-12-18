// Engine - SaveManager
// Persistência isolada para não espalhar localStorage pela UI/engine.

window.MedSim = window.MedSim || {};
window.MedSim.Engine = window.MedSim.Engine || {};

window.MedSim.Engine.SaveManager = function SaveManager(options) {
  const key = (options && options.storageKey) ? options.storageKey : "medsim.save.part1";
  const schemaVersion = (options && options.schemaVersion) || 1;

  function load() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== schemaVersion) return null;
      return parsed;
    } catch (e) {
      console.warn("SaveManager.load failed", e);
      return null;
    }
  }

  function save(payload) {
    try {
      const data = { schemaVersion, ...payload, savedAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("SaveManager.save failed", e);
      return false;
    }
  }

  function clear() {
    try { localStorage.removeItem(key); } catch {}
  }

  return { load, save, clear };
};
