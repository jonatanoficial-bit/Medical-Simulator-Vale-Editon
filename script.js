/* ============================================================
   Simulador Médico - Versão 1.0 (Web)
   UI: camadas de telas + overlays
   Engine: fisiologia simplificada + avaliação por caso
   Persistência: localStorage
   ============================================================ */

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function randomBetween(a,b){ return a + Math.random()*(b-a); }
function randomBetweenInt(a,b){ return Math.floor(randomBetween(a, b+1)); }
function round1(x){ return Math.round(x*10)/10; }
function normalize(s){ return String(s||"").trim().toLowerCase(); }

function loadPlayerProfile(){
  try { const raw = localStorage.getItem("medsim_playerProfile"); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function savePlayerProfile(p){
  try { localStorage.setItem("medsim_playerProfile", JSON.stringify(p)); } catch {}
}

let playerProfile = loadPlayerProfile();
if (playerProfile) window.playerProfile = playerProfile;

const avatars = [
  { name:"Avatar 1", image:"./images/avatar1.png" },
  { name:"Avatar 2", image:"./images/avatar2.png" },
  { name:"Avatar 3", image:"./images/avatar3.png" },
  { name:"Avatar 4", image:"./images/avatar4.png" },
  { name:"Avatar 5", image:"./images/avatar5.png" },
  { name:"Avatar 6", image:"./images/avatar6.png" }
];

function randomName(gender){
  const male = ["João Ferreira","Bruno Rocha","Eduardo Reis","Marcos Lima","Rafael Souza","Lucas Almeida"];
  const female = ["Maria Oliveira","Ana Martins","Juliana Costa","Beatriz Rocha","Carla Souza","Fernanda Lima"];
  const arr = gender === "female" ? female : male;
  return arr[Math.floor(Math.random()*arr.length)];
}

function getRankTitle(level){
  if (level <= 1) return "Residente";
  if (level === 2) return "Plant. Júnior";
  if (level === 3) return "Plantonista";
  return "Médico Sênior";
}

function formatVitals(v){
  return `PA: ${v.sys}/${Math.max(40, Math.round(v.sys*0.55))} mmHg
FC: ${v.hr} bpm
FR: ${v.rr} irpm
SatO2: ${v.spo2}%
Temp: ${v.temp} °C`;
}

function getExamDelaySeconds(examKey){
  const k = normalize(examKey);
  if (k.includes("tc")) return 35;
  if (k.includes("angio")) return 45;
  if (k.includes("rm")) return 60;
  if (k.includes("usg") || k.includes("eco")) return 30;
  if (k.includes("raio") || k.includes("rx")) return 25;
  if (k.includes("gasometria")) return 18;
  if (k.includes("hemograma")) return 22;
  if (k.includes("troponina")) return 26;
  if (k.includes("d-dímero") || k.includes("d-dimero")) return 24;
  if (k.includes("ecg")) return 8;
  return 20;
}

function defaultCasesFallback(){
  return [
    {
      id:"fallback_appendicitis",
      specialty:"cirurgia",
      gender:"male",
      age:25,
      complaint:"Dor abdominal intensa no quadrante inferior direito + náuseas.",
      history:"Dor iniciou peri-umbilical e migrou para FID. Náuseas, inapetência. Sem diarreia.",
      physicalExam:"Dor importante em FID, defesa voluntária. Blumberg discreto.",
      diagnosis:"Apendicite aguda",
      differentials:["Gastroenterite aguda","Cólica renal"],
      initialSeverity:0.35,
      requiredExams:["Hemograma","PCR","TC abdome/pelve"],
      harmfulExams:["RM crânio"],
      requiredMeds:["Dipirona IV","SF 0,9% 500 mL","Acesso venoso periférico"],
      harmfulMeds:["Heparina IV"],
      examResults:{
        "Hemograma":"Leucócitos 15.800 (neutrofilia).",
        "PCR":"PCR 62 mg/L (elevada).",
        "TC abdome/pelve":"Apendice espessado com densificação periappendicular."
      },
      medEffects:{
        "SF 0,9% 500 mL": { "severityDelta": -0.06, "delaySeconds": 6 },
        "Dipirona IV": { "severityDelta": -0.05, "delaySeconds": 5 }
      }
    }
  ];
}

function defaultCatalogsFallback(){
  return {
    exams:{
      laboratory:["Hemograma","PCR","Gasometria arterial","Lactato","Troponina","D-dímero","Glicemia"],
      imaging:["Raio-X de tórax","TC abdome/pelve","TC crânio sem contraste","AngioTC de tórax","USG abdome total"],
      others:["ECG 12 derivações","Monitorização contínua","Glicemia capilar"]
    },
    treatments:{
      iv:["SF 0,9% 500 mL","Dipirona IV","Ondansetrona IV","Ceftriaxona IV","Naloxona IV","Heparina IV"],
      home:["Dipirona VO","Paracetamol VO","Azitromicina VO","Omeprazol VO"],
      procedures:["Oxigênio por máscara","Acesso venoso periférico","Monitorização contínua"]
    },
    diagnoses:["Apendicite aguda","TEP (Tromboembolismo pulmonar)","Overdose de opioides","Pneumonia comunitária"]
  };
}

function fillSpecialties(cases, select){
  const set = new Set();
  for (const c of (cases||[])) set.add((c.specialty||"").toLowerCase() || "geral");
  const arr = ["all", ...Array.from(set).sort()];
  select.innerHTML = "";
  for (const s of arr){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s === "all" ? "Todas" : s[0].toUpperCase()+s.slice(1);
    select.appendChild(opt);
  }
}

function severityToStatus(sev){
  if (sev >= 0.90) return "critical";
  if (sev >= 0.70) return "unstable";
  return "stable";
}

function statusLabel(st){
  if (st === "dead") return "Óbito";
  if (st === "critical") return "Crítico";
  if (st === "unstable") return "Instável";
  return "Estável";
}

function pickExamHeroPath(kind){
  if (kind === "lab") return "./images/labs.png";
  if (kind === "img") return "./images/mri.jpg";
  if (kind === "other") return "./images/mri.png";
  return "./images/fundo.jpg";
}

class GameEngine {
  constructor(ui){
    this.ui = ui;

    // ✅ AJUSTE DE JOGABILIDADE (mais realista)
    // - deteriorationBasePerSecond controla o quanto a severidade sobe por segundo
    // - deathMinSeconds controla quando a severidade extrema pode virar óbito
    this.gameplay = {
      deteriorationBasePerSecond: 0.02, // antes era 0.08 (muito rápido)
      deathSeverityThreshold: 0.985,
      deathMinSeconds: 180, // antes era 30s
      criticalExtraDeterioration: 0.006 // piora extra quando já está crítico (opcional)
    };

    this.config = {
      initialLevel: 1,
      baseNewPatientIntervalMs: 12000,
      tickMs: 1000,

      // ✅ plantão e treinamento agora ficam mais jogáveis
      training: { deteriorationMultiplier: 0.22, penaltyMultiplier: 0.35 },
      shift: { deteriorationMultiplier: 0.55, penaltyMultiplier: 1.0 }
    };

    this.mode = "shift";
    this.player = { name:"Residente", avatarIndex:0 };

    this.patients = [];
    this.score = 0;
    this.totalScore = 0;
    this.activePatientId = null;
    this.currentLevel = this.config.initialLevel;

    this.stats = { correct:0, incorrect:0, deaths:0 };
    this.casesAttended = 0;

    this.cases = [];
    this.catalogs = null;

    this.loaded = false;
    this.specialtyFilter = "all";

    this.tickInterval = null;
    this.newPatientInterval = null;
    this.paused = false;
  }

  async loadData(){
    try{
      const r = await fetch("./data/cases.json", { cache:"no-store" });
      if (r.ok){
        const j = await r.json();
        this.cases = Array.isArray(j) ? j : (j.cases || []);
      }
    }catch{
      this.cases = defaultCasesFallback();
    }
    if (!Array.isArray(this.cases) || this.cases.length === 0) this.cases = defaultCasesFallback();

    try{
      const r2 = await fetch("./data/catalogs.json", { cache:"no-store" });
      if (r2.ok) this.catalogs = await r2.json();
    }catch{
      this.catalogs = defaultCatalogsFallback();
    }
    if (!this.catalogs) this.catalogs = defaultCatalogsFallback();

    this.loaded = true;
  }

  setPlayer(name, avatarIndex){
    this.player.name = name;
    this.player.avatarIndex = avatarIndex;
  }
  setSpecialtyFilter(v){ this.specialtyFilter = v || "all"; }
  setMode(m){ this.mode = m === "training" ? "training" : "shift"; }

  start(){
    this.patients = [];
    this.score = 0;
    this.activePatientId = null;
    this.currentLevel = this.config.initialLevel;
    this.paused = false;

    this.ui.updateLevel(this.currentLevel);
    this.ui.updateScore(this.score);

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);

    this.tickInterval = setInterval(() => this.tick(), this.config.tickMs);
    this.newPatientInterval = setInterval(() => this.spawnPatient(), this.config.baseNewPatientIntervalMs);

    this.spawnPatient();
    this.spawnPatient();
  }

  stop(){
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);
    this.tickInterval = null;
    this.newPatientInterval = null;
  }

  togglePause(){
    this.paused = !this.paused;
    this.ui.toast(this.paused ? "Jogo pausado" : "Jogo retomado");
  }

  tick(){
    if (this.paused) return;

    const mult = this.mode === "training"
      ? this.config.training.deteriorationMultiplier
      : this.config.shift.deteriorationMultiplier;

    for (const p of this.patients){
      if (p.status === "dead" || p.status === "discharged") continue;

      p.time += 1;

      // ✅ Piora mais lenta e mais "orgânica"
      let deterioration = this.gameplay.deteriorationBasePerSecond * mult;

      // Se já está crítico, piora um pouco mais, mas ainda jogável
      if (p.severity >= 0.85) deterioration += this.gameplay.criticalExtraDeterioration * mult;

      p.severity = clamp(p.severity + deterioration, 0, 1);

      p.vitals.hr = Math.round(70 + p.severity * 60 + randomBetween(-3, 3));
      p.vitals.rr = Math.round(14 + p.severity * 14 + randomBetween(-2, 2));
      p.vitals.spo2 = Math.round(98 - p.severity * 18 + randomBetween(-1, 1));
      p.vitals.sys = Math.round(125 - p.severity * 40 + randomBetween(-3, 3));
      p.vitals.temp = round1(36.7 + p.severity * 2.2 + randomBetween(-0.2, 0.2));

      this.applyQueuedEffects(p);

      // ✅ Óbito menos agressivo (precisa estar extremo e por mais tempo)
      if (p.severity >= this.gameplay.deathSeverityThreshold && p.time > this.gameplay.deathMinSeconds){
        p.status = "dead";
        this.stats.deaths += 1;
        this.ui.toast(`Óbito: ${p.name}`);
      }
    }

    this.ui.refreshPatients(this.patients, this.activePatientId);

    const active = this.getActivePatient();
    if (active) this.ui.renderPatientDetails(active, this);
  }

  spawnPatient(){
    if (!this.loaded) return;

    const candidate = this.cases.filter(c => {
      if (this.specialtyFilter === "all") return true;
      return normalize(c.specialty) === normalize(this.specialtyFilter);
    });

    const pool = candidate.length ? candidate : this.cases;
    const caseData = pool[Math.floor(Math.random() * pool.length)];

    const id = `p_${Date.now()}_${Math.floor(Math.random()*9999)}`;
    const gender = caseData.gender || (Math.random() > 0.5 ? "male" : "female");

    const patient = {
      id,
      caseId: caseData.id,
      name: randomName(gender),
      gender,
      age: caseData.age || randomBetweenInt(18,80),
      complaint: caseData.complaint || "Queixa inespecífica.",
      history: caseData.history || "Sem dados adicionais.",
      physicalExam: caseData.physicalExam || "Sem alterações relevantes.",
      diagnosis: caseData.diagnosis || "Diagnóstico não definido.",
      differentials: caseData.differentials || [],
      requiredExams: caseData.requiredExams || [],
      harmfulExams: caseData.harmfulExams || [],
      requiredMeds: caseData.requiredMeds || [],
      harmfulMeds: caseData.harmfulMeds || [],
      examResults: caseData.examResults || {},
      medEffects: caseData.medEffects || {},
      requested: { history:false, physical_exam:false, exams:[], meds:[], diagnosis:null },
      queuedEffects: [],
      time: 0,

      // (mantém a severidade inicial do caso, mas agora o tempo de evolução está melhor)
      severity: clamp(caseData.initialSeverity ?? 0.25, 0, 1),

      status: "waiting",
      vitals: { hr:92, rr:18, spo2:97, sys:128, temp:36.8 }
    };

    this.patients.unshift(patient);
    if (!this.activePatientId) this.activePatientId = patient.id;
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }

  setActivePatient(id){
    this.activePatientId = id;
    const p = this.getActivePatient();
    if (p && p.status === "waiting") p.status = "in_care";
    this.ui.refreshPatients(this.patients, this.activePatientId);
    if (p) this.ui.renderPatientDetails(p, this);
  }

  getActivePatient(){
    return this.patients.find(p => p.id === this.activePatientId) || null;
  }

  performAction(patientId, action, payload){
    const p = this.patients.find(x => x.id === patientId);
    if (!p || p.status === "dead") return;

    if (action === "history"){
      p.requested.history = true;
      this.ui.setInfo("História Clínica", p.history);
      return;
    }

    if (action === "physical_exam"){
      p.requested.physical_exam = true;
      const vtxt = formatVitals(p.vitals);
      this.ui.setInfo("Exame Físico", `${p.physicalExam}\n\nSinais vitais:\n${vtxt}`);
      return;
    }

    if (action === "open_exam_overlay"){
      this.ui.showExamOverlay(payload?.kind || "lab", payload?.title || "Exames", payload?.items || [], (examKey) => {
        this.performAction(patientId, "request_exam", { examKey });
      });
      return;
    }

    if (action === "open_treat_overlay"){
      this.ui.showTreatmentOverlay(payload?.title || "Tratamentos", payload?.items || [], (medKey) => {
        this.performAction(patientId, "give_med", { medKey });
      });
      return;
    }

    if (action === "open_dx_overlay"){
      this.ui.showDiagnosisOverlay(payload?.items || [], (dx) => {
        this.performAction(patientId, "final_diagnosis", { diagnosis: dx });
      });
      return;
    }

    if (action === "request_exam"){
      const examKey = payload?.examKey;
      if (!examKey) return;
      if (!p.requested.exams.includes(examKey)) p.requested.exams.push(examKey);

      const baseDelay = getExamDelaySeconds(examKey);
      const mult = this.mode === "training" ? 0.55 : 1.0;
      const delay = Math.max(2, Math.round(baseDelay * mult));

      const result = p.examResults?.[examKey] || "Sem alterações específicas.";
      p.queuedEffects.push({ type:"exam_result", examKey, result, readyAt: p.time + delay });

      this.ui.toast(`Exame solicitado: ${examKey} (resultado em ~${delay}s)`);
      return;
    }

    if (action === "give_med"){
      const medKey = payload?.medKey;
      if (!medKey) return;
      if (!p.requested.meds.includes(medKey)) p.requested.meds.push(medKey);

      const eff = p.medEffects?.[medKey];
      if (eff){
        const delay = Math.max(1, eff.delaySeconds || 1);
        p.queuedEffects.push({ type:"med_effect", medKey, effect: eff, readyAt: p.time + delay });
      }

      this.ui.toast(`Aplicado: ${medKey}`);
      return;
    }

    if (action === "final_diagnosis"){
      p.requested.diagnosis = payload?.diagnosis || null;
      this.evaluateCase(p);
      return;
    }
  }

  applyQueuedEffects(patient){
    const now = patient.time;
    const ready = patient.queuedEffects.filter(e => e.readyAt <= now);
    if (!ready.length) return;
    patient.queuedEffects = patient.queuedEffects.filter(e => e.readyAt > now);

    for (const e of ready){
      if (e.type === "exam_result"){
        this.ui.setInfo(`Resultado: ${e.examKey}`, e.result);
      } else if (e.type === "med_effect"){
        const delta = e.effect.severityDelta || 0;
        patient.severity = clamp(patient.severity + delta, 0, 1);
      }
    }
  }

  evaluateCase(patient){
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
    if (diagCorrect) points += 120; else points -= 90 * penaltyMult;
    points += (requiredExams.length - missingExams.length) * 12;
    points += (requiredMeds.length - missingMeds.length) * 18;
    points -= wrongExams.length * 10 * penaltyMult;
    points -= wrongMeds.length * 18 * penaltyMult;

    const timePenalty = Math.max(0, Math.floor(patient.time / 6));
    points -= timePenalty * 2 * penaltyMult;

    let outcome = "stable";
    if (!diagCorrect && (wrongMeds.length > 0 || missingMeds.length > 1) && patient.severity > 0.85) outcome = "death";
    else if (diagCorrect && missingMeds.length === 0) outcome = "improved";

    if (outcome === "death"){
      patient.status = "dead";
      this.stats.deaths += 1;
      points -= 120 * penaltyMult;
    } else {
      patient.status = "discharged";
    }

    this.casesAttended += 1;
    if (diagCorrect) this.stats.correct += 1; else this.stats.incorrect += 1;

    this.score += points;
    this.totalScore += points;
    this.ui.updateScore(this.score);

    if (playerProfile){
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
    if (this.patients.length) this.activePatientId = this.patients[0].id;
    else { this.activePatientId = null; this.spawnPatient(); this.activePatientId = this.patients[0]?.id || null; }

    if (this.totalScore > 300 && this.currentLevel < 2) this.currentLevel = 2;
    if (this.totalScore > 800 && this.currentLevel < 3) this.currentLevel = 3;
    if (this.totalScore > 1500 && this.currentLevel < 4) this.currentLevel = 4;

    this.ui.updateLevel(this.currentLevel);
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }
}

class GameUI {
  constructor(){
    this.coverScreen = document.getElementById("cover-screen");
    this.welcomeScreen = document.getElementById("welcome-screen");
    this.lobbyScreen = document.getElementById("lobby-screen");
    this.officeScreen = document.getElementById("office-screen");
    this.gameScreen = document.getElementById("game-screen");

    this.avatarSelection = document.getElementById("avatar-selection");

    this.officeAvatar = document.getElementById("office-avatar");
    this.officeName = document.getElementById("office-name");
    this.officeLevel = document.getElementById("office-level");
    this.officeScore = document.getElementById("office-score");
    this.statTotal = document.getElementById("stat-total");
    this.statCorrect = document.getElementById("stat-correct");
    this.statIncorrect = document.getElementById("stat-incorrect");
    this.statDeaths = document.getElementById("stat-deaths");

    this.specialtySelect = document.getElementById("specialty-select");
    this.modeSelect = document.getElementById("mode-select");

    this.levelDisplay = document.getElementById("level-display");
    this.scoreDisplay = document.getElementById("score-display");
    this.patientsList = document.getElementById("patients-list");
    this.patientDetails = document.getElementById("patient-details");

    this.examPage = document.getElementById("exam-page");
    this.examContent = document.getElementById("exam-content");