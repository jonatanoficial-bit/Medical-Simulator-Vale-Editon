// Engine - GameEngine
// Parte 2: fila + múltiplos pacientes + deterioração por estados.
// Mantém: camadas separadas, dados configuráveis e engine determinística.

window.MedSim = window.MedSim || {};
window.MedSim.Engine = window.MedSim.Engine || {};

(function () {
  const CONFIG = window.MedSim.Data.CONFIG;
  // Casos são carregados pelo ContentLoader (Base + DLCs) antes do bootstrap.

  const createEventBus = window.MedSim.Engine.createEventBus;
  const CaseRepository = window.MedSim.Engine.CaseRepository;
  const SaveManager = window.MedSim.Engine.SaveManager;
  const PatientLogic = window.MedSim.Engine.PatientLogic;

  function nowMs() { return Date.now(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function computeTimeBonus(elapsedSec) {
    const win = CONFIG.scoring.timeBonusWindowSec;
    const max = CONFIG.scoring.timeBonusMax;
    if (elapsedSec <= 0) return max;
    if (elapsedSec >= win) return 0;
    return Math.round(max * (1 - (elapsedSec / win)));
  }

  function evaluateCase(caseData, session) {
    const actions = session.actions;
    const requiredExams = caseData.correct.requiredExams || [];
    const requiredTreatments = caseData.correct.requiredTreatments || [];
    const helpfulExams = caseData.correct.helpfulExams || [];

    const missingRequiredExams = requiredExams.filter(k => !actions.exams.has(k));
    const missingTreatments = requiredTreatments.filter(k => !actions.treatments.has(k));

    const didHistory = actions.flags.history === true;
    const didPhysical = actions.flags.physical === true;

    let score = 0;
    const errors = [];
    const positives = [];

    const correctDiag = session.finalDiagnosis && session.finalDiagnosis === caseData.correct.diagnosis;
    if (correctDiag) {
      score += CONFIG.scoring.baseCorrect;
      positives.push("Diagnóstico correto.");
    } else {
      score += CONFIG.scoring.baseWrong;
      errors.push("Diagnóstico incorreto.");
    }

    if (didHistory) positives.push("História clínica realizada.");
    else errors.push("História clínica não realizada.");

    if (didPhysical) positives.push("Exame físico realizado.");
    else errors.push("Exame físico não realizado.");

    if (missingRequiredExams.length) {
      errors.push("Exames essenciais não solicitados: " + missingRequiredExams.join(", "));
      score -= 25 * missingRequiredExams.length;
    } else if (requiredExams.length) {
      positives.push("Exames essenciais solicitados.");
    }

    const didHelpful = helpfulExams.filter(k => actions.exams.has(k));
    if (didHelpful.length) positives.push("Exames úteis solicitados: " + didHelpful.join(", "));

    if (missingTreatments.length) {
      errors.push("Condutas essenciais ausentes: " + missingTreatments.join(", "));
      score -= 35 * missingTreatments.length;
    } else if (requiredTreatments.length) {
      positives.push("Condutas essenciais realizadas.");
    }

    // Parte 2 ainda mantém flags como “escape hatch” para testes, mas a tendência é
    // migrar para regras automáticas (ex.: alta indevida virar regra pela gravidade).
    if (actions.flags.send_home) {
      errors.push("Erro crítico: alta indevida em caso potencialmente grave.");
      score -= CONFIG.scoring.criticalPenalty;
    }
    if (actions.flags.no_antibiotics) {
      errors.push("Erro crítico: pneumonia sem antibiótico.");
      score -= CONFIG.scoring.criticalPenalty;
    }
    if (actions.flags.delay_epi) {
      errors.push("Erro crítico: adrenalina não foi administrada prontamente.");
      score -= CONFIG.scoring.criticalPenalty;
    }

    const elapsedSec = Math.max(0, Math.round((session.endedAtMs - session.startedAtMs) / 1000));
    const timeBonus = computeTimeBonus(elapsedSec);
    score += timeBonus;

    score = clamp(score, 0, 9999);

    return { correctDiag, score, timeBonus, elapsedSec, positives, errors };
  }

  function createEmptyRun() {
    return {
      level: CONFIG.progression.startingLevel,
      xp: 0,
      scoreTotal: 0,
      casesCompleted: 0,
      correctCount: 0,
      wrongCount: 0,
      deaths: 0,
    };
  }

  function maxPatientsForLevel(level) {
    const q = CONFIG.simulation.queue;
    const extra = Math.floor(Math.max(0, level - 1) / q.levelStepForMorePatients);
    return clamp(q.maxPatientsBase + extra, q.maxPatientsBase, q.maxPatientsCap);
  }

  function arrivalIntervalForLevel(level) {
    const q = CONFIG.simulation.queue;
    const v = q.arrivalBaseSec - (q.arrivalDecaySecPerLevel * (level - 1));
    return clamp(v, q.arrivalMinSec, q.arrivalBaseSec);
  }

  window.MedSim.Engine.GameEngine = function GameEngine(opts) {
    const bus = createEventBus();
    let repo = CaseRepository((opts && opts.cases) ? opts.cases : (window.MedSim.Data.CASES || []));
    const saves = SaveManager({ storageKey: CONFIG.persistence.storageKey, schemaVersion: CONFIG.schemaVersion });

    let state = {
      status: "BOOT", // BOOT | START | RUNNING | FEEDBACK
      profile: { name: "", avatarUrl: "" },
      run: createEmptyRun(),
      queue: {
        patients: [],
        selectedId: null,
        nextArrivalSec: arrivalIntervalForLevel(CONFIG.progression.startingLevel),
      },
      feedback: null,
      recentFeedbacks: [], // usado quando não pausa (níveis altos)
      log: [],
      content: {
        // filtros de seleção de casos (UI controla)
        specialty: "ALL",
        maxDifficulty: 5,
      },
    };

    let tickInterval = null;

    function log(line) {
      state.log.push({ t: new Date().toISOString(), line });
      if (state.log.length > CONFIG.ui.maxLogLines) state.log.shift();
    }

    function emitState() { bus.emit("state", getState()); }
    function getState() { return JSON.parse(JSON.stringify(state)); }
    function setStatus(next) { state.status = next; }

    function resetRun() {
      state.run = createEmptyRun();
      state.queue.patients = [];
      state.queue.selectedId = null;
      state.queue.nextArrivalSec = arrivalIntervalForLevel(state.run.level);
      state.feedback = null;
      state.recentFeedbacks = [];
      state.log = [];
    }

    function saveProgress() { saves.save({ profile: state.profile, run: state.run }); }
    function loadProgress() {
      const saved = saves.load();
      if (!saved) return false;
      if (saved.profile) state.profile = saved.profile;
      if (saved.run) state.run = { ...createEmptyRun(), ...saved.run };
      state.queue.nextArrivalSec = arrivalIntervalForLevel(state.run.level);
      return true;
    }

    function getCaseById(caseId) { return repo.getById(caseId); }
    function getSelectedPatient() {
      const id = state.queue.selectedId;
      return state.queue.patients.find(p => p.id === id) || null;
    }

    function selectPatient(patientId) {
      const exists = state.queue.patients.some(p => p.id === patientId);
      if (!exists) return;
      state.queue.selectedId = patientId;
      emitState();
    }

    function spawnPatient() {
      const maxDiff = clamp(state.run.level, 1, 5);
      const maxByUser = clamp(Number(state.content.maxDifficulty || 5), 1, 5);
      const specialty = state.content.specialty || "ALL";
      const caseData = repo.getRandom(c => {
        if (!c) return false;
        if (c.difficulty > Math.min(maxDiff, maxByUser)) return false;
        if (specialty !== "ALL" && c.specialty !== specialty) return false;
        return true;
      });
      if (!caseData) return null;

      const p = PatientLogic.createPatientInstance(caseData);
      state.queue.patients.push(p);
      if (!state.queue.selectedId) state.queue.selectedId = p.id;
      log(`Novo paciente (${PatientLogic.triageMeta(p.triage).label}): ${caseData.patient.name} (${caseData.patient.age}a).`);
      return p;
    }

    function setCases(casesArray){
      repo = CaseRepository(Array.isArray(casesArray) ? casesArray : []);
      log("Conteúdo atualizado (packs/DLC). Novos casos disponíveis para próximos pacientes.");
      emitState();
    }

    function setContentFilters(next){
      state.content = { ...state.content, ...(next || {}) };
      emitState();
    }

    function ensurePatientsOnStart() {
      const target = Math.max(1, Math.min(2, maxPatientsForLevel(state.run.level)));
      while (state.queue.patients.length < target) spawnPatient();
    }

    function start(profile) {
      state.profile = { name: profile.name, avatarUrl: profile.avatarUrl };
      resetRun();
      setStatus("RUNNING");
      log("Plantão iniciado como Residente.");
      ensurePatientsOnStart();
      saveProgress();
      startTick();
      emitState();
    }

    function consumeTime(patient, seconds) {
      // “tempo do caso” permanece para bônus e pressão, mas agora a deterioração é separada.
      patient.session.startedAtMs = patient.session.startedAtMs || nowMs();
      patient._elapsedActionsSec = (patient._elapsedActionsSec || 0) + seconds;
    }

    function doHistory() {
      const p = getSelectedPatient(); if (!p) return;
      const c = getCaseById(p.caseId); if (!c) return;
      p.session.actions.flags.history = true;
      p.revealed.history = c.history.slice();
      consumeTime(p, CONFIG.simulation.actionTimeCostSec.history);
      log("História clínica coletada.");
      emitState();
    }

    function doPhysical() {
      const p = getSelectedPatient(); if (!p) return;
      const c = getCaseById(p.caseId); if (!c) return;
      p.session.actions.flags.physical = true;
      p.revealed.physical = c.physicalFindings.slice();
      consumeTime(p, CONFIG.simulation.actionTimeCostSec.physical);
      log("Exame físico realizado.");
      emitState();
    }

    function requestExam(examKey) {
      const p = getSelectedPatient(); if (!p) return;
      const c = getCaseById(p.caseId); if (!c || !c.exams || !c.exams[examKey]) return;
      if (p.session.actions.exams.has(examKey)) return;
      p.session.actions.exams.add(examKey);

      const delay = CONFIG.simulation.examDelaysSec[examKey] || 10;
      p.session.actions.examResults[examKey] = {
        readyAtMs: nowMs() + delay * 1000,
        text: c.exams[examKey],
        ready: false
      };

      consumeTime(p, CONFIG.simulation.actionTimeCostSec.exam);
      log("Exame solicitado: " + examKey.toUpperCase() + " (aguardando)." );
      emitState();
    }

    function applyTreatment(tKey) {
      const p = getSelectedPatient(); if (!p) return;
      const c = getCaseById(p.caseId); if (!c || !c.treatments || !c.treatments[tKey]) return;
      p.session.actions.treatments.add(tKey);
      consumeTime(p, CONFIG.simulation.actionTimeCostSec.treatment);
      // Pequeno “alívio” temporário: segurar a deterioração (didático). No futuro, vira fisiologia.
      if (p.statusVital !== "DEAD") p.timeToNextStageSec += 3;
      log("Conduta realizada: " + tKey);
      emitState();
    }

    function setCriticalFlag(flagKey, value) {
      const p = getSelectedPatient(); if (!p) return;
      if (!(flagKey in p.session.actions.flags)) return;
      p.session.actions.flags[flagKey] = Boolean(value);
      emitState();
    }

    function removePatient(patientId) {
      const idx = state.queue.patients.findIndex(p => p.id === patientId);
      if (idx < 0) return;
      state.queue.patients.splice(idx, 1);
      if (state.queue.selectedId === patientId) {
        state.queue.selectedId = state.queue.patients[0]?.id || null;
      }
    }

    function diagnose(finalDiagnosis) {
      const p = getSelectedPatient(); if (!p) return;
      const c = getCaseById(p.caseId); if (!c) return;
      if (p.statusVital === "DEAD") return;

      p.session.finalDiagnosis = finalDiagnosis;
      p.session.endedAtMs = nowMs();

      const evaluation = evaluateCase(c, p.session);
      const fb = {
        caseId: c.id,
        caseTitle: c.title,
        correctDiagnosis: c.correct.diagnosis,
        chosenDiagnosis: finalDiagnosis,
        education: c.education,
        evaluation
      };

      state.run.casesCompleted += 1;
      state.run.scoreTotal += evaluation.score;
      if (evaluation.correctDiag) {
        state.run.correctCount += 1;
        state.run.xp += CONFIG.progression.xpPerCorrectCase;
      } else {
        state.run.wrongCount += 1;
        state.run.xp += CONFIG.progression.xpPerWrongCase;
      }

      while (state.run.xp >= CONFIG.progression.xpToLevelUp) {
        state.run.xp -= CONFIG.progression.xpToLevelUp;
        state.run.level += 1;
        log("Promoção! Agora nível " + state.run.level + ".");
      }

      removePatient(p.id);
      state.queue.nextArrivalSec = Math.min(state.queue.nextArrivalSec, arrivalIntervalForLevel(state.run.level));

      // Pausa somente nos níveis iniciais
      if (state.run.level <= CONFIG.ui.pauseFeedbackUpToLevel) {
        state.feedback = fb;
        setStatus("FEEDBACK");
      } else {
        state.recentFeedbacks.unshift(fb);
        if (state.recentFeedbacks.length > 5) state.recentFeedbacks.pop();
        state.feedback = null;
        setStatus("RUNNING");
      }

      saveProgress();
      emitState();
    }

    function continueAfterFeedback() {
      state.feedback = null;
      setStatus("RUNNING");
      emitState();
    }

    function onPatientDeath(p) {
      const c = getCaseById(p.caseId);
      const name = c ? c.patient.name : "Paciente";
      log(`ÓBITO: ${name} evoluiu para parada e não resistiu.`);
      state.run.deaths += 1;
      state.run.scoreTotal = Math.max(0, state.run.scoreTotal - CONFIG.simulation.deterioration.deathPenaltyScore);
      removePatient(p.id);
    }

    function tick() {
      if (state.status !== "RUNNING") return;

      // Chegadas
      state.queue.nextArrivalSec = Math.max(0, state.queue.nextArrivalSec - 1);
      const maxP = maxPatientsForLevel(state.run.level);
      if (state.queue.nextArrivalSec <= 0) {
        if (state.queue.patients.length < maxP) spawnPatient();
        state.queue.nextArrivalSec = arrivalIntervalForLevel(state.run.level);
      }

      // Atualiza exames (por paciente) + deterioração
      for (const p of [...state.queue.patients]) {
        const results = p.session.actions.examResults || {};
        for (const key of Object.keys(results)) {
          const r = results[key];
          if (!r.ready && nowMs() >= r.readyAtMs) {
            r.ready = true;
            log("Resultado disponível: " + key.toUpperCase() + " (" + (getCaseById(p.caseId)?.patient.name || "") + ").");
          }
        }

        const events = PatientLogic.tickPatient(p, 1);
        for (const ev of events) {
          if (ev.type === "PATIENT_DETERIORATED") {
            log(`Paciente piorou: ${getCaseById(p.caseId)?.patient.name || ""} -> ${ev.to}.`);
          }
          if (ev.type === "PATIENT_DIED") {
            onPatientDeath(p);
          }
        }
      }

      // Garantir seleção válida
      if (state.queue.selectedId && !state.queue.patients.some(p => p.id === state.queue.selectedId)) {
        state.queue.selectedId = state.queue.patients[0]?.id || null;
      }

      emitState();
    }

    function startTick() {
      stopTick();
      tickInterval = setInterval(tick, 1000);
    }

    function stopTick() {
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = null;
    }

    function bootstrap() {
      loadProgress();
      setStatus("START");
      emitState();
    }

    return {
      onState: (cb) => bus.on("state", cb),
      getState,
      bootstrap,
      setCases,
      setContentFilters,
      start,
      selectPatient,
      doHistory,
      doPhysical,
      requestExam,
      applyTreatment,
      setCriticalFlag,
      diagnose,
      continueAfterFeedback,
      resetSave: () => { saves.clear(); resetRun(); setStatus("START"); emitState(); },
    };
  };
})();
