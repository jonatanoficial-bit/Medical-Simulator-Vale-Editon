// UI - Avatares (Parte 3: realistas + layout cinematográfico)
window.MedSim = window.MedSim || {};
window.MedSim.UI = window.MedSim.UI || {};

(function(){
  // Avatares locais (você pode substituir por fotos suas do GitHub depois).
  const urls = [
    "images/avatar_01.png",
    "images/avatar_02.png",
    "images/avatar_03.png",
    "images/avatar_04.png",
    "images/avatar_05.png",
    "images/avatar_06.png",
  ];

  // Labels e "papéis" para dar clima cinematográfico.
  const labels = [
    "Dra. Camila",
    "Dr. Rafael",
    "Dra. Júlia",
    "Dr. Henrique",
    "Dra. Larissa",
    "Dr. Bruno",
  ];

  const roles = [
    "R1 • Clínica",
    "R1 • Cirurgia",
    "R1 • Pediatria",
    "R2 • Emergência",
    "R2 • UTI",
    "Plantão • PS",
  ];

  // Fallback SVG (caso alguma imagem não exista no build)
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

  window.MedSim.UI.AVATARS = urls.map((url, i) => ({
    id: "avatar_" + (i+1),
    label: labels[i] || ("Avatar " + (i+1)),
    role: roles[i] || "Residente",
    url,
    fallback: generated[i]
  }));
})();
