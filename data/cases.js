// Camada de Dados/Conteúdo
// Casos clínicos são dados (sem lógica). Para adicionar conteúdo, edite aqui ou crie novos arquivos (DLC).

window.MedSim = window.MedSim || {};
window.MedSim.Data = window.MedSim.Data || {};

window.MedSim.Data.CASES = [
  {
    id: "case_infarto_01",
    title: "Dor torácica típica",
    specialty: "Cardiologia",
    difficulty: 1,
    // Triagem: 1=vermelho, 2=laranja, 3=amarelo
    triage: 2,
    // Ajuste fino por caso (opcional). Se ausente, usa CONFIG.simulation.deterioration
    deterioration: { stableToUnstableSec: 30, unstableToCriticalSec: 22, criticalToDeadSec: 18 },
    patient: { name: "Carlos A.", age: 54, sex: "M" },
    chiefComplaint: "Dor no peito há 40 minutos, pressão em aperto, irradiando para braço esquerdo.",
    history: [
      "Hipertensão. Tabagista (30 maços/ano).",
      "Náuseas e sudorese.",
      "Nega trauma."
    ],
    vitalsInitial: { hr: 102, rr: 20, spo2: 96, sbp: 148, dbp: 92, temp: 36.8 },
    physicalFindings: [
      "Paciente ansioso, sudoreico.",
      "Ausculta cardíaca sem sopros evidentes.",
      "Pulmões sem estertores."
    ],
    exams: {
      ecg: "ECG: supra de ST em derivações inferiores (DII, DIII, aVF).",
      labs: "Troponina: elevada. Hemograma sem alterações relevantes.",
      xray: "RX tórax: sem sinais de congestão."
    },
    treatments: {
      oxygen: { text: "Oxigênio suplementar (se necessário)." },
      aspirin: { text: "AAS administrado." },
      nitro: { text: "Nitrato sublingual (se não houver contraindicação)." }
    },
    correct: {
      diagnosis: "Infarto Agudo do Miocárdio (IAM)",
      requiredExams: ["ecg"],
      helpfulExams: ["labs"],
      requiredTreatments: ["aspirin"],
      criticalMistakes: ["send_home"]
    },
    education: {
      summary: "Dor torácica típica exige ECG precoce e manejo de síndrome coronariana aguda.",
      keyPoints: [
        "ECG em até 10 minutos em suspeita de SCA.",
        "AAS reduz mortalidade quando não há contraindicação.",
        "Atraso no reconhecimento aumenta risco de arritmia e choque."
      ]
    }
  },
  {
    id: "case_pneumonia_01",
    title: "Febre e dispneia",
    specialty: "Clínica Médica",
    difficulty: 1,
    triage: 3,
    deterioration: { stableToUnstableSec: 45, unstableToCriticalSec: 35, criticalToDeadSec: 25 },
    patient: { name: "Mariana S.", age: 37, sex: "F" },
    chiefComplaint: "Febre há 3 dias e falta de ar progressiva.",
    history: [
      "Tosse produtiva. Dor pleurítica leve.",
      "Sem comorbidades conhecidas.",
      "Sem alergias."
    ],
    vitalsInitial: { hr: 118, rr: 28, spo2: 90, sbp: 110, dbp: 70, temp: 38.9 },
    physicalFindings: [
      "Taquipneia, uso discreto de musculatura acessória.",
      "Estertores em base direita."
    ],
    exams: {
      xray: "RX tórax: consolidação em base direita compatível com pneumonia.",
      labs: "Leucócitos: 16.000. PCR elevada.",
      ecg: "ECG: taquicardia sinusal."
    },
    treatments: {
      oxygen: { text: "Oxigênio suplementar iniciado." },
      antibiotics: { text: "Antibiótico iniciado (esquema empírico)." },
      fluids: { text: "Hidratação venosa iniciada." }
    },
    correct: {
      diagnosis: "Pneumonia Comunitária",
      requiredExams: ["xray"],
      helpfulExams: ["labs"],
      requiredTreatments: ["antibiotics"],
      criticalMistakes: ["no_antibiotics"]
    },
    education: {
      summary: "Pneumonia com hipoxemia requer imagem e antibiótico precoce.",
      keyPoints: [
        "RX tórax confirma padrão de consolidação.",
        "Antibiótico precoce reduz complicações.",
        "Hipoxemia exige O2 e reavaliação."
      ]
    }
  },
  {
    id: "case_anafilaxia_01",
    title: "Reação alérgica grave",
    specialty: "Emergência",
    difficulty: 2,
    triage: 1,
    deterioration: { stableToUnstableSec: 18, unstableToCriticalSec: 14, criticalToDeadSec: 12 },
    patient: { name: "João P.", age: 22, sex: "M" },
    chiefComplaint: "Inchaço no rosto, falta de ar e urticária após ingestão de amendoim.",
    history: [
      "História de alergia a amendoim na infância.",
      "Começou com prurido, evoluiu com chiado e tontura."
    ],
    vitalsInitial: { hr: 132, rr: 30, spo2: 88, sbp: 86, dbp: 52, temp: 36.5 },
    physicalFindings: [
      "Urticária difusa e edema de lábios.",
      "Sibilância difusa. Hipotensão."
    ],
    exams: {
      ecg: "ECG: taquicardia sinusal.",
      labs: "Gasometria: hipoxemia.",
      xray: "RX tórax: sem alterações agudas."
    },
    treatments: {
      epinephrine: { text: "Adrenalina IM administrada." },
      oxygen: { text: "Oxigênio suplementar iniciado." },
      fluids: { text: "Volume venoso iniciado." }
    },
    correct: {
      diagnosis: "Anafilaxia",
      requiredExams: [],
      helpfulExams: [],
      requiredTreatments: ["epinephrine"],
      criticalMistakes: ["delay_epi"]
    },
    education: {
      summary: "Anafilaxia é diagnóstico clínico e adrenalina IM é primeira linha.",
      keyPoints: [
        "Não esperar exames para tratar.",
        "Adrenalina IM precoce é a intervenção que salva vidas.",
        "Hipotensão responde a volume e suporte."
      ]
    }
  }
];
