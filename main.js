// App bootstrap
window.MedSim = window.MedSim || {};

(async function(){
  // Cena inicial
  try{ document.body.dataset.scene = "start"; }catch(e){}

  // Verificação leve de assets (não bloqueia o jogo)
  function verifyAssets(urls){
    urls.forEach(u => {
      const img = new Image();
      img.onload = () => void 0;
      img.onerror = () => console.warn("[MedSim] Asset ausente ou falhou ao carregar:", u);
      img.src = u;
    });
  }
  verifyAssets([
    "images/bg_hospital_01.jpg",
    "images/bg_hospital_02.jpg",
    "images/avatar_01.png",
    "images/avatar_02.png",
    "images/avatar_03.png",
    "images/avatar_04.png",
    "images/avatar_05.png",
    "images/avatar_06.png",
  ]);

  // Carrega conteúdo (Base + DLCs) antes de iniciar a engine.
  // Mantém o jogo funcional mesmo se algum pack falhar (logs no console).
  try{
    if (window.MedSim.Data && typeof window.MedSim.Data.loadContent === "function"){
      await window.MedSim.Data.loadContent();
    }
  }catch(e){
    console.warn("[MedSim] Falha ao carregar conteúdo. Usando fallback se existir.", e);
  }

  const engine = new window.MedSim.Engine.GameEngine({ cases: (window.MedSim.Data && window.MedSim.Data.CASES) || [] });

  const root = document.getElementById("app");
  const modalOverlay = document.getElementById("modalOverlay");
  const contentOverlay = document.getElementById("contentOverlay");

  function render(state){
    if (state.status === "START"){
      window.MedSim.UI.renderStart(root, state, engine);
    } else if (state.status === "RUNNING"){
      window.MedSim.UI.renderGame(root, state, engine);
    }
    window.MedSim.UI.renderFeedbackModal(modalOverlay, state, engine);
    window.MedSim.UI.renderContentModal(contentOverlay, state, engine);
  }

  engine.onState(render);
  engine.bootstrap();
})();
