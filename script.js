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
  // Usa seus arquivos existentes (você mostrou: labs.png, mri.jpg/png, etc.)
  if (kind === "lab") return "./images/labs.png";
  if (kind === "img") return "./images/mri.jpg";
  if (kind === "other") return "./images/mri.png";
  return "./images/fundo.jpg";
}

class GameEngine {
  constructor(ui){
    this.ui = ui;
    this.config = {
      initialLevel: 1,
      baseNewPatientIntervalMs: 12000,
      tickMs: 1000,
      training: { deteriorationMultiplier: 0.35, penaltyMultiplier: 0.35 },
      shift: { deteriorationMultiplier: 1.0, penaltyMultiplier: 1.0 }
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
    // cases
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

    // catalogs
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

      const deterioration = 0.08 * mult;
      p.severity = clamp(p.severity + deterioration, 0, 1);

      p.vitals.hr = Math.round(70 + p.severity * 60 + randomBetween(-3, 3));
      p.vitals.rr = Math.round(14 + p.severity * 14 + randomBetween(-2, 2));
      p.vitals.spo2 = Math.round(98 - p.severity * 18 + randomBetween(-1, 1));
      p.vitals.sys = Math.round(125 - p.severity * 40 + randomBetween(-3, 3));
      p.vitals.temp = round1(36.7 + p.severity * 2.2 + randomBetween(-0.2, 0.2));

      this.applyQueuedEffects(p);

      if (p.severity >= 0.98 && p.time > 30){
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
    this.examBack = document.getElementById("exam-back");

    this.treatmentPage = document.getElementById("treatment-page");
    this.treatmentContent = document.getElementById("treatment-content");
    this.treatmentBack = document.getElementById("treatment-back");

    this.diagnosisPage = document.getElementById("diagnosis-page");
    this.diagnosisContent = document.getElementById("diagnosis-content");
    this.diagnosisBack = document.getElementById("diagnosis-back");

    this.toastEl = null;

    this.selectedAvatarIndex = 0;

    // mantém texto persistente (história/resultados etc.)
    this.infoState = { title: "Mensagens", body: "Toque em História Clínica ou Exame Físico para ver detalhes aqui." };
  }

  init(engine){
    // capa -> welcome
    this.coverScreen.addEventListener("click", () => {
      this.coverScreen.classList.remove("active");
      this.welcomeScreen.classList.add("active");
    });

    // welcome -> lobby
    this.welcomeScreen.addEventListener("click", () => {
      this.welcomeScreen.classList.remove("active");
      this.lobbyScreen.classList.add("active");
    });

    // overlays back
    this.examBack.addEventListener("click", () => this.hideOverlay("exam"));
    this.treatmentBack.addEventListener("click", () => this.hideOverlay("treatment"));
    this.diagnosisBack.addEventListener("click", () => this.hideOverlay("diagnosis"));

    // pause
    document.getElementById("pause-btn").addEventListener("click", () => engine.togglePause());

    // avatars
    this.renderAvatars();

    fillSpecialties(engine.cases, this.specialtySelect);

    // restore profile
    if (playerProfile){
      const nameInput = document.getElementById("player-name");
      nameInput.value = playerProfile.name || "";
      const idx = avatars.findIndex(a => a.image === playerProfile.avatar);
      if (idx >= 0) this.selectedAvatarIndex = idx;
    }

    // start profile -> office
    document.getElementById("start-button").addEventListener("click", () => {
      const name = document.getElementById("player-name").value.trim();
      if (!name){ alert("Por favor, insira seu nome."); return; }

      engine.setPlayer(name, this.selectedAvatarIndex);

      playerProfile = {
        name,
        avatar: avatars[this.selectedAvatarIndex].image,
        role: getRankTitle(engine.currentLevel),
        level: engine.currentLevel,
        score: engine.totalScore || 0,
        stats: engine.stats || { correct:0, incorrect:0, deaths:0 }
      };
      window.playerProfile = playerProfile;
      savePlayerProfile(playerProfile);

      const playerAvatarImg = document.getElementById("player-avatar");
      playerAvatarImg.src = avatars[this.selectedAvatarIndex].image;
      playerAvatarImg.style.display = "inline-block";
      document.getElementById("player-name-display").textContent = name;

      this.lobbyScreen.classList.remove("active");
      this.updateOffice(engine);
      this.officeScreen.classList.add("active");
    });

    // next case -> game
    document.getElementById("next-case-button").addEventListener("click", () => {
      engine.setSpecialtyFilter(this.specialtySelect.value);
      engine.setMode(this.modeSelect.value);

      this.officeScreen.classList.remove("active");
      this.gameScreen.classList.add("active");

      // reseta info ao iniciar
      this.setInfo("Mensagens", "Toque em História Clínica ou Exame Físico para ver detalhes aqui.");
      engine.start();
    });

    // back office
    document.getElementById("back-office").addEventListener("click", () => {
      engine.stop();
      this.gameScreen.classList.remove("active");
      this.updateOffice(engine);
      this.officeScreen.classList.add("active");
    });
  }

  renderAvatars(){
    this.avatarSelection.innerHTML = "";
    avatars.forEach((a, i) => {
      const btn = document.createElement("button");
      btn.className = "avatar-btn";
      btn.innerHTML = `<img src="${a.image}" alt="${a.name}" /><span>${a.name}</span>`;
      if (i === this.selectedAvatarIndex) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        this.selectedAvatarIndex = i;
        [...this.avatarSelection.querySelectorAll(".avatar-btn")].forEach(x => x.classList.remove("selected"));
        btn.classList.add("selected");
      });
      this.avatarSelection.appendChild(btn);
    });
  }

