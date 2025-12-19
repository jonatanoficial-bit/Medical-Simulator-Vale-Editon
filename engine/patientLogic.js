// Engine - PatientLogic (Parte 2)
// Funções puras para criação e deterioração de pacientes.

window.MedSim = window.MedSim || {};
window.MedSim.Engine = window.MedSim.Engine || {};

(function () {
  const CONFIG = window.MedSim.Data.CONFIG;

  function uid() {
    return (
      "p_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function triageMeta(triage) {
    // 1=vermelho, 2=laranja, 3=amarelo (simples para Parte 2)
    if (triage === 1) return { label: "VERMELHO", cls: "t_red" };
    if (triage === 2) return { label: "LARANJA", cls: "t_orange" };
    return { label: "AMARELO", cls: "t_yellow" };
  }

  function mergeDeterioration(caseData) {
    const base = CONFIG.simulation.deterioration;
    const o = (caseData && caseData.deterioration) || {};
    return {
      stableToUnstableSec: o.stableToUnstableSec ?? base.stableToUnstableSec,
      unstableToCriticalSec: o.unstableToCriticalSec ?? base.unstableToCriticalSec,
      criticalToDeadSec: o.criticalToDeadSec ?? base.criticalToDeadSec,
    };
  }

  function createPatientInstance(caseData) {
    const triage = caseData.triage || (caseData.difficulty >= 2 ? 2 : 3);
    const det = mergeDeterioration(caseData);
    return {
      id: uid(),
      caseId: caseData.id,
      triage,
      statusVital: "STABLE", // STABLE | UNSTABLE | CRITICAL | DEAD
      timeToNextStageSec: det.stableToUnstableSec,
      deterioration: det,
      createdAtMs: Date.now(),
      // Sessão clínica (ações do jogador) – isolada por paciente
      session: {
        startedAtMs: Date.now(),
        endedAtMs: null,
        actions: {
          flags: { history: false, physical: false, send_home: false, no_antibiotics: false, delay_epi: false },
          exams: new Set(),
          treatments: new Set(),
          examResults: {},
        },
        finalDiagnosis: null,
      },
      revealed: {
        chiefComplaint: caseData.chiefComplaint,
        history: null,
        physical: null,
      },
    };
  }

  function tickPatient(patient, dtSec) {
    // Retorna uma lista de eventos sem side-effects (a engine decide o que fazer).
    const events = [];
    if (patient.statusVital === "DEAD") return events;

    patient.timeToNextStageSec = Math.max(0, patient.timeToNextStageSec - dtSec);
    if (patient.timeToNextStageSec > 0) return events;

    if (patient.statusVital === "STABLE") {
      patient.statusVital = "UNSTABLE";
      patient.timeToNextStageSec = patient.deterioration.unstableToCriticalSec;
      events.push({ type: "PATIENT_DETERIORATED", to: "UNSTABLE" });
      return events;
    }
    if (patient.statusVital === "UNSTABLE") {
      patient.statusVital = "CRITICAL";
      patient.timeToNextStageSec = patient.deterioration.criticalToDeadSec;
      events.push({ type: "PATIENT_DETERIORATED", to: "CRITICAL" });
      return events;
    }
    if (patient.statusVital === "CRITICAL") {
      patient.statusVital = "DEAD";
      patient.timeToNextStageSec = 0;
      events.push({ type: "PATIENT_DIED" });
      return events;
    }

    return events;
  }

  window.MedSim.Engine.PatientLogic = {
    createPatientInstance,
    tickPatient,
    triageMeta,
  };
})();
