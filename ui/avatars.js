// UI - Avatares
window.MedSim = window.MedSim || {};
window.MedSim.UI = window.MedSim.UI || {};

(function(){
  // Tenta usar imagens existentes na pasta /images se você colocar com esses nomes.
  // Você pode substituir por fotos cinematográficas reais depois (Parte 5).
  const fallback = [
    "images/avatar_01.png",
    "images/avatar_02.png",
    "images/avatar_03.png",
    "images/avatar_04.png",
    "images/avatar_05.png",
    "images/avatar_06.png",
  ];

  // Se essas imagens não existirem, geramos SVG inline (sem dependências).
  function svgData(name, a, b){
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='${a}'/>
          <stop offset='1' stop-color='${b}'/>
        </linearGradient>
      </defs>
      <rect width='512' height='512' rx='64' fill='url(#g)'/>
      <circle cx='256' cy='214' r='94' fill='rgba(7,16,24,.58)'/>
      <rect x='120' y='318' width='272' height='150' rx='70' fill='rgba(7,16,24,.58)'/>
      <text x='256' y='484' font-size='26' text-anchor='middle' fill='rgba(230,241,255,.85)' font-family='Arial'>${name}</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const generated = [
    svgData("DR", "#4fd1c5", "#60a5fa"),
    svgData("MD", "#60a5fa", "#a78bfa"),
    svgData("RN", "#22c55e", "#60a5fa"),
    svgData("PS", "#f59e0b", "#ef4444"),
    svgData("ICU", "#38bdf8", "#4fd1c5"),
    svgData("ER", "#fb7185", "#60a5fa"),
  ];

  window.MedSim.UI.AVATARS = fallback.map((url, i) => ({
    id: "avatar_" + (i+1),
    label: "Avatar " + (i+1),
    url,
    fallback: generated[i]
  }));
})();
