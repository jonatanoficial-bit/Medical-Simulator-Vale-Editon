# Simulador Médico Residente — Parte 3 (Assets AAA)

Esta entrega foca em **visual cinematográfico** (mobile-first) e em um **pipeline de assets** local para você encaixar suas imagens do GitHub, mantendo a arquitetura **Data/Engine/UI** intacta.

## O que mudou nesta Parte 3

- **Backgrounds cinematográficos** por tela (controlado por `body[data-scene]`).
  - `start` (menu/avatares)
  - `er` (plantão)
- **Avatares realistas** em `images/avatar_01.png ... avatar_06.png`.
- **Cartões de avatar** com overlay (nome/cargo) para ficar com cara de jogo comercial.
- **Preload + verificação leve de assets** (não bloqueia o jogo; só avisa no console se faltar).
- **Script para baixar suas imagens do GitHub** e substituir os assets locais:
  - `tools/fetch_github_images.sh`

## Como rodar

Use um servidor estático (recomendado):

- VSCode Live Server
- `python -m http.server 5173`
- `npx serve`

Acesse:
- `http://localhost:5173`

> Evite abrir via `file://` (pode bloquear scripts por política do navegador).

## Pipeline para encaixar suas imagens do GitHub

1. Abra um terminal na pasta do projeto.
2. Rode:
   - `bash tools/fetch_github_images.sh`
3. Recarregue o jogo.

Se seus arquivos tiverem **nomes diferentes**, edite a lista `FILES=(...)` no script.

## Estrutura

- `data/` — casos e configs
- `engine/` — regras do jogo (sem DOM)
- `ui/` — telas e componentes (DOM)
- `images/` — backgrounds/avatares (assets)
- `tools/` — scripts auxiliares

## Parte 4 – Pipeline de Conteúdo (Casos/DLC)

- **Mais casos clínicos** adicionados em `data/cases.js` (vários serviços).
- Validador sem dependências: `python tools/validate_cases.py`.
- Esquema mínimo: `data/case_schema_min.json`.

> Dica: rode o validador antes de commitar novos casos ou DLCs.