  updateOffice(engine){
    const prof = playerProfile || window.playerProfile || { name: engine.player.name, avatar: avatars[engine.player.avatarIndex]?.image };

    this.officeName.textContent = prof.name || engine.player.name || "—";
    this.officeLevel.textContent = `${getRankTitle(engine.currentLevel)} • Nível ${engine.currentLevel}`;
    this.officeScore.textContent = String(prof.score ?? engine.totalScore ?? 0);

    const stats = prof.stats || engine.stats || { correct:0, incorrect:0, deaths:0 };
    const total = (stats.correct || 0) + (stats.incorrect || 0);

    this.statTotal.textContent = String(total);
    this.statCorrect.textContent = String(stats.correct || 0);
    this.statIncorrect.textContent = String(stats.incorrect || 0);
    this.statDeaths.textContent = String(stats.deaths || 0);

    const av = prof.avatar || avatars[engine.player.avatarIndex]?.image;
    if (av) this.officeAvatar.style.backgroundImage = `url("${av}")`;
  }

  updateLevel(level){
    this.levelDisplay.textContent = `Nível ${level}`;
  }

  updateScore(score){
    this.scoreDisplay.textContent = `Pontuação: ${score}`;
  }

  refreshPatients(patients, activeId){
    this.patientsList.innerHTML = "";
    for (const p of patients){
      const sevStatus = p.status === "dead" ? "dead" : severityToStatus(p.severity);
      const stClass = sevStatus === "critical" ? "status-critical"
                    : sevStatus === "unstable" ? "status-unstable"
                    : sevStatus === "dead" ? "status-dead"
                    : "status-stable";

      const card = document.createElement("div");
      card.className = "patient-card" + (p.id === activeId ? " active" : "");
      card.innerHTML = `
        <div class="patient-card-top">
          <div class="patient-name">${p.name}</div>
          <div class="patient-status ${stClass}">${statusLabel(sevStatus)}</div>
        </div>
        <div class="patient-complaint">${p.complaint}</div>
      `;
      card.addEventListener("click", () => window.engine.setActivePatient(p.id));
      this.patientsList.appendChild(card);
    }
  }

