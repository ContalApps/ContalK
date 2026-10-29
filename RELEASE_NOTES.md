# ConTALK 0.1.35

Navegador Destacado com Cursores em Tempo Real e Barra de Colaboração Flutuante, Detecção Vocal Zero-Delay ("Falando agora"), Ícone de Microfone Bloqueado na Bandeja e Doca Unificada.

- **Cursores Colaborativos no Navegador Destacado:** Na janela externa nativa do Chromium, os movimentos de mouse e cliques de todos os participantes agora são renderizados em tempo real diretamente sobre a página web, com cores distintas, identificação por nome e animação de ondas (*ripple ping*). A camada visual é não-bloqueante (`pointer-events: none`), permitindo ao anfitrião navegar livremente.
- **Barra de Controle Flutuante na Janela Destacada:** Barra de controle *dark glass* integrada ao topo do navegador destacado com alternância rápida de permissão de interação (`👥 Colaboração Ativa` / `🔒 Pausada`), controle de áudio/mudo do navegador, menu de Automação com IA (resumo de página no chat, automação de ações e formulários, extração de texto estruturado), botão de recolher ao ConTALK e encerramento de compartilhamento.
- **Correção da Interação e Foco para Usuários Remotos:** O algoritmo de clique colaborativo agora identifica e aciona o elemento interativo pai (`closest('button, a, input, ...')`) caso o participante clique em elementos gráficos internos (`svg`, `span`). O canvas do palco agora captura foco imediato (`tabIndex={0}`), permitindo digitação direta de caracteres e atalhos de teclado (`Backspace`, `Enter`, `Tab`, setas) sem rolar a tela.
- **Proporção Perfeita 16:9 no Palco:** Enquadramento estrito em 16:9 HD (1280x720) com ajuste contido (`object-contain`), eliminando distorções de escala ou páginas esticadas.
- **Detecção Vocal Zero-Delay ("Falando agora"):** Implementação de detector VAD local imediato via Web Audio AnalyserNode (intervalo ultra-rápido de 30ms), ativando instantaneamente o indicador visual de fala sem depender de latência de rede ou confirmações do servidor.
- **Ícone de Microfone Bloqueado na Bandeja do Sistema:** Quando mutado ou ensurdecido (pelo app ou pelo menu da bandeja), o ícone próximo ao relógio exibe um símbolo nítido de microfone bloqueado 24x24 em pixel art. A animação de ondas sonoras só é ativada estritamente quando o usuário está falando no microfone.
- **Doca de Usuário e Chamada Unificada:** A barra de controles de áudio, microfone, câmera, tela e status do usuário foi consolidada em um único card fixo no rodapé esquerdo (`UserDock`), removendo cards de chamada duplicados no topo da lista de canais.

Validação: tipos verificados sem erros (`npm run typecheck`), 327 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.34

Restauração da Transmissão de Áudio Nativa WebRTC de Baixa Latência (Remoção do Gate de Software, Eliminação de Delays e Cortes de Voz).

- **Eliminação de Atraso e Delay no Áudio:** Remoção do portão de ruído artificial em JavaScript que manipulava `mediaStreamTrack.enabled`, eliminando a inflação e distorção do jitter buffer (NetEQ) no receptor e restabelecendo a latência ultra-baixa nativa do WebRTC.
- **Fim dos Cortes e Truncamentos de Voz:** O fluxo de áudio do microfone agora flui sem interrupções por software. O Opus DTX nativo (Discontinuous Transmission) e o cancelamento de eco acústico (AEC) gerenciam a detecção de silêncio diretamente no módulo de processamento de áudio em C++, sem engolir sílabas ou palavras iniciais e finais.
- **Áudio Cristalino e Estável:** Reativação dos filtros nativos de alta fidelidade do Chromium (filtro passa-alta para ruídos graves, supressão de ruído e cancelamento de digitação de teclado).
- **Latência Interativa no Web Audio:** Contexto de áudio configurado com `latencyHint: 'interactive'` para reprodução imediata do sinal recebido.

Validação: tipos verificados sem erros (`npm run typecheck`), 325 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.33

Correção Crítica de Transmissão de Áudio (Microfones e Voice Gate), Compartilhamento Global de Tela e Sincronização em Rede do Co-browsing.

