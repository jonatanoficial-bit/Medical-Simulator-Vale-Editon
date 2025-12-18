// script.js
// Este módulo implementa a lógica principal do simulador, a camada de apresentação e a camada de dados.

class CaseRepository {
  constructor(cases) {
    this.cases = cases;
    this.usedCases = [];
  }

  /**
   * Retorna um caso aleatório e marca como usado (para evitar repetição imediata).
   */
  getRandomCase() {
    if (this.cases.length === 0) return null;
    // Se esgotou todos, recicla
    if (this.usedCases.length === this.cases.length) {
      this.usedCases = [];
    }
    let caseCandidate;
    do {
      const index = Math.floor(Math.random() * this.cases.length);
      caseCandidate = this.cases[index];
    } while (this.usedCases.includes(caseCandidate.id));
    this.usedCases.push(caseCandidate.id);
    return JSON.parse(JSON.stringify(caseCandidate)); // retorna cópia profunda
  }
}

class GameEngine {
  constructor(config, caseRepo, ui) {
    this.config = config;
    this.caseRepo = caseRepo;
    this.ui = ui;
    this.currentLevel = config.initialLevel;
    this.score = 0;
    this.errorCount = 0;
    this.patients = [];
    this.activePatientId = null;
    this.player = { name: '', avatarIndex: 0 };
    this.newPatientInterval = null;
    this.tickInterval = null;
  }

  setPlayer(name, avatarIndex) {
    this.player.name = name;
    this.player.avatarIndex = avatarIndex;
  }

