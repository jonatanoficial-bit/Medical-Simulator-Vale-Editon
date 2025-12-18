# Simulador de Pronto‑Atendimento

Este projeto é um protótipo interativo de um simulador médico, no qual o jogador assume o papel de médico residente em um pronto‑atendimento e precisa atender pacientes em fila, realizar avaliações, solicitar exames, administrar tratamentos e chegar a um diagnóstico final. O objetivo é oferecer uma experiência de jogo educacional e realista, com base nas diretrizes de um projeto maior para um simulador AAA.

## Estrutura do Projeto

O simulador está organizado em uma pequena aplicação front‑end, sem dependências de servidor. Os principais arquivos são:

- **index.html**: estrutura básica da aplicação, contendo as telas de início e de jogo.
- **style.css**: estilos para as telas, botões, cartões de pacientes e modais.
- **script.js**: implementa todas as camadas de lógica e UI em JavaScript:
  - `CaseRepository`: fornece casos clínicos a partir do arquivo JSON.
  - `GameEngine`: controla o fluxo geral do jogo (geração de pacientes, evolução de estado, pontuação, progressão de nível e fim de jogo).
  - `DiagnosisEvaluator`: avalia o atendimento realizado comparando ações com o gabarito do caso e calcula a pontuação.
  - `UIController`: gerencia a renderização da fila de pacientes, detalhes do paciente selecionado, modais e interações.
- **data/cases.json**: base de casos clínicos fictícios com sintomas, antecedentes, exames e diagnósticos corretos.
- **data/config.json**: configurações de jogo, como número máximo de pacientes simultâneos, intervalos de chegada, requisitos de nível e parâmetros de pontuação.

## Como Executar

1. Certifique‑se de ter um navegador moderno (Chrome, Firefox, Edge, etc.).
2. Baixe ou clone o diretório `medsim` e abra o arquivo `index.html` no navegador. Não é necessário servidor; basta abrir o arquivo diretamente.
3. Ao carregar, preencha seu nome, escolha um avatar e clique em **Começar** para iniciar o plantão.
4. Use o painel à esquerda para selecionar um paciente. Na área central, você poderá:
   - Coletar **História Clínica**.
   - Realizar **Exame Físico**.
   - Solicitar **Exames** (ex.: ECG, exames de sangue ou de imagem).
   - Aplicar **Tratamentos** (aspirina, anticoagulantes, antibióticos, oxigênio, encaminhamento para cirurgia).
   - Dar **Diagnóstico** final a partir de uma lista de diagnósticos disponíveis.
5. A cada ação, os resultados são exibidos no painel de informações. Após dar o diagnóstico, um relatório de feedback aparecerá com pontos e correções.
6. Pontuação, nível e fila de pacientes são atualizados em tempo real. Se acumular erros acima do permitido para o nível, o jogo termina.

## Extensibilidade

Esta versão é demonstrativa e modular. Novos casos podem ser adicionados ao arquivo `cases.json` seguindo o mesmo esquema de campos, e ajustes de dificuldade podem ser feitos em `config.json`. A lógica do jogo e a interface estão separadas, permitindo expansão futura (mais níveis, novos tipos de exame, gráficos avançados, integração de áudio, etc.) sem grande refatoração.

## Licença

Este projeto é fornecido como exemplo para fins educacionais e não possui licença para uso comercial. Imagens de ícones são carregadas via Font Awesome CDN sob seus próprios termos de uso.