- **Correção Crítica no Áudio de Chamadas (Noise Gate não Mudo):** O analisador de áudio Web Audio do Noise Gate agora utiliza um clone dedicado do MediaStreamTrack, garantindo que o sinal de decibéis nunca seja cortado para o detector de voz durante momentos de silêncio e eliminando o travamento do microfone em mudo contínuo.
- **Proteção e Preservação de Dispositivos de Áudio:** O encerramento do gate agora interrompe estritamente o track clone de análise, preservando permanentemente o track físico de captura do microfone.
- **Calibração de Fones e Headsets:** Ajuste cirúrgico no filtro de loopback para não rejeitar headsets e fones Bluetooth identificados como "Auriculares" ou "Headphones" pelo Windows em português.
- **Compartilhamento de Tela Global e Unificado:** Modal de transmissão de tela (`ScreenShareModal`) integrado na raiz do layout da aplicação, acessível de qualquer botão, palco ou visualização do app através do `useVoiceStore`.
- **Botão de Transmissão no Palco de Voz:** Adicionado controle direto de transmissão de tela no cabeçalho do palco de voz (`VoiceStage`), com alternância instantânea entre transmitir e parar.
- **Carregamento Instantâneo de Vídeo de Tela:** Adicionados gatilhos de reprodução `onCanPlay`, `onPlaying` e verificação de `readyState` no reprodutor de transmissões, eliminando bloqueios na mensagem de espera.
- **Compatibilidade com Monitores em Captura Nativa:** Fallback robusto para o monitor primário no módulo de áudio isolado e captura de tela quando IDs de display sofrem divergência de formato.
- **Resiliência na Rede do Navegador Compartilhado:** Registro dinâmico de remetentes no despachante de dados WebSocket/LiveKit e fallback automático para IDs contidos nas mensagens, garantindo sincronização e colaboração ininterruptas entre computadores diferentes.

Validação: tipos verificados sem erros (`npm run typecheck`), 325 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.32

Rede em Tempo Real para Navegador Compartilhado, Portão de Ruído Inteligente (Noise Gate) contra Vazamento de Som, Interação Colaborativa Completa e Automação Web por IA no Palco.

- **Sincronização em Tempo Real do Navegador Compartilhado:** Transmissão via canal de dados WebSocket/LiveKit para todos os computadores na sala com solicitação automática de sincronização (`REQUEST_SYNC`) ao entrar no canal. Otimização de quadros em JPEG (máx. 1280px, ~40-70 KB) para máxima fluidez sem saturação da rede.
- **Portão de Ruído Inteligente (Noise Gate / VAD) contra Vazamento de Áudio:** Filtro RMS contínuo no microfone que corta e silencia automaticamente áudio de fundo quando o usuário não está falando, impedindo vazamento de som de vídeos da web, músicas ou jogos para os outros integrantes da chamada. Suporte a sensibilidade automática inteligente e controle manual de limiar.
- **Interação Colaborativa Completa (Cliques, Foco e Digitação):** Disparo nativo de eventos Chromium (`sendInputEvent`) e desativação de background throttling, garantindo que os cliques de integrantes funcionem com foco real e navegação fluida em links e botões. Adicionada barra de digitação colaborativa (`sendType` e teclas) com proporção 1:1 exata sem desvios de tela.
- **Painel de Automação com IA Embutido no Palco:** Drawer de IA direto no navegador compartilhado com resumo instantâneo da página, extração de texto estruturado e links, campo de comando com prompt livre e registro de execuções.
- **Controles Unificados de Chamada (Design Codex):** Remoção de controles redundantes no rodapé e padronização do card superior do painel direito com controles dedicados de câmera, tela, navegador web, desconexão e atalhos rápidos de microfone e áudio.
- **Vínculo de Repositórios GitHub por Canal:** Aba de repositórios integrada às configurações de canais de texto e hub de projetos, conectando o contexto do repositório selecionado diretamente às automações e respostas da IA.

Validação: tipos verificados sem erros (`npm run typecheck`), 325 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.31

Navegador Web Compartilhado no Palco de Chamadas, Blindagem Zero-Leak Contra Vazamento de Senhas, Integrações com Google Workspace e Navegador Interno com Automação por IA.

- **Navegador Web Compartilhado (Co-browsing ao Vivo):** Permite aos participantes da chamada abrir e navegar em sites diretamente no palco de voz sem streaming pesado de tela. Suporte a modo colaborativo (multi-user interaction) onde todos podem navegar e clicar juntos, com cursores ao vivo, nomes de identificação e indicadores visuais de clique.
- **Blindagem Contra Vazamento de Senhas (Zero-Leak Privacy Shield):** Qualquer campo sensível (`input[type="password"]` e credenciais) é automaticamente mascarado com desfoque profundo (`blur(14px)`), fundo preto sólido e texto transparente antes da captura e transmissão. Garantia absoluta de privacidade onde nenhum caractere de senha é enviado aos espectadores ou acessível por terceiros.
- **Integração de Aplicativos e Google Workspace:** Hub 1-Clique em Configurações para vincular Gmail, YouTube, Google Agenda e Google Drive, permitindo solicitar resumos inteligentes, listas de e-mails, vídeos inscritos e compromissos diretamente no chat com IA.
- **Navegador Interno com Automação Web para IA:** Navegador web integrado com capacidades completas de automação: navegação, cliques inteligentes, preenchimento de campos, leitura estruturada de conteúdo e captura de tela acionáveis pelos agentes de IA.
- **Login Social e Vínculo de Contas:** Vínculo de contas do Google, LinkedIn e Instagram na tela de perfil com suporte a login federado direto.
- **Verificação Ativa de Modelos de IA:** Validação de modelos no Gemini e provedores de IA, filtrando modelos obsoletos ou inativos e eliminando conexões falso-positivas.
- **Prévias Ricas de Links e Imagens:** Pré-visualização OpenGraph para links compartilhados e miniaturas de imagens inline renderizadas em qualidade original sem necessidade de download prévio.

