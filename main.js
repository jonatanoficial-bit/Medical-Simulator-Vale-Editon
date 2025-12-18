// App bootstrap
window.MedSim = window.MedSim || {};

(function(){
  const engine = new window.MedSim.Engine.GameEngine();

  const root = document.getElementById("app");
  const modalOverlay = document.getElementById("modalOverlay");

  function render(state){
    if (state.status === "START"){
      window.MedSim.UI.renderStart(root, state, engine);
    } else if (state.status === "RUNNING"){
      window.MedSim.UI.renderGame(root, state, engine);
    }
    window.MedSim.UI.renderFeedbackModal(modalOverlay, state, engine);
  }

  engine.onState(render);
  engine.bootstrap();
})();
