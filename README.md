# Simulador Médico Residente — Parte 1 (Base Sólida)

Esta entrega implementa a **fundação arquitetural** seguindo o documento de diretrizes:

- Separação clara de camadas: **Data / Engine / UI**
- Engine determinística com eventos (Pub/Sub)
- Persistência isolada (SaveManager)
- Conteúdo em dados (cases.js) — pronto para virar DLC/pacotes no futuro
- Interface mobile-first com layout "hospitalar" (base)

## Como rodar

### Opção A (mais simples): servidor local
Use qualquer servidor estático:

- VSCode Live Server
- `python -m http.server 5173`
- `npx serve` (se tiver)

Acesse:
- `http://localhost:5173`

> **Importante:** abrir direto via `file://` pode bloquear scripts por política do navegador.

## Estrutura

- `data/` — casos e configs
- `engine/` — regras do jogo (sem DOM)
- `ui/` — telas e componentes (DOM)
- `images/` — avatares/arte (substituível na Parte 5)

## Próximos passos (Parte 2)

- Múltiplos pacientes simultâneos (fila real)
- Simulação com deterioração por estado e intervenções
- Scheduler de eventos e tempos de exames mais realistas