Validação: tipos verificados sem erros (`npm run typecheck`), 326 testes unitários e de integração aprovados (`npm test`), inspeção ao vivo com simulação de usuário real via CDP (100% de sucesso) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.30

Engenharia Reversa (REA) do OpenAI Codex Desktop, Colaboração com Cursores em Tempo Real e Design System Fiel.

- **Colaboração em Tempo Real com Cursores Reais:** Cursores dinâmicos de participantes reais com cores determinísticas por usuário (`useDevCollaborationStore`), sincronização instantânea de código (`BroadcastChannel` e WebSocket) e remoção de nomes estáticos sintéticos.
- **Menu de Comandos Universal (Command Palette - Ctrl+K):** Abertura modal rápida de comandos categorizados (Ações Rápidas, Canais, Desenvolvimento e IA, Ajuda), com navegação por setas e Enter.
- **Painel de Alterações e Diff Viewer (Review Panel - Ctrl+Alt+R):** Drawer lateral de controle de versão com resumo de arquivos alterados, estatísticas de adições/remoções e visualizador de diff linha a linha.
- **Floating Chat Composer (Design Codex):** Estilo flutuante com elevações extraídas do Codex (`--elevation-composer`, `--elevation-stroke`), chips de anexos e expressões no topo, botão circular de envio `↑` e suporte rápido ao comando `/image`.
- **Geração de Imagens por IA Integrada:** Suporte a DALL-E e Imagen diretamente no chat com pré-visualização inline, modal de zoom e download.
- **Central de Atalhos de Teclado e Ajuda (?):** Listagem exaustiva de todos os atalhos disponíveis no modal de ajuda do TitleBar.
- **Correção de Temas e Menus de Menção (@):** Dropdowns com `color-scheme: dark`, planos de fundo opacos e tipografia de alto contraste sem flashes brancos.

Validação: tipos verificados sem erros (`npm run typecheck`), 314 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.29

Harness de IA para Desenvolvimento e Protocolo MCP Integrados. O time de desenvolvimento não precisa mais abrir ferramentas externas ou CLI de IA (Claude Code, Codex CLI, ChatGPT web) — todo o fluxo de desenvolvimento interativo acontece nativamente dentro do ConTALK.

- **Chamada de Ferramentas e Agent Action Cards:** Agentes de IA nos canais e projetos podem propor ações executáveis (`run_command`, `write_file`, `edit_file`, `read_file`, `list_files`, `mcp_call`), renderizadas em cards visuais interativos no fluxo do chat.
- **Aprovação e Execução Segura:** Cards com botões de ação ("Aprovar e Executar", "No Terminal", "Aplicar Alteração", "Rejeitar"). Comandos de terminal podem ser enviados diretamente à sessão interativa do terminal inferior ou executados em segundo plano via `workspaceExecCommand` com captura de stdout, stderr e código de saída.
- **Sincronização com o DevCodeEditor:** Alterações e criações de arquivos aplicadas via cards de IA refletem imediatamente nas abas abertas do editor de código em tempo real.
- **Suporte ao Protocolo MCP (Model Context Protocol):** Gerenciador de servidores MCP via stdio (`electron/mcp.ts`), permitindo adicionar ferramentas externas (filesystem, GitHub, databases, etc.), listar ferramentas disponíveis (`tools/list`) e executá-las via JSON-RPC 2.0.
- **Modal de Gerenciamento MCP:** Acessível diretamente pelo menu "Exibir" -> "Servidores MCP (IA)..." e pelo atalho na seção de Repositórios da barra lateral.

Validação: tipos verificados sem erros (`npm run typecheck`), 310 testes unitários aprovados (`npm test`) e build de produção concluído com sucesso.

# ConTALK 0.1.28

Correção da 0.1.27.

- Transmissão de tela voltou a funcionar: a lista de telas e janelas aparece de novo e o áudio do aplicativo volta a ser capturado.
- Voltaram a funcionar também: criar servidor, os avisos de atividade, os controles de voz na bandeja e a busca e instalação de atualizações dentro do aplicativo.

Quem está na 0.1.27 precisa instalar esta versão uma vez manualmente, baixando o instalador abaixo, porque a atualização pelo próprio aplicativo não funcionava nela. Da 0.1.28 em diante, as atualizações voltam a chegar pelo aplicativo.

Causa: na 0.1.27, nove canais de comunicação entre a tela e o aplicativo foram renomeados de um lado só. Um teste novo agora confere que todo canal chamado tem quem responda.

Validação: tipos, testes e build; lista de telas, captura de áudio do aplicativo e estado de atualização testados no aplicativo desktop.