  start() {
    // Inicializa variáveis de jogo
    this.patients = [];
    this.score = 0;
    this.errorCount = 0;
    this.activePatientId = null;
    this.currentLevel = this.config.initialLevel;
    this.ui.updateLevel(this.currentLevel);
    this.ui.updateScore(this.score);
    // Inicia timers
    this.spawnPatient();
    // Intervalo para criar novos pacientes
    if (this.newPatientInterval) clearInterval(this.newPatientInterval);
    this.newPatientInterval = setInterval(() => {
      if (this.patients.length < this.config.maxSimultaneousPatients) {
        this.spawnPatient();
      }
    }, this.config.newPatientIntervalSeconds * 1000);
    // Intervalo de atualização de timers
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      this.updatePatients();
    }, 1000);
  }

  spawnPatient() {
    const newCase = this.caseRepo.getRandomCase();
    if (!newCase) return;
    // Define paciente interno
    const patient = {
      id: Date.now() + Math.random(),
      case: newCase,
      status: 'Estável',
      deteriorationTimer: 60, // segundos até piorar; pode ser ajustado posteriormente
      actionsPerformed: new Set(),
      diagnosisMade: false,
      arrivedAt: new Date()
    };
    this.patients.push(patient);
    this.ui.renderPatientQueue(this.patients, this.activePatientId);
  }

  updatePatients() {
    // Atualiza temporizadores e status
    for (const patient of this.patients) {
      if (!patient.diagnosisMade) {
        patient.deteriorationTimer--;
        if (patient.deteriorationTimer <= 0) {
          if (patient.status === 'Estável') {
            patient.status = 'Instável';
            patient.deteriorationTimer = 30;
            this.ui.showNotification(`Paciente ${patient.case.name} piorou para instável!`);
          } else if (patient.status === 'Instável') {
            patient.status = 'Crítico';
            patient.deteriorationTimer = 20;
            this.ui.showNotification(`Paciente ${patient.case.name} piorou para crítico!`);
          } else if (patient.status === 'Crítico') {
            // Paciente morre
            patient.status = 'Óbito';
            patient.diagnosisMade = true;
            this.ui.showNotification(`Paciente ${patient.case.name} evoluiu a óbito por falta de atendimento!`);
            this.handlePatientDeath(patient);
          }
        }
      }
    }
    this.ui.renderPatientQueue(this.patients, this.activePatientId);
  }

  selectPatient(patientId) {
    this.activePatientId = patientId;
    const patient = this.patients.find(p => p.id === patientId);
    this.ui.renderPatientDetails(patient, this);
    this.ui.renderPatientQueue(this.patients, this.activePatientId);
  }

  performAction(patientId, actionKey) {
    const patient = this.patients.find(p => p.id === patientId);
    if (!patient || patient.diagnosisMade) return;
    patient.actionsPerformed.add(actionKey);
    // Dependendo da ação, atualizar UI ou lógica
    switch (actionKey) {
      case 'history':
        this.ui.displayHistory(patient.case.history);
        break;
      case 'exam':
        this.ui.displayExam(patient.case.examFindings);
        break;
      case 'test_ecg':
        this.ui.displayTest('ECG', patient.case.tests.ecg);
        break;
      case 'test_blood':
        // combinar múltiplos possíveis campos: troponina/dDimero/hemograma
        const bloodResults = [];
        ['troponina', 'dDimero', 'hemograma'].forEach(key => {
          if (patient.case.tests[key]) bloodResults.push(`${key}: ${patient.case.tests[key]}`);
        });
        this.ui.displayTest('Exames de sangue', bloodResults.join('<br/>') || 'Sem dados');
        break;
      case 'test_imagem':
        // mostrar primeira imagem disponível
        const imageKeys = ['raiox', 'angioTC', 'ultrassom', 'tomografia'];
        const imgResults = [];
        imageKeys.forEach(key => {
          if (patient.case.tests[key]) imgResults.push(`${key}: ${patient.case.tests[key]}`);
        });
        this.ui.displayTest('Exames de imagem', imgResults.join('<br/>') || 'Sem dados');
        break;
      case 'admin_asa':
        this.ui.displayTreatment('Ácido Acetilsalicílico administrado.');
        break;
      case 'admin_anticoagulante':
        this.ui.displayTreatment('Heparina/anticoagulante administrado.');
        break;
      case 'admin_antibiotico':
        this.ui.displayTreatment('Antibiótico administrado.');
        break;
      case 'admin_oxigenio':
        this.ui.displayTreatment('Oxigênio suplementar administrado.');
        break;
      case 'refer_cirurgia':
        this.ui.displayTreatment('Paciente encaminhado para cirurgia.');
        break;
      default:
        break;
    }
  }

  finalizeDiagnosis(patientId, chosenDiagnosis) {
    const patient = this.patients.find(p => p.id === patientId);
    if (!patient || patient.diagnosisMade) return;
    patient.diagnosisMade = true;
    // Avalia com DiagnosisEvaluator
    const feedback = DiagnosisEvaluator.evaluate(patient.case, patient.actionsPerformed, chosenDiagnosis, this.config.scoring);
    // Atualiza pontuação e erros
    this.score += feedback.points;
    this.ui.updateScore(this.score);
    if (!feedback.correct) {
      this.errorCount++;
    }
    // Remove paciente da fila
    this.patients = this.patients.filter(p => p.id !== patientId);
    // Exibe feedback modal
    this.ui.showFeedback(feedback);
    // Verifica progresso de nível
    this.checkProgression();
    // Atualiza fila e detalhes
    this.activePatientId = null;
    this.ui.renderPatientQueue(this.patients, this.activePatientId);
    this.ui.renderPatientDetails(null, this);
  }

  checkProgression() {
    const req = this.config.levelRequirements[String(this.currentLevel)];
    // Calcular precisão: pontuação de casos acertados / total casos atendidos
    // Simplificação: se erroCount > maxErrors => game over
    if (this.errorCount > req.maxErrors) {
      this.endGame(`Você cometeu muitos erros no nível ${this.currentLevel}.`);
      return;
    }
    // Nível sobe se pontuação >= basePoints * número de casos atendidos * minAccuracy
    const casesAttended = this.score / this.config.scoring.basePoints;
    const minPoints = casesAttended * this.config.scoring.basePoints * req.minAccuracy;
    if (this.score >= minPoints && casesAttended >= 3) {
      // sobe nível até máximo configurado
      if (this.config.levelRequirements[String(this.currentLevel + 1)]) {
        this.currentLevel++;
        this.ui.updateLevel(this.currentLevel);
        this.ui.showNotification(`Parabéns! Você alcançou o nível ${this.currentLevel}.`);
      }
    }
  }

  handlePatientDeath(patient) {
    // Penaliza pontuação e erros
    this.score -= this.config.scoring.deathPenalty;
    if (this.score < 0) this.score = 0;
    this.errorCount++;
    this.ui.updateScore(this.score);
    this.ui.renderPatientQueue(this.patients, this.activePatientId);
    this.checkProgression();
  }

  endGame(message) {
    // Para timers
    clearInterval(this.newPatientInterval);
    clearInterval(this.tickInterval);
    // Exibe modal de game over
    this.ui.showGameOver(message, this.score);
  }
}