  renderPatientDetails(patient, engine){
    if (!patient){
      this.patientDetails.innerHTML = `<div class="empty-state">Selecione um paciente na fila.</div>`;
      return;
    }

    const portrait = patient.gender === "female"
      ? "./images/patient_female.jpg"
      : "./images/patient_male.jpg";

    const sevStatus = patient.status === "dead" ? "dead" : severityToStatus(patient.severity);

    const stClass = sevStatus === "critical" ? "status-critical"
                  : sevStatus === "unstable" ? "status-unstable"
                  : sevStatus === "dead" ? "status-dead"
                  : "status-stable";

    const catalogs = engine.catalogs || defaultCatalogsFallback();

    const examsLab = catalogs.exams?.laboratory || [];
    const examsImg = catalogs.exams?.imaging || [];
    const examsOther = catalogs.exams?.others || [];

    const medsIV = catalogs.treatments?.iv || [];
    const medsHome = catalogs.treatments?.home || [];
    const medsProc = catalogs.treatments?.procedures || [];

    const dxList = catalogs.diagnoses || [];

    const vit = patient.vitals;

    this.patientDetails.innerHTML = `
      <div class="patient-header">
        <div class="patient-portrait" style="background-image:url('${portrait}')"></div>
        <div class="patient-main">
          <h2>${patient.name} (${patient.age} anos)</h2>
          <div class="patient-sub">
            <span class="badge ${stClass}">${statusLabel(sevStatus)}</span>
            <span class="dot">•</span>
            <span>${patient.gender === "female" ? "Feminino" : "Masculino"}</span>
          </div>
          <div class="patient-complaint-big"><b>Queixa:</b> ${patient.complaint}</div>
        </div>

        <div class="vitals-box">
          <h3>Sinais Vitais</h3>
          <div class="vitals-grid">
            <div class="vital"><span>PA</span><b>${vit.sys}/${Math.max(40, Math.round(vit.sys*0.55))}</b></div>
            <div class="vital"><span>FC</span><b>${vit.hr} bpm</b></div>
            <div class="vital"><span>FR</span><b>${vit.rr} irpm</b></div>
            <div class="vital"><span>SatO2</span><b>${vit.spo2}%</b></div>
            <div class="vital"><span>Temp</span><b>${vit.temp} °C</b></div>
            <div class="vital"><span>Tempo</span><b>${patient.time}s</b></div>
          </div>
        </div>
      </div>

      <div class="actions-area">
        <div class="actions-row">
          <button class="action-btn" data-act="history"><i>📄</i><span>História Clínica</span></button>
          <button class="action-btn" data-act="physical_exam"><i>🩺</i><span>Exame Físico</span></button>
          <button class="action-btn" data-act="dx"><i>🧠</i><span>Diagnóstico</span></button>

          <button class="action-btn" data-act="ex_lab"><i>🧪</i><span>Exames Laboratoriais</span></button>
          <button class="action-btn" data-act="ex_img"><i>🩻</i><span>Exames de Imagem</span></button>
          <button class="action-btn" data-act="ex_other"><i>📟</i><span>Outros Exames</span></button>

          <button class="action-btn" data-act="med_iv"><i>💉</i><span>Medicação IV</span></button>
          <button class="action-btn" data-act="med_home"><i>💊</i><span>Medicação Casa/VO</span></button>
          <button class="action-btn" data-act="med_proc"><i>🛠️</i><span>Procedimentos</span></button>
        </div>

        <div class="info-container" id="info-box">
          <h4>${this.infoState.title}</h4>
          <pre>${this.infoState.body}</pre>
        </div>
      </div>
    `;

    const bind = (sel, fn) => {
      const el = this.patientDetails.querySelector(sel);
      if (el) el.addEventListener("click", fn);
    };

    bind(`[data-act="history"]`, () => engine.performAction(patient.id, "history"));
    bind(`[data-act="physical_exam"]`, () => engine.performAction(patient.id, "physical_exam"));

    bind(`[data-act="dx"]`, () => engine.performAction(patient.id, "open_dx_overlay", { items: dxList }));

    bind(`[data-act="ex_lab"]`, () => engine.performAction(patient.id, "open_exam_overlay", {
      kind: "lab",
      title: "Exames Laboratoriais",
      items: examsLab
    }));

    bind(`[data-act="ex_img"]`, () => engine.performAction(patient.id, "open_exam_overlay", {
      kind: "img",
      title: "Exames de Imagem",
      items: examsImg
    }));

    bind(`[data-act="ex_other"]`, () => engine.performAction(patient.id, "open_exam_overlay", {
      kind: "other",
      title: "Outros Exames",
      items: examsOther
    }));

    bind(`[data-act="med_iv"]`, () => engine.performAction(patient.id, "open_treat_overlay", {
      title: "Medicação IV",
      items: medsIV
    }));

    bind(`[data-act="med_home"]`, () => engine.performAction(patient.id, "open_treat_overlay", {
      title: "Medicação Casa/VO",
      items: medsHome
    }));

    bind(`[data-act="med_proc"]`, () => engine.performAction(patient.id, "open_treat_overlay", {
      title: "Procedimentos",
      items: medsProc
    }));
  }

  setInfo(title, body){
    this.infoState = { title, body: String(body || "") };
    const box = document.getElementById("info-box");
    if (box){
      box.innerHTML = `<h4>${title}</h4><pre>${this.infoState.body}</pre>`;
    }
  }

