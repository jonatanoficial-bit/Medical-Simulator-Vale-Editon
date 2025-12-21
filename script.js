/* ============================================================
   Simulador Médico - Web (Single File)
   UI: telas + overlays
   Engine: motor de plantão + fisiologia (simplificado)
   Persistência: localStorage
   ============================================================ */

/* ================================
   Persistência do perfil
   ================================ */
function loadPlayerProfile() {
  try {
    const raw = localStorage.getItem("medsim_playerProfile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function savePlayerProfile(profile) {
  try {
    localStorage.setItem("medsim_playerProfile", JSON.stringify(profile));
  } catch (e) {}
}
let playerProfile = loadPlayerProfile();
if (playerProfile) window.playerProfile = playerProfile;

/* ================================
   Utilitários
   ================================ */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randomBetween(min, max) { return Math.random() * (max - min) + min; }
function randomBetweenInt(min, max) { return Math.floor(randomBetween(min, max + 1)); }
function round1(v) { return Math.round(v * 10) / 10; }
function normalize(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function safeText(s) { return String(s || "").replace(/[<>]/g, ""); }

function formatVitals(v) {
  return [
    `FC: ${v.hr} bpm`,
    `FR: ${v.rr} irpm`,
    `SpO₂: ${v.spo2}%`,
    `PA sistólica: ${v.sys} mmHg`,
    `Temp: ${v.temp} °C`,
  ].join("\n");
}

/* ================================
   Catálogo “grande” de exames/meds/dx
   (para induzir erro: sempre mostrar tudo)
   ================================ */

const EXAMS_LAB = [
  "Hemograma", "PCR", "VHS", "Glicemia", "Ureia", "Creatinina",
  "Sódio", "Potássio", "Cloro", "Magnésio", "Cálcio",
  "Gasometria arterial", "Lactato", "Troponina", "CK-MB",
  "Dímero-D", "Coagulograma (TP/INR, TTPa)", "TGO/TGP", "Bilirrubinas",
  "Amilase/Lipase", "TSH/T4", "Urina I", "Urocultura",
  "Beta-HCG", "Hemoculturas", "Procalcitonina",
  "BNP/NT-proBNP"
];

const EXAMS_IMG = [
  "RX Tórax", "RX Abdome", "RX Membro", "TC Crânio", "TC Tórax",
  "TC Abdome", "TC Angio Tórax", "US Abdome Total", "US Pelve",
  "US Doppler MMII", "RM Crânio", "Eco (Ecodoppler cardíaco)"
];

const EXAMS_OTHER = [
  "ECG", "POCUS (US Beira-leito)", "Teste rápido COVID/Influenza",
  "Teste de glicemia capilar", "Oximetria contínua", "Monitor cardíaco",
  "Escala de Glasgow", "Escala de dor", "Teste ortostático"
];

const MED_IV = [
  "SF 0,9% 500ml", "SF 0,9% 1000ml", "Ringer Lactato 1000ml",
  "Dipirona IV", "Paracetamol IV", "Morfina IV", "Fentanil IV",
  "Ondansetrona IV", "Metoclopramida IV", "Omeprazol IV",
  "Ceftriaxona IV", "Piperacilina/Tazobactam IV",
  "Azitromicina IV", "Heparina IV", "Enoxaparina SC",
  "Adrenalina IM/IV", "Hidrocortisona IV", "Dexametasona IV",
  "Salbutamol nebulização", "Ipratrópio nebulização",
  "Insulina regular", "Glicose hipertônica 50%", "Naloxona",
  "Nitroglicerina", "AAS", "Clopidogrel"
];

const MED_HOME = [
  "Paracetamol VO", "Dipirona VO", "Ibuprofeno VO",
  "Amoxicilina/Clavulanato VO", "Azitromicina VO",
  "Omeprazol VO", "Prednisona VO", "Loratadina", "Captopril",
  "Metformina", "Losartana", "Sertralina"
];

const PROCEDURES = [
  "Oxigênio nasal", "Máscara não-reinalante", "Ventilação não invasiva (VNI)",
  "Intubação orotraqueal", "Acesso venoso periférico", "Acesso intraósseo",
  "Sonda vesical", "Sonda nasogástrica", "Sutura simples",
  "Imobilização", "Reanimação cardiopulmonar (RCP)", "Desfibrilação",
  "Controle de hemorragia", "Antissepsia/curativo"
];

const DIAGNOSES_ALL = [
  "Síndrome coronariana aguda", "Pericardite", "Pneumonia",
  "Embolia pulmonar", "Asma/Crise asmática", "DPOC exacerbado",
  "Sepse", "Choque séptico", "Anafilaxia", "AVC isquêmico",
  "AVC hemorrágico", "TCE", "Cetoacidose diabética",
  "Hipoglicemia", "Pancreatite", "Apendicite", "Colecistite",
  "Gastroenterite", "ITU/Pielonefrite", "Nefrolitíase",
  "Intoxicação medicamentosa", "Crise hipertensiva"
];

/* Tempos aproximados (segundos) para resultado */
function getExamDelaySeconds(examKey) {
  const k = normalize(examKey);
  if (k.includes("tc") || k.includes("rm")) return 70;
  if (k.includes("rx")) return 40;
  if (k.includes("ecg")) return 8;
  if (k.includes("gasometr")) return 25;
  if (k.includes("hemograma")) return 35;
  if (k.includes("tropon")) return 50;
  if (k.includes("dimer")) return 45;
  if (k.includes("urina")) return 35;
  if (k.includes("pcr")) return 40;
  return 30;
}

/* ================================
   Avatares
   ================================ */
const avatars = [
  { name: "Médico 1", image: "images/avatar1.png" },
  { name: "Médico 2", image: "images/avatar2.png" },
  { name: "Médico 3", image: "images/avatar3.png" },
];

/* ================================
   Casos fallback (mínimo)
   (Sem data/cases.json o jogo ainda funciona)
   ================================ */
function defaultCasesFallback() {
  return [
    {
      id: "case_chestpain",
      specialty: "clinica",
      gender: "male",
      age: 54,
      complaint: "Dor torácica em aperto há 40 minutos, irradiando para braço esquerdo.",
      history: "HAS, tabagista. Dor iniciou em repouso. Náuseas leves.",
      physicalExam: "Paciente sudoreico, pálido, dor 8/10. Ausculta sem estertores.",
      diagnosis: "Síndrome coronariana aguda",
      differentials: ["Embolia pulmonar", "Pericardite", "Crise hipertensiva"],
      requiredExams: ["ECG", "Troponina", "RX Tórax"],
      harmfulExams: ["RM Crânio", "US Pelve"],
      requiredMeds: ["AAS", "Nitroglicerina"],
      harmfulMeds: ["Ibuprofeno VO"],
      examResults: {
        "ECG": "Supradesnivelamento de ST em parede inferior.",
        "Troponina": "Elevada (positivo).",
        "RX Tórax": "Sem sinais de congestão."
      },
      medEffects: {
        "AAS": { severityDelta: -0.10, delaySeconds: 3 },
        "Nitroglicerina": { severityDelta: -0.08, delaySeconds: 6 }
      },
      initialSeverity: 0.55
    },
    {
      id: "case_sepsis",
      specialty: "clinica",
      gender: "female",
      age: 67,
      complaint: "Febre, confusão e queda do estado geral há 2 dias.",
      history: "DM2. Disúria prévia. Redução de ingesta.",
      physicalExam: "Desidratada, extremidades frias, sonolenta. Dor em flanco direito.",
      diagnosis: "Sepse",
      differentials: ["ITU/Pielonefrite", "Pneumonia", "Gastroenterite"],
      requiredExams: ["Hemograma", "Lactato", "Hemoculturas", "Urina I"],
      harmfulExams: ["RM Crânio"],
      requiredMeds: ["SF 0,9% 1000ml", "Ceftriaxona IV"],
      harmfulMeds: ["Losartana"],
      examResults: {
        "Hemograma": "Leucocitose importante com desvio à esquerda.",
        "Lactato": "Elevado.",
        "Hemoculturas": "Coletadas (resultado pendente).",
        "Urina I": "Piúria, nitrito positivo."
      },
      medEffects: {
        "SF 0,9% 1000ml": { severityDelta: -0.12, delaySeconds: 8 },
        "Ceftriaxona IV": { severityDelta: -0.18, delaySeconds: 20 }
      },
      initialSeverity: 0.62
    }
  ];
}

/* ================================
   Nomes / cargos
   ================================ */
function randomName(gender) {
  const male = ["Carlos", "João", "Mateus", "Pedro", "Rafael", "Lucas"];
  const female = ["Ana", "Mariana", "Juliana", "Camila", "Larissa", "Beatriz"];
  const last = ["Silva", "Souza", "Oliveira", "Lima", "Costa", "Pereira"];
  const fn = (gender === "female" ? female : male)[randomBetweenInt(0, 5)];
  const ln = last[randomBetweenInt(0, 5)];
  return `${fn} ${ln}`;
}
function getRankTitle(level) {
  if (level <= 1) return "Residente";
  if (level === 2) return "Plantonista Júnior";
  if (level === 3) return "Plantonista Sênior";
  return "Chefe do Plantão";
}

/* ================================
   Engine
   ================================ */
class GameEngine {
  constructor(ui) {
    this.ui = ui;
    this.config = {
      initialLevel: 1,
      maxErrors: 3,
      baseNewPatientIntervalMs: 12000,
      tickMs: 1000,
      training: { deteriorationMultiplier: 0.35, penaltyMultiplier: 0.35 },
      shift: { deteriorationMultiplier: 1.0, penaltyMultiplier: 1.0 }
    };

    this.mode = "shift";
    this.player = { name: "Residente", avatarIndex: 0 };

    this.newPatientInterval = null;
    this.tickInterval = null;

    this.patients = [];
    this.score = 0;
    this.totalScore = 0;
    this.errorCount = 0;
    this.activePatientId = null;

    this.currentLevel = this.config.initialLevel;

    this.stats = { correct: 0, incorrect: 0, deaths: 0 };
    this.casesAttended = 0;

    this.cases = [];
    this.specialtyFilter = "all";
    this.loaded = false;
  }

  async loadData() {
    try {
      const casesRes = await fetch("data/cases.json", { cache: "no-store" });
      if (casesRes.ok) {
        const data = await casesRes.json();
        this.cases = Array.isArray(data) ? data : (data.cases || []);
      }
    } catch (e) {
      this.cases = defaultCasesFallback();
    }

    if (!Array.isArray(this.cases) || this.cases.length === 0) {
      this.cases = defaultCasesFallback();
    }
    this.loaded = true;
  }

  setPlayer(name, avatarIndex) {
    this.player.name = name;
    this.player.avatarIndex = avatarIndex;
  }

  setSpecialtyFilter(v) { this.specialtyFilter = v || "all"; }
  setMode(mode) { this.mode = (mode === "training") ? "training" : "shift"; }

  start() {
    this.patients = [];
    this.score = 0;
    this.errorCount = 0;
    this.activePatientId = null;
    this.currentLevel = this.config.initialLevel;

    this.ui.updateLevel(this.currentLevel);
    this.ui.updateScore(this.score);

    this.casesAttended = 0;
    this.stats = this.stats || { correct: 0, incorrect: 0, deaths: 0 };

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);

    this.tickInterval = setInterval(() => this.tick(), this.config.tickMs);
    this.newPatientInterval = setInterval(() => this.spawnPatient(), this.config.baseNewPatientIntervalMs);

    this.spawnPatient();
    this.spawnPatient();
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);
    this.tickInterval = null;
    this.newPatientInterval = null;
  }

  tick() {
    const mult = (this.mode === "training")
      ? this.config.training.deteriorationMultiplier
      : this.config.shift.deteriorationMultiplier;

    for (const p of this.patients) {
      if (p.status === "dead" || p.status === "discharged") continue;

      p.time += 1;

      const deterioration = 0.08 * mult;
      p.severity = clamp(p.severity + deterioration, 0, 1);

      p.vitals.hr = Math.round(70 + p.severity * 60 + randomBetween(-3, 3));
      p.vitals.rr = Math.round(14 + p.severity * 14 + randomBetween(-2, 2));
      p.vitals.spo2 = Math.round(98 - p.severity * 18 + randomBetween(-1, 1));
      p.vitals.sys = Math.round(125 - p.severity * 40 + randomBetween(-3, 3));
      p.vitals.temp = round1(36.7 + p.severity * 2.2 + randomBetween(-0.2, 0.2));

      this.applyQueuedEffects(p);

      if (p.severity >= 0.98 && p.time > 30) {
        p.status = "dead";
        this.stats.deaths += 1;
        this.errorCount += 1;
        this.ui.onPatientDied(p);
      }
    }

    this.ui.refreshPatients(this.patients, this.activePatientId);
    const active = this.getActivePatient();
    if (active) this.ui.renderPatientDetails(active, this);
  }

  spawnPatient() {
    if (!this.loaded) return;

    const candidateCases = this.cases.filter(c => {
      if (this.specialtyFilter === "all") return true;
      return normalize(c.specialty) === normalize(this.specialtyFilter);
    });

    const caseData = (candidateCases.length > 0)
      ? candidateCases[Math.floor(Math.random() * candidateCases.length)]
      : this.cases[Math.floor(Math.random() * this.cases.length)];

    const id = `p_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const gender = caseData.gender || (Math.random() > 0.5 ? "male" : "female");

    const patient = {
      id,
      caseId: caseData.id,
      name: randomName(gender),
      gender,
      age: caseData.age || randomBetweenInt(18, 80),

      complaint: caseData.complaint || "Queixa inespecífica.",
      history: caseData.history || "Sem dados adicionais.",
      physicalExam: caseData.physicalExam || "Sem alterações relevantes.",

      diagnosis: caseData.diagnosis || "Diagnóstico não definido.",
      differentials: caseData.differentials || [],
      requiredExams: caseData.requiredExams || [],
      harmfulExams: caseData.harmfulExams || [],
      requiredMeds: caseData.requiredMeds || [],
      harmfulMeds: caseData.harmfulMeds || [],
      protocol: caseData.protocol || [],

      examResults: caseData.examResults || {},
      medEffects: caseData.medEffects || {},

      requested: {
        history: false,
        physical_exam: false,
        exams: [],
        meds: [],
        diagnosis: null
      },

      queuedEffects: [],
      time: 0,
      severity: clamp(caseData.initialSeverity ?? 0.25, 0, 1),
      status: "waiting",
      vitals: { hr: 92, rr: 18, spo2: 97, sys: 128, temp: 36.8 }
    };

    this.patients.unshift(patient);
    if (!this.activePatientId) this.activePatientId = patient.id;
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }

  setActivePatient(id) {
    this.activePatientId = id;
    const p = this.getActivePatient();
    if (p) p.status = (p.status === "waiting") ? "in_care" : p.status;
    this.ui.renderPatientDetails(p, this);
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }

  getActivePatient() {
    return this.patients.find(p => p.id === this.activePatientId) || null;
  }

  performAction(patientId, action, payload) {
    const p = this.patients.find(x => x.id === patientId);
    if (!p || p.status === "dead") return;

    if (action === "history") {
      p.requested.history = true;
      this.ui.showInfo("História Clínica", p.history);
      return;
    }

    if (action === "physical_exam") {
      p.requested.physical_exam = true;
      const vitalsTxt = formatVitals(p.vitals);
      this.ui.showInfo("Exame Físico", `${p.physicalExam}\n\nSinais vitais:\n${vitalsTxt}`);
      return;
    }

    if (action === "request_exam") {
      const examKey = payload?.examKey;
      if (!examKey) return;

      if (!p.requested.exams.includes(examKey)) p.requested.exams.push(examKey);

      const baseDelay = getExamDelaySeconds(examKey);
      const mult = (this.mode === "training") ? 0.55 : 1.0;
      const delay = Math.max(2, Math.round(baseDelay * mult));

      const result = p.examResults?.[examKey] || "Sem alterações específicas.";
      p.queuedEffects.push({ type: "exam_result", examKey, result, readyAt: p.time + delay });

      this.ui.toast(`Exame solicitado: ${examKey} (resultado em ~${delay}s)`);
      return;
    }

    if (action === "give_med") {
      const medKey = payload?.medKey;
      if (!medKey) return;

      if (!p.requested.meds.includes(medKey)) p.requested.meds.push(medKey);

      const eff = p.medEffects?.[medKey];
      if (eff) {
        const delay = Math.max(1, eff.delaySeconds || 1);
        p.queuedEffects.push({ type: "med_effect", medKey, effect: eff, readyAt: p.time + delay });
      }

      this.ui.toast(`Medicação/Procedimento aplicado: ${medKey}`);
      return;
    }

    if (action === "final_diagnosis") {
      const diag = payload?.diagnosis;
      p.requested.diagnosis = diag || null;
      this.evaluateCase(p);
      return;
    }
  }

  applyQueuedEffects(patient) {
    if (!patient.queuedEffects || patient.queuedEffects.length === 0) return;
    const now = patient.time;

    const ready = patient.queuedEffects.filter(e => e.readyAt <= now);
    if (ready.length === 0) return;

    patient.queuedEffects = patient.queuedEffects.filter(e => e.readyAt > now);

    for (const e of ready) {
      if (e.type === "exam_result") {
        this.ui.showExamResult(e.examKey, e.result);
      }
      if (e.type === "med_effect") {
        const delta = e.effect.severityDelta || 0;
        patient.severity = clamp(patient.severity + delta, 0, 1);
      }
    }
  }

  evaluateCase(patient) {
    const diagCorrect = normalize(patient.requested.diagnosis) === normalize(patient.diagnosis);

    const requiredExams = patient.requiredExams || [];
    const requiredMeds = patient.requiredMeds || [];
    const harmfulExams = patient.harmfulExams || [];
    const harmfulMeds = patient.harmfulMeds || [];

    const pickedExams = patient.requested.exams || [];
    const pickedMeds = patient.requested.meds || [];

    const missingExams = requiredExams.filter(x => !pickedExams.includes(x));
    const missingMeds = requiredMeds.filter(x => !pickedMeds.includes(x));

    const wrongExams = pickedExams.filter(x => harmfulExams.includes(x));
    const wrongMeds = pickedMeds.filter(x => harmfulMeds.includes(x));

    const penaltyMult = (this.mode === "training")
      ? this.config.training.penaltyMultiplier
      : this.config.shift.penaltyMultiplier;

    let points = 0;
    if (diagCorrect) points += 120;
    else points -= 90 * penaltyMult;

    points += (requiredExams.length - missingExams.length) * 12;
    points += (requiredMeds.length - missingMeds.length) * 18;

    points -= wrongExams.length * 10 * penaltyMult;
    points -= wrongMeds.length * 18 * penaltyMult;

    const timePenalty = Math.max(0, Math.floor(patient.time / 6));
    points -= timePenalty * 2 * penaltyMult;

    let outcome = "stable";
    if (!diagCorrect && (wrongMeds.length > 0 || missingMeds.length > 1) && patient.severity > 0.85) {
      outcome = "death";
    } else if (diagCorrect && missingMeds.length === 0) {
      outcome = "improved";
    }

    if (outcome === "death") {
      patient.status = "dead";
      this.stats.deaths += 1;
      this.errorCount += 1;
      points -= 120 * penaltyMult;
    } else {
      patient.status = "discharged";
    }

    this.casesAttended += 1;
    if (diagCorrect) this.stats.correct += 1;
    else this.stats.incorrect += 1;

    this.score += points;
    this.totalScore += points;

    this.ui.updateScore(this.score);

    if (!playerProfile) playerProfile = window.playerProfile || null;
    if (playerProfile) {
      playerProfile.score = this.totalScore;
      playerProfile.level = this.currentLevel;
      playerProfile.role = getRankTitle(this.currentLevel);
      playerProfile.stats = this.stats;
      savePlayerProfile(playerProfile);
      window.playerProfile = playerProfile;
    }

    this.ui.showCaseReport({
      patient,
      diagCorrect,
      missingExams,
      missingMeds,
      wrongExams,
      wrongMeds,
      points,
      outcome
    });

    this.patients = this.patients.filter(p => p.id !== patient.id);

    if (this.patients.length > 0) this.activePatientId = this.patients[0].id;
    else {
      this.activePatientId = null;
      this.spawnPatient();
      this.activePatientId = this.patients[0]?.id || null;
    }

    if (this.totalScore > 300 && this.currentLevel < 2) this.currentLevel = 2;
    if (this.totalScore > 800 && this.currentLevel < 3) this.currentLevel = 3;
    if (this.totalScore > 1500 && this.currentLevel < 4) this.currentLevel = 4;

    this.ui.updateLevel(this.currentLevel);
    this.ui.refreshPatients(this.patients, this.activePatientId);
    this.ui.updateOfficeFromProfile();
  }
}

/* ================================
   UI
   ================================ */
class GameUI {
  constructor() {
    this.cover = document.getElementById("cover-screen");
    this.welcome = document.getElementById("welcome-screen");
    this.lobby = document.getElementById("lobby-screen");
    this.office = document.getElementById("office-screen");