/* ============================================================
   Simulador Médico - Versão 1.0 (Web)
   - UI: Camadas de telas + overlays
   - Engine: motor de plantão + fisiologia (simplificado)
   - Persistência: localStorage
============================================================ */

// ================================
// Perfil do jogador
// ================================
function loadPlayerProfile() {
  try {
    const raw = localStorage.getItem("medsim_playerProfile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function savePlayerProfile(profile) {
  try {
    localStorage.setItem("medsim_playerProfile", JSON.stringify(profile));
  } catch {}
}
let playerProfile = loadPlayerProfile();
if (playerProfile) window.playerProfile = playerProfile;

// ================================
// Catálogos (exames/meds/diagnósticos) via data/catalogs.json
// ================================
const catalogsFallback = () => ({
  labExams: ["Hemograma completo", "PCR", "Gasometria arterial", "Lactato", "Eletrólitos (Na/K/Cl)"],
  imagingExams: ["Raio-X de tórax", "TC de abdome e pelve", "TC de crânio sem contraste"],
  otherExams: ["ECG 12 derivações", "Oximetria contínua", "Glicemia capilar"],
  ivMeds: ["Soro fisiológico 0,9% 1.000 mL", "Dipirona IV", "Ondansetrona IV", "Naloxona IV"],
  homeMeds: ["Dipirona VO", "Paracetamol VO", "Hidratação oral e dieta leve"],
  procedures: ["Oxigênio por cateter", "Ventilação com BVM", "Acesso venoso periférico"],
  diagnoses: ["Apendicite aguda", "TEP (tromboembolismo pulmonar)", "Intoxicação/overdose"]
});

let catalogs = catalogsFallback();

async function loadCatalogs() {
  try {
    const res = await fetch("data/catalogs.json", { cache: "no-store" });
    if (res.ok) catalogs = await res.json();
  } catch {
    catalogs = catalogsFallback();
  }
}

// ================================
// Avatares / imagens obrigatórias
// ================================
const avatars = [
  { name: "Avatar 1", image: "images/avatar1.png" },
  { name: "Avatar 2", image: "images/avatar2.png" },
  { name: "Avatar 3", image: "images/avatar3.png" },
  { name: "Avatar 4", image: "images/avatar4.png" },
  { name: "Avatar 5", image: "images/avatar5.png" },
  { name: "Avatar 6", image: "images/avatar6.png" }
];

function patientPortrait(gender) {
  return gender === "female" ? "images/patient_female.png" : "images/patient_male.png";
}

// ================================
// Utils
// ================================
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function randomBetween(a, b) { return a + Math.random() * (b - a); }
function randomBetweenInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function round1(n) { return Math.round(n * 10) / 10; }
function normalize(s) { return String(s || "").trim().toLowerCase(); }

function formatVitals(v) {
  return [
    `PA: ${v.sys} mmHg`,
    `FC: ${v.hr} bpm`,
    `FR: ${v.rr} irpm`,
    `SpO2: ${v.spo2}%`,
    `Temp: ${v.temp} °C`
  ].join("\n");
}

function randomName(gender) {
  const male = ["João Ferreira", "Bruno Rocha", "Eduardo Reis", "Carlos Lima"];
  const female = ["Maria Oliveira", "Ana Souza", "Camila Santos", "Juliana Costa"];
  const list = gender === "female" ? female : male;
  return list[Math.floor(Math.random() * list.length)];
}

function getRankTitle(level) {
  if (level >= 6) return "Médico Assistente";
  if (level >= 5) return "Chefe de Plantão";
  if (level >= 4) return "Fellow";
  if (level >= 3) return "R3";
  if (level >= 2) return "R2";
  return "Residente";
}

function getExamDelaySeconds(examKey) {
  const key = normalize(examKey);
  if (key.includes("tc") || key.includes("angio") || key.includes("rm")) return 22;
  if (key.includes("raio-x") || key.includes("ultrassom")) return 14;
  if (key.includes("troponina") || key.includes("d-dímero")) return 16;
  if (key.includes("hemograma") || key.includes("pcr") || key.includes("glicemia")) return 10;
  if (key.includes("ecg")) return 6;
  return 12;
}

function defaultCasesFallback() {
  return [
    {
      id: "fallback1",
      specialty: "clínica",
      gender: "male",
      age: 28,
      complaint: "Dor abdominal difusa e náuseas.",
      history: "Sem alergias conhecidas. Dor há 8h, sem diarreia.",
      physicalExam: "Dor à palpação difusa, sem rigidez.",
      diagnosis: "Gastroenterite",
      differentials: ["Apendicite aguda", "Colecistite aguda", "Pancreatite aguda"],
      initialSeverity: 0.28,
      requiredExams: ["Hemograma completo"],
      harmfulExams: ["TC de crânio sem contraste"],
      requiredMeds: ["Dipirona IV"],
      harmfulMeds: ["Heparina IV"],
      examResults: {
        "Hemograma completo": "Leucócitos 9.800, sem desvio."
      },
      medEffects: {
        "Dipirona IV": { "delaySeconds": 2, "severityDelta": -0.05 }
      }
    }
  ];
}

// ================================
// Engine
// ================================
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
    } catch {
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
  setSpecialtyFilter(value) { this.specialtyFilter = value || "all"; }
  setMode(mode) { this.mode = mode === "training" ? "training" : "shift"; }

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

    const base = this.config.baseNewPatientIntervalMs;
    this.newPatientInterval = setInterval(() => this.spawnPatient(), base);

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
    const mult = this.mode === "training"
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

    const caseData = candidateCases.length > 0
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
      requested: { history: false, physical_exam: false, exams: [], meds: [], diagnosis: null },
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
      const mult = this.mode === "training" ? 0.55 : 1.0;
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

      this.ui.toast(`Aplicado: ${medKey}`);
      return;
    }

    if (action === "final_diagnosis") {
      p.requested.diagnosis = payload?.diagnosis || null;
      this.evaluateCase(p);
      return;
    }
  }

  applyQueuedEffects(patient) {
    if (!patient.queuedEffects?.length) return;
    const now = patient.time;

    const ready = patient.queuedEffects.filter(e => e.readyAt <= now);
    if (!ready.length) return;

    patient.queuedEffects = patient.queuedEffects.filter(e => e.readyAt > now);

    for (const e of ready) {
      if (e.type === "exam_result") this.ui.showExamResult(e.examKey, e.result);
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

    const penaltyMult = this.mode === "training"
      ? this.config.training.penaltyMultiplier
      : this.config.shift.penaltyMultiplier;

    let points = 0;
    points += diagCorrect ? 120 : -90 * penaltyMult;
    points += (requiredExams.length - missingExams.length) * 12;
    points += (requiredMeds.length - missingMeds.length) * 18;
    points -= wrongExams.length * 10 * penaltyMult;
    points -= wrongMeds.length * 18 * penaltyMult;

    const timePenalty = Math.max(0, Math.floor(patient.time / 6));
    points -= timePenalty * 2 * penaltyMult;

    let outcome = "stable";
    if (!diagCorrect && (wrongMeds.length > 0 || missingMeds.length > 1) && patient.severity > 0.85) outcome = "death";
    else if (diagCorrect && missingMeds.length === 0) outcome = "improved";

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
    if (this.totalScore > 2500 && this.currentLevel < 5) this.currentLevel = 5;
    if (this.totalScore > 4000 && this.currentLevel < 6) this.currentLevel = 6;

    this.ui.updateLevel(this.currentLevel);
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }
}