  showExamOverlay(kind, title, items, onPick){
    const hero = pickExamHeroPath(kind);

    this.examContent.innerHTML = `
      <div class="overlay-hero" style="background-image:url('${hero}')"></div>
      <div class="result-box">
        <h4>${title}</h4>
        <pre>Escolha qualquer exame. Você pode errar e perder pontos.</pre>
      </div>
      <div class="grid-list">
        ${items.map(x => `<button class="grid-item" data-exam="${String(x).replaceAll('"','&quot;')}">${x}</button>`).join("")}
      </div>
    `;

    this.examContent.querySelectorAll("[data-exam]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-exam");
        this.hideOverlay("exam");
        onPick(key);
      });
    });

    this.examPage.classList.remove("hidden");
  }

  showTreatmentOverlay(title, items, onPick){
    const hero = "./images/consultorio.jpg";

    this.treatmentContent.innerHTML = `
      <div class="overlay-hero" style="background-image:url('${hero}')"></div>
      <div class="result-box">
        <h4>${title}</h4>
        <pre>Escolha uma medicação/procedimento. Algumas opções podem piorar o quadro.</pre>
      </div>
      <div class="grid-list">
        ${items.map(x => `<button class="grid-item" data-med="${String(x).replaceAll('"','&quot;')}">${x}</button>`).join("")}
      </div>
    `;

    this.treatmentContent.querySelectorAll("[data-med]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-med");
        this.hideOverlay("treatment");
        onPick(key);
      });
    });

    this.treatmentPage.classList.remove("hidden");
  }

  showDiagnosisOverlay(items, onPick){
    this.diagnosisContent.innerHTML = `
      <div class="result-box">
        <h4>Diagnóstico final</h4>
        <pre>Selecione um diagnóstico para concluir o caso.</pre>
      </div>
      <input class="dx-search" id="dx-search" placeholder="Buscar diagnóstico..." />
      <div class="dx-list" id="dx-list"></div>
    `;

    const listEl = this.diagnosisContent.querySelector("#dx-list");
    const searchEl = this.diagnosisContent.querySelector("#dx-search");

    const render = (filter) => {
      const f = normalize(filter);
      const filtered = items.filter(x => normalize(x).includes(f));
      listEl.innerHTML = filtered.map(x => `<button class="dx-item" data-dx="${String(x).replaceAll('"','&quot;')}">${x}</button>`).join("");
      listEl.querySelectorAll("[data-dx]").forEach(btn => {
        btn.addEventListener("click", () => {
          const dx = btn.getAttribute("data-dx");
          this.hideOverlay("diagnosis");
          onPick(dx);
        });
      });
    };

    searchEl.addEventListener("input", () => render(searchEl.value));
    render("");

    this.diagnosisPage.classList.remove("hidden");
  }

  hideOverlay(which){
    if (which === "exam") this.examPage.classList.add("hidden");
    if (which === "treatment") this.treatmentPage.classList.add("hidden");
    if (which === "diagnosis") this.diagnosisPage.classList.add("hidden");
  }

  showCaseReport({ patient, diagCorrect, missingExams, missingMeds, wrongExams, wrongMeds, points, outcome }){
    const title = diagCorrect ? "✅ Caso concluído" : "⚠️ Caso concluído";
    const outcomeTxt = outcome === "death" ? "Óbito" : (outcome === "improved" ? "Melhora" : "Estável");

    const msg = [
      `${title}`,
      `Paciente: ${patient.name}`,
      `Diagnóstico escolhido: ${patient.requested.diagnosis || "—"}`,
      `Diagnóstico correto: ${patient.diagnosis}`,
      `Desfecho: ${outcomeTxt}`,
      `Pontos: ${points}`,
      "",
      `Exames faltantes: ${missingExams.length ? missingExams.join(", ") : "nenhum"}`,
      `Medicações faltantes: ${missingMeds.length ? missingMeds.join(", ") : "nenhuma"}`,
      `Exames prejudiciais: ${wrongExams.length ? wrongExams.join(", ") : "nenhum"}`,
      `Medicações prejudiciais: ${wrongMeds.length ? wrongMeds.join(", ") : "nenhuma"}`
    ].join("\n");

    this.setInfo("Relatório do Caso", msg);
    this.toast(diagCorrect ? "Caso concluído (acerto)" : "Caso concluído (erro)");
  }

  toast(text){
    if (!this.toastEl){
      this.toastEl = document.createElement("div");
      this.toastEl.className = "toast";
      document.body.appendChild(this.toastEl);
    }
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastEl._t);
    this.toastEl._t = setTimeout(() => this.toastEl.classList.remove("show"), 1800);
  }
}

/* =========================
   Boot
   ========================= */
(async function boot(){
  const ui = new GameUI();
  const engine = new GameEngine(ui);
  window.engine = engine;

  await engine.loadData();
  ui.init(engine);

  // Se já tem perfil, pula direto pro office (opcional)
  if (playerProfile && playerProfile.name){
    // deixa a capa ativa; usuário toca e entra normal
  }
})();