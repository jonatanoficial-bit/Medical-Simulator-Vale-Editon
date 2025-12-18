// Camada de Dados/Config
// Centralize aqui parâmetros de jogo e balanceamento.

window.MedSim = window.MedSim || {};
window.MedSim.Data = window.MedSim.Data || {};

window.MedSim.Data.CONFIG = {
  schemaVersion: 1,

  progression: {
    startingLevel: 1,
    xpPerCorrectCase: 100,
    xpPerWrongCase: 25,
    xpToLevelUp: 300,
  },

  scoring: {
    baseCorrect: 120,
    baseWrong: 20,
    timeBonusMax: 40,
    timeBonusWindowSec: 45,
    criticalPenalty: 80,
  },

  simulation: {
    // Parte 1: 1 paciente por vez. Parte 2: múltiplos pacientes em fila.
    defaultPatientTimerSec: 90,

    // Fila (múltiplos pacientes simultâneos)
    queue: {
      maxPatientsBase: 1,
      maxPatientsCap: 4,
      // a cada N níveis, aumenta +1 paciente simultâneo
      levelStepForMorePatients: 2,
      // intervalo base de chegada (segundos) e mínimo
      arrivalBaseSec: 18,
      arrivalMinSec: 6,
      // reduz o intervalo conforme o nível (pacing)
      arrivalDecaySecPerLevel: 1,
    },

    // Deterioração por estados: STABLE -> UNSTABLE -> CRITICAL -> DEAD
    // (valores base, cada caso pode sobrescrever)
    deterioration: {
      stableToUnstableSec: 35,
      unstableToCriticalSec: 25,
      criticalToDeadSec: 20,
      // penalidade (pontos) por óbito na fila ou durante atendimento
      deathPenaltyScore: 120,
    },
    actionTimeCostSec: {
      history: 10,
      physical: 10,
      exam: 15,
      treatment: 12,
    },
    examDelaysSec: {
      ecg: 10,
      labs: 15,
      xray: 18,
    },
  },

  persistence: {
    storageKey: "medsim.save.part2",
  },

  ui: {
    maxLogLines: 250,
    // Até este nível, o feedback de caso pausa o plantão (didático).
    pauseFeedbackUpToLevel: 2,
  },
};
