/* ============================================================
   Simulador Médico - Versão 1.0 (Web)
   - UI: Camadas de telas + overlays
   - Engine: motor de plantão + fisiologia (simplificado)
   - Persistência: localStorage
   ============================================================ */

// ================================
// Perfil do jogador (evita tela branca no lobby)
// ================================
function loadPlayerProfile() {
  try {
    const raw = localStorage.getItem('medsim_playerProfile');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function savePlayerProfile(profile) {
  try {
    localStorage.setItem('medsim_playerProfile', JSON.stringify(profile));
  } catch (e) {}
}
let playerProfile = loadPlayerProfile();
if (playerProfile) {
  window.playerProfile = playerProfile;
}

class GameEngine {
  constructor(ui) {
    this.ui = ui;
    this.config = {
      initialLevel: 1,
      maxErrors: 3,
      baseNewPatientIntervalMs: 12000,
      tickMs: 1000,
      training: {
        deteriorationMultiplier: 0.35,
        penaltyMultiplier: 0.35
      },
      shift: {
        deteriorationMultiplier: 1.0,
        penaltyMultiplier: 1.0
      }
    };

    this.mode = 'shift'; // 'shift' ou 'training'
    this.player = { name: 'Residente', avatarIndex: 0 };
    this.newPatientInterval = null;
    this.tickInterval = null;

    this.patients = [];
    this.score = 0;
    this.totalScore = 0;
    this.errorCount = 0;
    this.activePatientId = null;

    this.currentLevel = this.config.initialLevel;

    // Estatísticas gerais
    this.stats = { correct: 0, incorrect: 0, deaths: 0 };
    this.casesAttended = 0;

    // Carregamento de dados
    this.cases = [];
    this.caseIndex = 0;
    this.specialtyFilter = 'all';
    this.loaded = false;
  }

  async loadData() {
    // Tenta carregar via fetch (GitHub Pages/Vercel)
    try {
      const casesRes = await fetch('data/cases.json', { cache: 'no-store' });
      if (casesRes.ok) {
        const data = await casesRes.json();
        this.cases = Array.isArray(data) ? data : (data.cases || []);
      }
    } catch (e) {
      // fallback: se abrir via file:// no celular (CORS), mantém o mínimo
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

  setSpecialtyFilter(value) {
    this.specialtyFilter = value || 'all';
  }

  setMode(mode) {
    this.mode = mode === 'training' ? 'training' : 'shift';
  }

  start() {
    this.patients = [];
    this.score = 0;
    this.errorCount = 0;
    this.activePatientId = null;
    this.currentLevel = this.config.initialLevel;

    this.ui.updateLevel(this.currentLevel);
    this.ui.updateScore(this.score);

    // reseta estatísticas do plantão (mantém total no perfil)
    this.casesAttended = 0;
    this.stats = this.stats || { correct: 0, incorrect: 0, deaths: 0 };

    // Inicia tick e geração de pacientes
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);

    this.tickInterval = setInterval(() => this.tick(), this.config.tickMs);

    const base = this.config.baseNewPatientIntervalMs;
    this.newPatientInterval = setInterval(() => this.spawnPatient(), base);
    // já começa com 2 pacientes
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
    const mult = this.mode === 'training'
      ? this.config.training.deteriorationMultiplier
      : this.config.shift.deteriorationMultiplier;

    for (const p of this.patients) {
      if (p.status === 'dead' || p.status === 'discharged') continue;

      // deterioração gradual
      p.time += 1;

      // piora se sem conduta
      const deterioration = 0.08 * mult;
      p.severity = clamp(p.severity + deterioration, 0, 1);

      // vitais variam conforme severidade
      p.vitals.hr = Math.round(70 + p.severity * 60 + randomBetween(-3, 3));
      p.vitals.rr = Math.round(14 + p.severity * 14 + randomBetween(-2, 2));
      p.vitals.spo2 = Math.round(98 - p.severity * 18 + randomBetween(-1, 1));
      p.vitals.sys = Math.round(125 - p.severity * 40 + randomBetween(-3, 3));
      p.vitals.temp = round1(36.7 + p.severity * 2.2 + randomBetween(-0.2, 0.2));

      // efeitos de tratamentos ativos
      this.applyQueuedEffects(p);

      // morte se severidade extrema e tempo alto
      if (p.severity >= 0.98 && p.time > 30) {
        p.status = 'dead';
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
      if (this.specialtyFilter === 'all') return true;
      return (c.specialty || '').toLowerCase() === this.specialtyFilter.toLowerCase();
    });

    const caseData = candidateCases.length > 0
      ? candidateCases[Math.floor(Math.random() * candidateCases.length)]
      : this.cases[Math.floor(Math.random() * this.cases.length)];

    const id = `p_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const gender = caseData.gender || (Math.random() > 0.5 ? 'male' : 'female');

    const patient = {
      id,
      caseId: caseData.id,
      name: randomName(gender),
      gender,
      age: caseData.age || randomBetweenInt(18, 80),
      complaint: caseData.complaint || 'Queixa inespecífica.',
      history: caseData.history || 'Sem dados adicionais.',
      physicalExam: caseData.physicalExam || 'Sem alterações relevantes.',
      diagnosis: caseData.diagnosis || 'Diagnóstico não definido.',
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
      status: 'waiting',
      vitals: {
        hr: 92,
        rr: 18,
        spo2: 97,
        sys: 128,
        temp: 36.8
      }
    };

    this.patients.unshift(patient);
    if (!this.activePatientId) {
      this.activePatientId = patient.id;
    }
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }

  setActivePatient(id) {
    this.activePatientId = id;
    const p = this.getActivePatient();
    if (p) p.status = p.status === 'waiting' ? 'in_care' : p.status;
    this.ui.renderPatientDetails(p, this);
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }

  getActivePatient() {
    return this.patients.find(p => p.id === this.activePatientId) || null;
  }

  performAction(patientId, action, payload) {
    const p = this.patients.find(x => x.id === patientId);
    if (!p || p.status === 'dead') return;

    if (action === 'history') {
      p.requested.history = true;
      this.ui.showInfo(p, 'História Clínica', p.history);
      return;
    }

    if (action === 'physical_exam') {
      p.requested.physical_exam = true;
      const vitalsTxt = formatVitals(p.vitals);
      this.ui.showInfo(p, 'Exame Físico', `${p.physicalExam}\n\nSinais vitais:\n${vitalsTxt}`);
      return;
    }

    if (action === 'request_exam') {
      const examKey = payload?.examKey;
      if (!examKey) return;
      if (!p.requested.exams.includes(examKey)) {
        p.requested.exams.push(examKey);
      }

      // tempo de resposta (realismo)
      const baseDelay = getExamDelaySeconds(examKey);
      const mult = this.mode === 'training' ? 0.55 : 1.0;
      const delay = Math.max(2, Math.round(baseDelay * mult));

      const result = p.examResults?.[examKey] || 'Sem alterações específicas.';
      p.queuedEffects.push({
        type: 'exam_result',
        examKey,
        result,
        readyAt: p.time + delay
      });

      this.ui.toast(`Exame solicitado: ${examKey} (resultado em ~${delay}s)`);
      return;
    }

    if (action === 'give_med') {
      const medKey = payload?.medKey;
      if (!medKey) return;
      if (!p.requested.meds.includes(medKey)) {
        p.requested.meds.push(medKey);
      }

      // aplica efeito se existir
      const eff = p.medEffects?.[medKey];
      if (eff) {
        const delay = Math.max(1, eff.delaySeconds || 1);
        p.queuedEffects.push({
          type: 'med_effect',
          medKey,
          effect: eff,
          readyAt: p.time + delay
        });
      }

      this.ui.toast(`Medicação/Procedimento aplicado: ${medKey}`);
      return;
    }

    if (action === 'final_diagnosis') {
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
      if (e.type === 'exam_result') {
        this.ui.showExamResult(patient, e.examKey, e.result);
      }
      if (e.type === 'med_effect') {
        // melhora/piora severidade
        const delta = e.effect.severityDelta || 0;
        patient.severity = clamp(patient.severity + delta, 0, 1);
      }
    }
  }

  evaluateCase(patient) {
    // avalia escolhas
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

    // pontuação
    const penaltyMult = this.mode === 'training'
      ? this.config.training.penaltyMultiplier
      : this.config.shift.penaltyMultiplier;

    let points = 0;
    if (diagCorrect) points += 120;
    else points -= 90 * penaltyMult;

    points += (requiredExams.length - missingExams.length) * 12;
    points += (requiredMeds.length - missingMeds.length) * 18;

    points -= wrongExams.length * 10 * penaltyMult;
    points -= wrongMeds.length * 18 * penaltyMult;

    // tempo: quanto mais tempo, menos bônus
    const timePenalty = Math.max(0, Math.floor(patient.time / 6));
    points -= timePenalty * 2 * penaltyMult;

    // desfecho
    let outcome = 'stable';
    if (!diagCorrect && (wrongMeds.length > 0 || missingMeds.length > 1) && patient.severity > 0.85) {
      outcome = 'death';
    } else if (diagCorrect && missingMeds.length === 0) {
      outcome = 'improved';
    }

    if (outcome === 'death') {
      patient.status = 'dead';
      this.stats.deaths += 1;
      this.errorCount += 1;
      points -= 120 * penaltyMult;
    } else {
      patient.status = 'discharged';
    }

    this.casesAttended += 1;
    if (diagCorrect) this.stats.correct += 1;
    else this.stats.incorrect += 1;

    this.score += points;
    this.totalScore += points;
    this.ui.updateScore(this.score);

    // atualiza perfil persistente
    if (!playerProfile) playerProfile = window.playerProfile || null;
    if (playerProfile) {
      playerProfile.score = this.totalScore;
      playerProfile.level = this.currentLevel;
      playerProfile.role = getRankTitle(this.currentLevel);
      playerProfile.stats = this.stats;
      savePlayerProfile(playerProfile);
      window.playerProfile = playerProfile;
    }

    // mostra relatório
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

    // remove paciente da fila (mantém histórico se quiser)
    this.patients = this.patients.filter(p => p.id !== patient.id);

    // seleciona próximo
    if (this.patients.length > 0) {
      this.activePatientId = this.patients[0].id;
    } else {
      this.activePatientId = null;
      // spawn novo para continuidade
      this.spawnPatient();
      this.activePatientId = this.patients[0]?.id || null;
    }

    // promoção simples por pontuação total
    if (this.totalScore > 300 && this.currentLevel < 2) this.currentLevel = 2;
    if (this.totalScore > 800 && this.currentLevel < 3) this.currentLevel = 3;
    if (this.totalScore > 1500 && this.currentLevel < 4) this.currentLevel = 4;

    this.ui.updateLevel(this.currentLevel);
    this.ui.refreshPatients(this.patients, this.activePatientId);
  }
}

class GameUI {
  constructor() {
    // Screens
    this.coverScreen = document.getElementById('cover-screen');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.officeScreen = document.getElementById('office-screen');
    this.gameScreen = document.getElementById('game-screen');

    // Lobby/office fields
    this.avatarSelection = document.getElementById('avatar-selection');

    // Office UI
    this.officeAvatar = document.getElementById('office-avatar');
    this.officeName = document.getElementById('office-name');
    this.officeLevel = document.getElementById('office-level');
    this.officeScore = document.getElementById('office-score');
    this.statTotal = document.getElementById('stat-total');
    this.statCorrect = document.getElementById('stat-correct');
    this.statIncorrect = document.getElementById('stat-incorrect');
    this.statDeaths = document.getElementById('stat-deaths');

    this.specialtySelect = document.getElementById('specialty-select');
    this.modeSelect = document.getElementById('mode-select');

    // Game UI
    this.levelDisplay = document.getElementById('level-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.patientsList = document.getElementById('patients-list');
    this.patientDetails = document.getElementById('patient-details');

    // Overlays
    this.examPage = document.getElementById('exam-page');
    this.examContent = document.getElementById('exam-content');
    this.examBack = document.getElementById('exam-back');

    this.treatmentPage = document.getElementById('treatment-page');
    this.treatmentContent = document.getElementById('treatment-content');
    this.treatmentBack = document.getElementById('treatment-back');

    this.diagnosisPage = document.getElementById('diagnosis-page');
    this.diagnosisContent = document.getElementById('diagnosis-content');
    this.diagnosisBack = document.getElementById('diagnosis-back');

    // Toast
    this.toastEl = null;

    // Report modal
    this.reportOverlay = null;

    // Avatar choice
    this.selectedAvatarIndex = 0;
  }

  init(engine) {
    // tela capa: qualquer toque avança
    this.coverScreen.addEventListener('click', () => {
      this.coverScreen.classList.remove('active');
      this.welcomeScreen.classList.add('active');
    });

    this.welcomeScreen.addEventListener('click', () => {
      this.welcomeScreen.classList.remove('active');
      this.lobbyScreen.classList.add('active');
    });

    // render avatars
    this.renderAvatars();

    // fill specialties based on cases
    fillSpecialties(engine.cases, this.specialtySelect);

    // restore profile if exists
    if (playerProfile) {
      const nameInput = document.getElementById('player-name');
      nameInput.value = playerProfile.name || '';
      // tentar bater avatar pelo path
      const idx = avatars.findIndex(a => a.image === playerProfile.avatar);
      if (idx >= 0) this.selectedAvatarIndex = idx;
    }

    // start button
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', () => {
      const nameInput = document.getElementById('player-name');
      const name = nameInput.value.trim();
      if (!name) {
        alert('Por favor, insira seu nome.');
        return;
      }

      // Atualiza dados do jogador
      engine.setPlayer(name, this.selectedAvatarIndex);

      // Atualiza perfil persistente
      playerProfile = {
        name,
        avatar: avatars[this.selectedAvatarIndex].image,
        role: getRankTitle(engine.currentLevel),
        level: engine.currentLevel,
        score: (engine.totalScore !== undefined ? engine.totalScore : engine.score) || 0,
        stats: engine.stats || { correct: 0, incorrect: 0, deaths: 0 }
      };
      window.playerProfile = playerProfile;
      savePlayerProfile(playerProfile);

      // Atualiza exibição
      const playerDisplay = document.getElementById('player-name-display');
      const playerAvatarImg = document.getElementById('player-avatar');
      playerAvatarImg.src = avatars[this.selectedAvatarIndex].image;
      playerAvatarImg.style.display = 'inline-block';
      playerDisplay.textContent = '';
      playerDisplay.appendChild(document.createTextNode(name));

      // Transiciona para o consultório
      this.lobbyScreen.classList.remove('active');
      updateOfficeScreen(engine, this);
      this.officeScreen.classList.add('active');
    });

    // Próximo caso
    const nextCaseButton = document.getElementById('next-case-button');
    nextCaseButton.addEventListener('click', () => {
      const spec = this.specialtySelect.value;
      const mode = this.modeSelect.value;

      engine.setSpecialtyFilter(spec);
      engine.setMode(mode);

      this.officeScreen.classList.remove('active');
      this.gameScreen.classList.add('active');

      engine.start();
    });

    // voltar para consultório
    const backOffice = document.getElementById('back-office');
    backOffice.addEventListener('click', () => {
      engine.stop();
      this.gameScreen.classList.remove('active');
      updateOfficeScreen(engine, this);
      this.officeScreen.classList.add('active');
    });

    // overlay back buttons
    this.examBack.addEventListener('click', () => this.hideOverlay('exam'));
    this.treatmentBack.addEventListener('click', () => this.hideOverlay('treatment'));
    this.diagnosisBack.addEventListener('click', () => this.hideOverlay('diagnosis'));
  }

  renderAvatars() {
    this.avatarSelection.innerHTML = '';
    avatars.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.className = 'avatar-btn';
      btn.innerHTML = `<img src="${a.image}" alt="${a.name}" /><span>${a.name}</span>`;
      if (i === this.selectedAvatarIndex) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        this.selectedAvatarIndex = i;
        [...this.avatarSelection.querySelectorAll('.avatar-btn')].forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
      });
      this.avatarSelection.appendChild(btn);
    });
 