class DiagnosisEvaluator {
  /**
   * Compara as ações realizadas e diagnóstico escolhido com o gabarito do caso.
   * Retorna um objeto com resultado, pontos e mensagens.
   * @param {Object} caseData Dados do caso clínico
   * @param {Set<string>} actions Ações realizadas pelo jogador
   * @param {string} chosenDiagnosis Diagnóstico selecionado
   * @param {Object} scoring Configuração de pontuação
   */
  static evaluate(caseData, actions, chosenDiagnosis, scoring) {
    let correctDiagnosis = chosenDiagnosis.trim().toLowerCase() === caseData.diagnosis.toLowerCase();
    // Conta quantas ações obrigatórias foram cumpridas
    let correctActionsCount = 0;
    for (const req of caseData.requiredActions) {
      if (actions.has(req)) correctActionsCount++;
    }
    // Pontuação base
    let points = scoring.basePoints;
    // Bônus por cada ação correta
    points += correctActionsCount * scoring.correctActionBonus;
    // Se diagnóstico incorreto, penaliza
    if (!correctDiagnosis) {
      points -= scoring.errorPenalty;
    }
    if (points < 0) points = 0;
    // Mensagens de feedback
    const messages = [];
    if (correctDiagnosis) {
      messages.push(`<strong>Diagnóstico correto!</strong> Você identificou ${caseData.diagnosis}.`);
    } else {
      messages.push(`<strong>Diagnóstico incorreto.</strong> Diagnóstico correto: ${caseData.diagnosis}.`);
    }
    // Avalia ações
    caseData.requiredActions.forEach(req => {
      if (actions.has(req)) {
        messages.push(`Ação correta realizada: ${DiagnosisEvaluator.describeAction(req)}.`);
      } else {
        messages.push(`Você não realizou a ação obrigatória: ${DiagnosisEvaluator.describeAction(req)}.`);
      }
    });
    return {
      correct: correctDiagnosis && correctActionsCount === caseData.requiredActions.length,
      points: points,
      messages: messages
    };
  }
  /**
   * Retorna uma descrição legível de uma chave de ação.
   */
  static describeAction(actionKey) {
    switch (actionKey) {
      case 'history': return 'coletar história clínica';
      case 'exam': return 'realizar exame físico';
      case 'test_ecg': return 'solicitar ECG';
      case 'test_blood': return 'solicitar exames de sangue';
      case 'test_imagem': return 'solicitar exame de imagem';
      case 'admin_asa': return 'administrar ácido acetilsalicílico';
      case 'admin_anticoagulante': return 'administrar anticoagulante';
      case 'admin_antibiotico': return 'administrar antibiótico';
      case 'admin_oxigenio': return 'administrar oxigênio';
      case 'refer_cirurgia': return 'encaminhar para cirurgia';
      default: return actionKey;
    }
  }
}

