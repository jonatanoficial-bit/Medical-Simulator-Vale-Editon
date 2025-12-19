// Engine - CaseRepository
// Interface única para acesso aos casos (hoje local). Amanhã pode ser DLC/API/IndexedDB.

window.MedSim = window.MedSim || {};
window.MedSim.Engine = window.MedSim.Engine || {};

window.MedSim.Engine.CaseRepository = function CaseRepository(casesArray) {
  const all = Array.isArray(casesArray) ? casesArray.slice() : [];
  const byId = new Map(all.map(c => [c.id, c]));

  function getAll() { return all.slice(); }
  function getById(id) { return byId.get(id) || null; }

  function getRandom(filterFn) {
    const pool = typeof filterFn === "function" ? all.filter(filterFn) : all;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return { getAll, getById, getRandom };
};