// ================================
// UI
// ================================
class GameUI {
  constructor() {
    this.coverScreen = document.getElementById("cover-screen");
    this.welcomeScreen = document.getElementById("welcome-screen");
    this.lobbyScreen = document.getElementById("lobby-screen");
    this.officeScreen = document.getElementById("office-screen");
    this.gameScreen = document.getElementById("game-screen");

    this.avatarSelection = document.getElementById("avatar-selection");

    this.officeAvatar = document.getElementById("office-avatar");
    this.officeName = document.getElementById("office-name");
    this.officeLevel = document.getElementById("office-level");
    this.officeRole = document.getElementById("office-role");
    this.officeScore = document.getElementById("office-score");

    this.statTotal = document.getElementById("stat-total");
    this.statCorrect = document.getElementById("stat-correct");
    this.statIncorrect = document.getElementById("stat-incorrect");
    this.statDeaths = document.getElementById("stat-deaths");

    this.accBar = document.getElementById("acc-bar");
    this.accLabel = document.getElementById("acc-label");
    this.careerLabel = document.getElementById("career-label");

    this.specialtySelect = document.getElementById("specialty-select");
    this.modeSelect = document.getElementById("mode-select");

    this.levelDisplay = document.getElementById("level-display");
    this.scoreDisplay = document.getElementById("score-display");
    this.patientsList = document.getElementById("patients-list");
    this.patientDetails = document.getElementById("patient-details");

    this.examPage = document.getElementById("exam-page");
    this.examContent = document.getElementById("exam-content");
    this.examBack = document.getElementById("exam-back");

    this.treatmentPage = document.getElementById("treatment-page");
    this.treatmentContent = document.getElementById("treatment-content");
    this.treatmentBack = document.getElementById("treatment-back");

    this.diagnosisPage = document.getElementById("diagnosis-page");
    this.diagnosisContent = document.getElementById("diagnosis-content");
    this.diagnosisBack = document.getElementById("diagnosis-back");

    this.toastEl = null;
    this.reportOverlay = null;

    this.selectedAvatarIndex = 0;
    this.infoTitle = "";
    this.infoText = "";
  }

  init(engine) {
    // Touch-friendly: pointerdown
    const goWelcome = () => {
      this.coverScreen.classList.remove("active");
      this.welcomeScreen.classList.add("active");
    };
    const goLobby = () => {
      this.welcomeScreen.classList.remove("active");
      this.lobbyScreen.classList.add("active");
    };

    this.coverScreen.addEventListener("pointerdown", goWelcome, { passive: true });
    this.coverScreen.addEventListener("click", goWelcome);

    this.welcomeScreen.addEventListener("pointerdown", goLobby, { passive: true });
    this.welcomeScreen.addEventListener("click", goLobby);

    this.renderAvatars();

    fillSpecialties(engine.cases, this.specialtySelect);

    if (playerProfile) {
      const nameInput = document.getElementById("player-name");
      nameInput.value = playerProfile.name || "";
      const idx = avatars.findIndex(a => a.image === playerProfile.avatar);
      if (idx >= 0) this.selectedAvatarIndex = idx;
    }

    const startButton = document.getElementById(