class UIController {
  constructor() {
    this.queueContainer = document.getElementById('patient-queue');
    this.detailsContainer = document.getElementById('patient-details');
    this.levelDisplay = document.getElementById('level-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.timerDisplay = document.getElementById('timer-display');
    this.feedbackModal = document.getElementById('feedback-modal');
    this.feedbackBody = document.getElementById('feedback-body');
    this.feedbackClose = document.getElementById('feedback-close');
    this.gameOverModal = document.getElementById('gameover-modal');
    this.gameOverMessage = document.getElementById('gameover-message');
    this.restartButton = document.getElementById('restart-button');
    // Notifications: simple method using alert; could be replaced
  }
  updateLevel(level) {
    this.levelDisplay.textContent = `Nível ${level}`;
  }
  updateScore(score) {
    this.scoreDisplay.textContent = `Pontuação: ${score}`;
  }
  renderPatientQueue(patients, activeId) {
    this.queueContainer.innerHTML = '';
    if (patients.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = 'Sem pacientes na fila.';
      this.queueContainer.appendChild(emptyEl);
      return;
    }
    patients.forEach(patient => {
      const card = document.createElement('div');
      card.className = 'patient-card';
      if (patient.id === activeId) card.classList.add('active');
      card.addEventListener('click', () => {
        if (typeof window.gameEngine !== 'undefined') {
          window.gameEngine.selectPatient(patient.id);
        }
      });
      const title = document.createElement('h4');
      title.textContent = patient.case.name;
      const subtitle = document.createElement('p');
      subtitle.innerHTML = `${patient.case.chiefComplaint}<br/><span style="font-weight:bold">Status:</span> ${patient.status}`;
      card.appendChild(title);
      card.appendChild(subtitle);
      this.queueContainer.appendChild(card);
    });
  }
  renderPatientDetails(patient, engine) {
    this.detailsContainer.innerHTML = '';
    if (!patient) {
      const msg = document.createElement('h2');
      msg.textContent = 'Selecione um paciente para começar';
      this.detailsContainer.appendChild(msg);
      return;
    }
    // Cabeçalho
    const header = document.createElement('div');
    header.innerHTML = `<h2>${patient.case.name} (${patient.case.age} anos)</h2><p><strong>Queixa:</strong> ${patient.case.chiefComplaint}</p>`;
    this.detailsContainer.appendChild(header);
    // Contêiner de informações reveladas
    const infoContainer = document.createElement('div');
    infoContainer.id = 'info-container';
    this.detailsContainer.appendChild(infoContainer);
    // Ações
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    // History
    const btnHistory = this.createActionButton('História Clínica', 'fa-book-medical', () => {
      engine.performAction(patient.id, 'history');
    });
    // Exam
    const btnExam = this.createActionButton('Exame Físico', 'fa-stethoscope', () => {
      engine.performAction(patient.id, 'exam');
    });
    // Tests
    const btnTests = this.createActionButton('Exames', 'fa-flask', () => {
      // Cria submenu de exames
      this.showTestMenu(patient, engine);
    });
    // Treatments
    const btnTreatments = this.createActionButton('Tratamentos', 'fa-pills', () => {
      this.showTreatmentMenu(patient, engine);
    });
    // Diagnosis
    const btnDiagnose = this.createActionButton('Dar Diagnóstico', 'fa-notes-medical', () => {
      this.showDiagnosisDialog(patient, engine);
    });
    actionsDiv.appendChild(btnHistory);
    actionsDiv.appendChild(btnExam);
    actionsDiv.appendChild(btnTests);
    actionsDiv.appendChild(btnTreatments);
    actionsDiv.appendChild(btnDiagnose);
    this.detailsContainer.appendChild(actionsDiv);
  }
  createActionButton(text, iconClass, handler) {
    const btn = document.createElement('button');
    // Utiliza emoji conforme o tipo de ação para eliminar dependência de fontes externas
    let emoji;
    switch (iconClass) {
      case 'fa-book-medical': emoji = '📖'; break;
      case 'fa-stethoscope': emoji = '🩺'; break;
      case 'fa-flask': emoji = '🧪'; break;
      case 'fa-pills': emoji = '💊'; break;
      case 'fa-notes-medical': emoji = '📄'; break;
      default: emoji = '';
    }
    btn.textContent = `${emoji} ${text}`;
    btn.addEventListener('click', handler);
    return btn;
  }
  displayHistory(history) {
    const info = document.getElementById('info-container');
    const section = document.createElement('div');
    section.innerHTML = `<h3>História Clínica</h3><p>${history}</p>`;
    info.appendChild(section);
  }
  displayExam(findings) {
    const info = document.getElementById('info-container');
    const section = document.createElement('div');
    section.innerHTML = `<h3>Exame Físico</h3><p>${findings}</p>`;
    info.appendChild(section);
  }
  displayTest(title, result) {
    const info = document.getElementById('info-container');
    const section = document.createElement('div');
    section.innerHTML = `<h3>${title}</h3><p>${result || 'Sem resultados'}</p>`;
    info.appendChild(section);
  }
  displayTreatment(description) {
    const info = document.getElementById('info-container');
    const section = document.createElement('div');
    section.innerHTML = `<h3>Tratamento</h3><p>${description}</p>`;
    info.appendChild(section);
  }
  showFeedback(feedback) {
    this.feedbackBody.innerHTML = `<ul>${feedback.messages.map(m => `<li>${m}</li>`).join('')}</ul><p><strong>Pontuação obtida:</strong> ${feedback.points}</p>`;
    this.feedbackModal.classList.remove('hidden');
  }
  showGameOver(message, score) {
    this.gameOverMessage.innerHTML = `${message}<br/>Sua pontuação final foi ${score}.`;
    this.gameOverModal.classList.remove('hidden');
  }
  showNotification(text) {
    // Simples toast: para fins demonstrativos usamos alert
    console.log(text);
    // Poderíamos implementar toast animado aqui
  }
  showTestMenu(patient, engine) {
    // Cria menu simples via prompt; podemos aprimorar para modal
    const availableTests = [];
    if (patient.case.tests.ecg) availableTests.push({ key: 'test_ecg', label: 'ECG' });
    if (patient.case.tests.troponina || patient.case.tests.dDimero || patient.case.tests.hemograma) availableTests.push({ key: 'test_blood', label: 'Exames de sangue' });
    if (patient.case.tests.raiox || patient.case.tests.angioTC || patient.case.tests.ultrassom || patient.case.tests.tomografia) availableTests.push({ key: 'test_imagem', label: 'Exames de imagem' });
    if (availableTests.length === 0) {
      alert('Nenhum exame disponível.');
      return;
    }
    const optionsStr = availableTests.map((t, i) => `${i + 1}. ${t.label}`).join('\n');
    const choice = prompt(`Escolha um exame:\n${optionsStr}`);
    const idx = parseInt(choice, 10) - 1;
    if (!isNaN(idx) && availableTests[idx]) {
      engine.performAction(patient.id, availableTests[idx].key);
    }
  }
  showTreatmentMenu(patient, engine) {
    const availableTreatments = [
      { key: 'admin_asa', label: 'Ácido Acetilsalicílico' },
      { key: 'admin_anticoagulante', label: 'Anticoagulante' },
      { key: 'admin_antibiotico', label: 'Antibiótico' },
      { key: 'admin_oxigenio', label: 'Oxigênio' },
      { key: 'refer_cirurgia', label: 'Encaminhar para Cirurgia' }
    ];
    const optionsStr = availableTreatments.map((t, i) => `${i + 1}. ${t.label}`).join('\n');
    const choice = prompt(`Escolha um tratamento:\n${optionsStr}`);
    const idx = parseInt(choice, 10) - 1;
    if (!isNaN(idx) && availableTreatments[idx]) {
      engine.performAction(patient.id, availableTreatments[idx].key);
    }
  }
  showDiagnosisDialog(patient, engine) {
    // Lista diagnósticos disponíveis de casos
    const diagnoses = [
      'Infarto Agudo do Miocárdio',
      'Embolia Pulmonar',
      'Apendicite Aguda'
    ];
    const optionsStr = diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const choice = prompt(`Escolha o diagnóstico para o paciente:\n${optionsStr}`);
    const idx = parseInt(choice, 10) - 1;
    if (!isNaN(idx) && diagnoses[idx]) {
      engine.finalizeDiagnosis(patient.id, diagnoses[idx]);
    }
  }
}

// Controle de fluxo da aplicação
document.addEventListener('DOMContentLoaded', () => {
  // Dados embutidos para evitar problemas de carregamento de arquivo local
  const casesData = [
    {
      id: 1,
      name: 'José Silva',
      age: 45,
      gender: 'M',
      chiefComplaint: 'Dor torácica súbita acompanhada de náuseas',
      history: 'Fumante, hipertenso, histórico familiar de infarto',
      vitals: {
        pressao: '160/100 mmHg',
        freqCardiaca: '98 bpm',
        saturacao: '94%',
        temperatura: '36.8 °C'
      },
      examFindings: 'Ausculta pulmonar sem estertores, dor retroesternal que não melhora com mudança de posição.',
      tests: {
        ecg: 'Elevação do segmento ST em D2, D3 e avF.',
        troponina: 'Aumentada (2,5 ng/mL)',
        raiox: 'Infiltrado discreto em base esquerda'
      },
      requiredActions: ['test_ecg', 'test_blood', 'admin_asa'],
      diagnosis: 'Infarto Agudo do Miocárdio'
    },
    {
      id: 2,
      name: 'Maria Oliveira',
      age: 30,
      gender: 'F',
      chiefComplaint: 'Falta de ar súbita e dor torácica pleurítica',
      history: 'Uso recente de anticoncepcional oral, imobilização devido a fratura de tornozelo há duas semanas',
      vitals: {
        pressao: '110/70 mmHg',
        freqCardiaca: '110 bpm',
        saturacao: '90%',
        temperatura: '37.0 °C'
      },
      examFindings: 'Paciente ansiosa, taquipneica, roncos esparsos à ausculta pulmonar.',
      tests: {
        dDimero: 'Elevado (2.0 µg/mL)',
        angioTC: 'Trombo em artéria pulmonar direita',
        gasometria: 'pO2 60 mmHg, pCO2 32 mmHg, pH 7.45'
      },
      requiredActions: ['test_imagem', 'admin_anticoagulante', 'admin_oxigenio'],
      diagnosis: 'Embolia Pulmonar'
    },
    {
      id: 3,
      name: 'João Ferreira',
      age: 55,
      gender: 'M',
      chiefComplaint: 'Dor abdominal intensa no quadrante inferior direito',
      history: 'Dor há 12 horas, náuseas, sem apetite, histórico prévio de apendicite na família',
      vitals: {
        pressao: '120/80 mmHg',
        freqCardiaca: '88 bpm',
        saturacao: '97%',
        temperatura: '38.5 °C'
      },
      examFindings: 'Sensibilidade aumentada e defesa abdominal no quadrante inferior direito, sinal de Blumberg positivo.',
      tests: {
        hemograma: 'Leucócitos 16.000/mm³, neutrofilia',
        ultrassom: 'Inflamação de apêndice, diâmetro aumentado',
        tomografia: 'Confirmando apendicite aguda'
      },
      requiredActions: ['test_blood', 'test_imagem', 'refer_cirurgia'],
      diagnosis: 'Apendicite Aguda'
    }
  ];
  const configData = {
    initialLevel: 1,
    maxSimultaneousPatients: 2,
    newPatientIntervalSeconds: 60,
    levelRequirements: {
      '1': { minAccuracy: 0.5, maxErrors: 3 },
      '2': { minAccuracy: 0.7, maxErrors: 2 },
      '3': { minAccuracy: 0.9, maxErrors: 1 }
    },
    scoring: {
      basePoints: 100,
      correctActionBonus: 20,
      timeBonusMultiplier: 1,
      errorPenalty: 50,
      deathPenalty: 100
    }
  };
  const caseRepo = new CaseRepository(casesData);
  const ui = new UIController();
  const engine = new GameEngine(configData, caseRepo, ui);
  // Expor engine globalmente para acesso nos eventos
  window.gameEngine = engine;
  // Configurar UI de início
  // Avatares representados por emojis para eliminar dependência de ícones externos
  const avatars = [
    { emoji: '\uD83D\uDC68\u200D⚕️', color: '#007bff' }, // homem médico
    { emoji: '\uD83D\uDC69\u200D⚕️', color: '#28a745' }, // mulher médica
    { emoji: '\uD83E\uDDD1\u200D⚕️', color: '#dc3545' }, // pessoa médica
    { emoji: '\uD83D\uDC69\u200D🔬', color: '#ffc107' } // pesquisadora
  ];
  const avatarContainer = document.getElementById('avatar-options');
  let selectedAvatarIndex = 0;
  avatars.forEach((av, index) => {
    const item = document.createElement('div');
    item.className = 'avatar-item';
    if (index === 0) item.classList.add('selected');
    // Define cor de fundo
    item.style.backgroundColor = av.color;
    // Cria span para o emoji centralizado
    const span = document.createElement('span');
    span.textContent = av.emoji;
    span.style.fontSize = '32px';
    span.style.display = 'flex';
    span.style.alignItems = 'center';
    span.style.justifyContent = 'center';
    span.style.width = '100%';
    span.style.height = '100%';
    item.appendChild(span);
    item.addEventListener('click', () => {
      document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectedAvatarIndex = index;
    });
    avatarContainer.appendChild(item);
  });
  const startButton = document.getElementById('start-button');
  startButton.addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    if (!name) {
      alert('Por favor, insira seu nome.');
      return;
    }
    // Atualiza dados do jogador
    engine.setPlayer(name, selectedAvatarIndex);
    // Atualiza exibição
    // Limpa display anterior
    const playerDisplay = document.getElementById('player-name-display');
    playerDisplay.textContent = '';
    // Cria span para emoji e adiciona nome do jogador
    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = avatars[selectedAvatarIndex].emoji;
    emojiSpan.style.marginRight = '6px';
    playerDisplay.appendChild(emojiSpan);
    playerDisplay.appendChild(document.createTextNode(name));
    // Transiciona tela
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    // Inicia jogo
    engine.start();
  });
  // Feedback close
  ui.feedbackClose.addEventListener('click', () => {
    ui.feedbackModal.classList.add('hidden');
  });
  // Restart button
  ui.restartButton.addEventListener('click', () => {
    ui.gameOverModal.classList.add('hidden');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
    // Limpa avatares selecionados e campos
    document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
    document.querySelector('.avatar-item').classList.add('selected');
    document.getElementById('player-name').value = '';
    // Reset engine
    engine.endGame = () => {}; // no-op
  });
});