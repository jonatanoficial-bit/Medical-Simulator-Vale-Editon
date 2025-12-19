// UI - Screens
window.MedSim = window.MedSim || {};
window.MedSim.UI = window.MedSim.UI || {};

(function(){
  const { qs, qsa, el } = window.MedSim.UI.dom;

  // Parte 5: UI-only state para modal de conteúdo (DLC packs)
  const uiState = {
    contentModalOpen: false,
    lastContentError: null,
  };

  async function refreshContent(engine){
    try{
      uiState.lastContentError = null;
      if (window.MedSim.Data && typeof window.MedSim.Data.loadContent === "function"){
        const res = await window.MedSim.Data.loadContent();
        if (engine && typeof engine.setCases === "function") engine.setCases(res.cases || []);
      }
    }catch(e){
      console.warn("[MedSim] Falha ao atualizar conteúdo", e);
      uiState.lastContentError = String(e && e.message ? e.message : e);
    }
  }

  function safeImg(img){
    // Se não carregar, usa fallback data-url
    img.addEventListener("error", () => {
      const fallback = img.getAttribute("data-fallback");
      if (fallback) img.src = fallback;
    });
  }

  function renderStart(root, state, engine){
    document.body.dataset.scene = "start";
    root.innerHTML = "";
    const hero = el("div", { class:"hero" }, [
      el("div", { class:"heroTop" }, [
        el("div", { class:"heroTitle", text:"Pronto Atendimento — Plantão do Residente" }),
        el("div", { class:"heroSub", text:"Visual cinematográfico + base modular para DLCs" }),
      ]),
      el("div", { class:"heroBadges" }, [
        el("span", { class:"pill", text:"Mobile-first" }),
        el("span", { class:"pill", text:"Simulação + Aprendizado" }),
        el("span", { class:"pill", text:"Arquitetura em camadas" }),
      ])
    ]);
    root.appendChild(hero);

    const card = el("div", { class:"card" }, [
      el("h2", { text: "Perfil do Residente" }),
      el("p", { class:"muted", text:"Escolha seu avatar e inicie o plantão. (Arquitetura Parte 1: base sólida)" })
    ]);

    const nameRow = el("div", { class:"section" }, [
      el("h3", { text:"Nome" }),
      el("input", { id:"playerName", placeholder:"Digite seu nome", value: state.profile?.name || "" })
    ]);

    const avSec = el("div", { class:"section" }, [
      el("h3", { text:"Avatar" }),
      el("div", { class:"avatarGrid", id:"avatarGrid" })
    ]);

    const avatars = window.MedSim.UI.AVATARS || [];
    const selected = state.profile?.avatarUrl || "";

    const grid = qs("#avatarGrid", avSec);
    avatars.forEach(a => {
      const tile = el("div", { class:"avatar" + (selected === a.url ? " selected":"") });
      const img = el("img", { src: a.url, alt: a.label, "data-fallback": a.fallback });
      safeImg(img);
      tile.appendChild(img);
      // Overlay com label cinematografico
      const ov = el("div", { class:"avatarOverlay" }, [
        el("span", { class:"avatarName", text: a.label }),
        el("span", { class:"avatarRole", text: a.role || "Residente" }),
      ]);
      tile.appendChild(ov);
      tile.addEventListener("click", () => {
        qsa(".avatar", grid).forEach(n => n.classList.remove("selected"));
        tile.classList.add("selected");
        tile.dataset.url = a.url;
      });
      tile.dataset.url = a.url;
      grid.appendChild(tile);
    });

    const btns = el("div", { class:"actions" }, [
      el("button", { id:"btnStart", text:"Iniciar Plantão" }),
      el("button", { id:"btnReset", class:"secondary mini", text:"Resetar Save" }),
    ]);

    card.appendChild(nameRow);
    card.appendChild(avSec);
    card.appendChild(btns);

    const right = el("div", { class:"card" }, [
      el("h2", { text:"Visão do Projeto (Parte 1)" }),
      el("p", { class:"muted", text:"• Camadas separadas (UI/Engine/Dados)\n• Engine determinística com eventos\n• Save isolado\n• Conteúdo em JSON/JS (DLC-ready)" }),
      el("div", { class:"section" }, [
        el("h3", { text:"O que já está pronto" }),
        el("ul", { class:"list" }, [
          el("li", { text:"Loop básico: receber caso, coletar dados, solicitar exame, tratar, fechar diagnóstico." }),
          el("li", { text:"Avaliação e feedback educativo após o caso." }),
          el("li", { text:"Progressão simples (XP e nível) e timer de caso." }),
        ])
      ])
    ]);

    const layout = el("div", { class:"grid two" }, [
      el("div", {}, [card]),
      el("div", {}, [right]),
    ]);

    root.appendChild(layout);

    qs("#btnReset").addEventListener("click", () => engine.resetSave());
    qs("#btnStart").addEventListener("click", () => {
      const name = qs("#playerName").value.trim() || "Residente";
      const selTile = qs(".avatar.selected", grid);
      const avatarUrl = selTile ? selTile.dataset.url : (avatars[0]?.url || "");
      engine.start({ name, avatarUrl });
    });
  }

  function renderGame(root, state, engine){
    document.body.dataset.scene = "er";
    root.innerHTML = "";
    const PatientLogic = window.MedSim.Engine.PatientLogic;
    const q = state.queue;
    const patients = (q && q.patients) || [];
    const selected = patients.find(p => p.id === q.selectedId) || patients[0] || null;
    const caseData = selected ? window.MedSim.Data.CASES.find(c => c.id === selected.caseId) : null;

    const hud = el("div", { class:"hud" }, [
      el("div", { class:"hudLeft" }, [
        el("div", { class:"hudItem" }, [el("div", { class:"hudLabel", text:"Cargo/Nível" }), el("div", { class:"hudValue", text:`Residente • Nível ${state.run.level}` })]),
        el("div", { class:"hudItem" }, [el("div", { class:"hudLabel", text:"Pontuação" }), el("div", { class:"hudValue", text:`${state.run.scoreTotal}` })]),
        el("div", { class:"hudItem" }, [el("div", { class:"hudLabel", text:"Óbitos" }), el("div", { class:"hudValue", text:`${state.run.deaths}` })]),
      ]),
      el("div", { class:"hudRight" }, [
        el("div", { class:"pill", text:`Fila: ${patients.length} / ${window.MedSim.Data.CONFIG.simulation.queue.maxPatientsCap}` }),
        el("div", { class:"pill", text:`Próximo paciente: ${Math.round(q.nextArrivalSec)}s` }),
        (function(){
          const cases = (window.MedSim.Data.CASES || []);
          const specialties = Array.from(new Set(cases.map(c => c.specialty).filter(Boolean))).sort();
          const selSpec = el("select", {
            class: "controlSelect",
            onchange: (e) => engine.setContentFilters({ specialty: e.target.value, maxDifficulty: state.content.maxDifficulty })
          }, [
            el("option", { value:"ALL", text:"Todas as áreas" }),
            ...specialties.map(s => el("option", { value:s, text:s, selected: (state.content.specialty === s) }))
          ]);
          const selDiff = el("select", {
            class: "controlSelect",
            onchange: (e) => engine.setContentFilters({ specialty: state.content.specialty, maxDifficulty: Number(e.target.value) })
          }, [1,2,3,4,5].map(n => el("option", { value:String(n), text:`Dificuldade ≤ ${n}`, selected: Number(state.content.maxDifficulty) === n })));
          const btn = el("button", { class:"btnGhost", text:"Conteúdo/DLC", onclick: () => { uiState.contentModalOpen = true; } });
          return el("div", { class:"hudControls" }, [selSpec, selDiff, btn]);
        })(),
      ])
    ]);

    root.appendChild(hud);

    const queueCard = el("div", { class:"card" }, [
      el("h2", { text:"Sala de Espera" }),
      el("p", { class:"muted", text:"Toque/clique em um paciente para atender. (Parte 2: múltiplos pacientes + deterioração)" }),
      el("div", { class:"queueList" }, patients.map(p => {
        const c = window.MedSim.Data.CASES.find(x => x.id === p.caseId);
        const tri = PatientLogic.triageMeta(p.triage);
        const isSel = p.id === q.selectedId;
        const row = el("div", { class:`queueRow ${isSel ? "selected" : ""}`, onclick: () => engine.selectPatient(p.id) }, [
          el("div", { class:`triage ${tri.cls}`, text: tri.label }),
          el("div", { class:"queueMain" }, [
            el("div", { class:"queueName", text: (c ? c.patient.name : "Paciente") + ` • ${c ? c.patient.age : "?"}a` }),
            el("div", { class:"queueCc", text: c ? c.title : "—" }),
          ]),
          el("div", { class:`statusPill s_${p.statusVital.toLowerCase()}`, text: p.statusVital }),
          el("div", { class:"queueTimer", text: `${Math.round(p.timeToNextStageSec)}s` }),
        ]);
        return row;
      }))
    ]);

    const left = el("div", { class:"card" }, [
      el("h2", { text: selected && caseData ? `${caseData.patient.name} • ${caseData.patient.age}a` : "Nenhum paciente" }),
      selected && caseData ? el("div", { class:"kpi" }, [
        el("span", { class:"pill", text: caseData.specialty }),
        el("span", { class:"pill", text: `Triagem: ${PatientLogic.triageMeta(selected.triage).label}` }),
        el("span", { class:"pill", text: `Estado: ${selected.statusVital}` }),
      ]) : el("p", { class:"muted", text:"Aguardando pacientes..." }),
      selected && caseData ? el("div", { class:"panel" }, [
        el("div", { class:"section" }, [
          el("h3", { text:"Queixa principal" }),
          el("div", { text: selected.revealed.chiefComplaint })
        ]),
        el("div", { class:"section" }, [
          el("h3", { text:"História clínica" }),
          selected.revealed.history ? el("ul", { class:"list" }, selected.revealed.history.map(x => el("li", { text:x }))) :
            el("p", { class:"muted", text:"Ainda não coletada." })
        ]),
        el("div", { class:"section" }, [
          el("h3", { text:"Exame físico" }),
          selected.revealed.physical ? el("ul", { class:"list" }, selected.revealed.physical.map(x => el("li", { text:x }))) :
            el("p", { class:"muted", text:"Ainda não realizado." })
        ]),
      ]) : null
    ].filter(Boolean));

    const actionsCard = el("div", { class:"card" }, [
      el("h2", { text:"Ações Clínicas" }),
      el("p", { class:"muted", text:"As ações se aplicam ao paciente selecionado." }),
      el("div", { class:"actions" }, [
        el("button", { class:"mini secondary", text:"Coletar História", onclick: () => engine.doHistory() }),
        el("button", { class:"mini secondary", text:"Exame Físico", onclick: () => engine.doPhysical() }),
        el("button", { class:"mini secondary", text:"ECG", onclick: () => engine.requestExam("ecg") }),
        el("button", { class:"mini secondary", text:"LABS", onclick: () => engine.requestExam("labs") }),
        el("button", { class:"mini secondary", text:"RX", onclick: () => engine.requestExam("xray") }),
        el("button", { class:"mini secondary", text:"O2", onclick: () => engine.applyTreatment("oxygen") }),
        el("button", { class:"mini secondary", text:"AAS", onclick: () => engine.applyTreatment("aspirin") }),
        el("button", { class:"mini secondary", text:"Antibiótico", onclick: () => engine.applyTreatment("antibiotics") }),
        el("button", { class:"mini secondary", text:"Adrenalina", onclick: () => engine.applyTreatment("epinephrine") }),
      ]),
      el("div", { class:"section" }, [
        el("h3", { text:"Diagnóstico final" }),
        el("div", { class:"actions" }, [
          el("input", { id:"dxInput", placeholder:"Digite o diagnóstico final (ex: Anafilaxia)" }),
          el("button", { id:"btnDx", text:"Confirmar" })
        ])
      ]),
    ]);

    const resultsCard = el("div", { class:"card" }, [
      el("h2", { text:"Resultados (paciente selecionado)" }),
      el("div", { class:"examResults", id:"examResults" })
    ]);

    const examResults = (selected && selected.session && selected.session.actions.examResults) || {};
    const container = resultsCard.querySelector("#examResults");
    const keys = Object.keys(examResults);
    if (!selected) {
      container.appendChild(el("p", { class:"muted", text:"Selecione um paciente." }));
    } else if (!keys.length){
      container.appendChild(el("p", { class:"muted", text:"Nenhum exame solicitado ainda." }));
    } else {
      keys.forEach(k => {
        const r = examResults[k];
        const text = r.ready ? r.text : "Aguardando...";
        container.appendChild(el("div", { class:"result" }, [
          el("div", { class:"tag", text: k.toUpperCase() + (r.ready ? "" : " • PENDENTE") }),
          el("div", { class:"text", text })
        ]));
      });
    }

    const feedbackCard = el("div", { class:"card" }, [
      el("h2", { text:"Feedback recente" }),
      state.recentFeedbacks.length ?
        el("div", { class:"section" }, state.recentFeedbacks.map(fb => {
          const ok = fb.evaluation.correctDiag;
          return el("div", { class:"miniFb" }, [
            el("div", { class:`tag ${ok ? "ok" : "bad"}`, text: ok ? "ACERTO" : "ERRO" }),
            el("div", { class:"text" , text: fb.caseTitle + " • Score: " + fb.evaluation.score }),
          ]);
        }))
        : el("p", { class:"muted", text:"Sem feedback ainda (níveis altos não pausam)." })
    ]);

    const logCard = el("div", { class:"card" }, [
      el("h2", { text:"Log do Plantão" }),
      el("div", { class:"section" }, [
        el("div", { class:"log", id:"logText", text: state.log.map(x => "["+x.t.slice(11,19)+"] "+x.line).join("\n") })
      ])
    ]);

    const layout = el("div", { class:"grid three" }, [
      el("div", {}, [queueCard, left]),
      el("div", {}, [actionsCard, resultsCard]),
      el("div", {}, [feedbackCard, logCard]),
    ]);

    root.appendChild(layout);

    const btnDx = qs("#btnDx", actionsCard);
    if (btnDx) btnDx.addEventListener("click", () => {
      const dx = qs("#dxInput", actionsCard).value.trim();
      if (!dx) return;
      engine.diagnose(dx);
    });
  }

  function renderFeedbackModal(modalOverlay, state, engine){
    if (state.status !== "FEEDBACK" || !state.feedback){
      modalOverlay.classList.remove("show");
      modalOverlay.innerHTML = "";
      return;
    }

    modalOverlay.classList.add("show");
    modalOverlay.innerHTML = "";

    const fb = state.feedback;
    const ev = fb.evaluation;

    const modal = el("div", { class:"modal" }, [
      el("h2", { text: "Resultado do Caso" }),
      el("p", { class:"muted", text: fb.caseTitle }),
      el("div", { class:"columns" }, [
        el("div", { class:"section" }, [
          el("h3", { text:"Diagnóstico" }),
          el("p", {}, [
            el("span", { class: ev.correctDiag ? "badgeOk":"badgeBad", text: ev.correctDiag ? "CORRETO" : "INCORRETO" }),
            document.createTextNode(" • Você: " + fb.chosenDiagnosis),
            el("br"),
            document.createTextNode("Correto: " + fb.correctDiagnosis),
          ]),
          el("h3", { text:"Pontuação" }),
          el("p", { text: "Score do caso: " + ev.score + " (bônus tempo: +" + ev.timeBonus + ", tempo: " + ev.elapsedSec + "s)" }),
        ]),
        el("div", { class:"section" }, [
          el("h3", { text:"Feedback Educativo" }),
          el("p", { text: fb.education?.summary || "" }),
          el("ul", { class:"list" }, (fb.education?.keyPoints || []).map(x => el("li", { text:x })))
        ])
      ]),
      el("div", { class:"columns" }, [
        el("div", { class:"section" }, [
          el("h3", { text:"Acertos" }),
          ev.positives.length ? el("ul", { class:"list" }, ev.positives.map(x => el("li", { text:x }))) :
            el("p", { class:"muted", text:"—" })
        ]),
        el("div", { class:"section" }, [
          el("h3", { text:"Erros/Omissões" }),
          ev.errors.length ? el("ul", { class:"list" }, ev.errors.map(x => el("li", { text:x }))) :
            el("p", { class:"muted", text:"—" })
        ])
      ]),
      el("div", { class:"footerBtns" }, [
        el("button", { class:"secondary", text:"Encerrar (voltar ao início)", onclick: () => engine.resetSave() }),
        el("button", { text:"Próximo Paciente", onclick: () => engine.continueAfterFeedback() }),
      ])
    ]);

    modalOverlay.appendChild(modal);
  }

  // Parte 5: Modal de Conteúdo (packs/DLC)
  function renderContentModal(overlay, state, engine){
    if (!overlay) return;
    const open = !!uiState.contentModalOpen;
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    overlay.classList.toggle("show", open);
    overlay.innerHTML = "";
    if (!open) return;

    const packs = (window.MedSim.Data && window.MedSim.Data.PACKS) ? window.MedSim.Data.PACKS : [];
    const header = el("div", { class:"modalHeader" }, [
      el("div", { class:"modalTitle", text:"Conteúdo e DLCs" }),
      el("button", { class:"btnGhost", text:"Fechar", onclick: () => { uiState.contentModalOpen = false; } })
    ]);

    const list = el("div", { class:"modalBody" }, [
      el("p", { class:"muted", text:"Ative/desative pacotes. Em versão comercial, cada pack pode ser um DLC separado." }),
      uiState.lastContentError ? el("div", { class:"alert", text:`Erro: ${uiState.lastContentError}` }) : null,
      ...packs.map(p => {
        const row = el("label", { class:"packRow" }, [
          el("input", { type:"checkbox", checked: !!p.enabled, onchange: async (e) => {
            if (window.MedSim.Data && typeof window.MedSim.Data.setPackEnabled === "function"){
              window.MedSim.Data.setPackEnabled(p.id, e.target.checked);
              await refreshContent(engine);
            }
          }}),
          el("span", { class:"packName", text: p.name }),
          el("span", { class:"packMeta", text: `${p.id} • v${p.version}` })
        ]);
        return row;
      }).filter(Boolean),
      el("div", { class:"modalActions" }, [
        el("button", { class:"btnPrimary", text:"Recarregar conteúdo", onclick: async () => { await refreshContent(engine); } }),
      ])
    ].filter(Boolean));

    const card = el("div", { class:"modalCard" }, [header, list]);
    overlay.appendChild(card);
    overlay.onclick = (ev) => {
      if (ev.target === overlay) uiState.contentModalOpen = false;
    };
  }

  window.MedSim.UI.renderStart = renderStart;
  window.MedSim.UI.renderGame = renderGame;
  window.MedSim.UI.renderFeedbackModal = renderFeedbackModal;
  window.MedSim.UI.renderContentModal = renderContentModal;
})();
