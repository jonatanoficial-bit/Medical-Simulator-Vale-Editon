// UI - Helpers DOM
window.MedSim = window.MedSim || {};
window.MedSim.UI = window.MedSim.UI || {};

window.MedSim.UI.dom = {
  qs(sel, root=document){ return root.querySelector(sel); },
  qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); },
  el(tag, attrs={}, children=[]){
    const e = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)){
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children){
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }
};
