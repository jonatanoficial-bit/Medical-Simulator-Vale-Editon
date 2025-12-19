// Data - Content Loader (DLC packs)
// Carrega pacotes de conteúdo (casos/manifest) de forma modular.
// Para produto comercial: este loader permite separar Base e DLCs.
window.MedSim = window.MedSim || {};
window.MedSim.Data = window.MedSim.Data || {};

(function(){
  const STORAGE_KEY = "medsim_enabled_packs_v1";

  async function fetchJson(url){
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Falha ao carregar ${url}: ${res.status}`);
    return await res.json();
  }

  function loadEnabledOverride(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    }catch(e){ return null; }
  }

  function saveEnabledOverride(map){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }catch(e){}
  }

  async function loadPacks(){
    const idx = await fetchJson("content/packs.json");
    const packRefs = Array.isArray(idx.packs) ? idx.packs : [];
    const manifests = [];
    for (const ref of packRefs){
      try{
        const man = await fetchJson(ref.manifest);
        manifests.push({ ref, manifest: man });
      }catch(e){
        console.warn("[MedSim] Ignorando pack (manifest falhou):", ref, e);
      }
    }

    const override = loadEnabledOverride();
    const enabledMap = {};
    for (const { manifest } of manifests){
      enabledMap[manifest.id] = override ? !!override[manifest.id] : !!manifest.enabledByDefault;
    }

    const allCases = [];
    const loadedPacks = [];
    for (const { ref, manifest } of manifests){
      const enabled = !!enabledMap[manifest.id];
      loadedPacks.push({ id: manifest.id, name: manifest.name, version: manifest.version, enabled, manifest });
      if (!enabled) continue;
      const baseUrl = ref.manifest.replace(/\/manifest\.json$/, "");
      const casesUrl = `${baseUrl}/${manifest.casesFile}`;
      try{
        const packCases = await fetchJson(casesUrl);
        if (Array.isArray(packCases)){
          // Tag do pack para filtros/relatórios
          packCases.forEach(c => { c._pack = manifest.id; });
          allCases.push(...packCases);
        }
      }catch(e){
        console.warn("[MedSim] Falha ao carregar casos do pack:", manifest.id, e);
      }
    }

    // Remove duplicados por id (primeiro vence)
    const seen = new Set();
    const dedup = [];
    for (const c of allCases){
      if (!c || !c.id) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      dedup.push(c);
    }

    window.MedSim.Data.CASES = dedup;
    window.MedSim.Data.PACKS = loadedPacks;
    window.MedSim.Data.setPackEnabled = function(packId, enabled){
      enabledMap[packId] = !!enabled;
      saveEnabledOverride(enabledMap);
    };

    return { cases: dedup, packs: loadedPacks };
  }

  window.MedSim.Data.loadContent = loadPacks;
})();
