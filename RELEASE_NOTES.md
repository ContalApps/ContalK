# ConTALK 0.1.45

- **Modo Teatro 100% Full-Bleed sem Bordas**: As transmissões de tela agora ocupam toda a área dedicada sem barras pretas nem bordas (em widescreen e vídeos verticais), ocultando o cabeçalho estático e aproveitando de ponta a ponta quando as barras laterais estão recolhidas.
- **Controle Flexível Preencher / Ajustar**: Botão dinâmico no overlay de ferramentas para alternar entre preenchimento total e proporção original, com preferência salva localmente.
- **Sair e Assistir Transmissão**: Controles dedicados para sair de uma transmissão assistida e retornar à grade dos participantes a qualquer momento, ou voltar a assistir pelo palco ou avatar.
- **Otimização de Performance e Redução de Tamanho (/ponytail)**: Redução de ~70% no bundle principal (de 1,34 MB para 401 kB) através de code-splitting modular, carregamento sob demanda do terminal (@xterm) e modais, e memoização de listas de mensagens e membros.
- **Arrastar e Soltar Arquivos (Drag & Drop)**: Compartilhamento rápido soltando arquivos externos no chat aberto ou selecionando o canal de destino por modal interativo.
- **Foto de Perfil / Ícone do Servidor**: Suporte completo a upload, remoção e exibição do ícone da comunidade nos trilhos, banners e cartões.
- **Notificações do Sistema e Blindagem de Mensagens Privadas**: Notificações no sistema operacional para mensagens de texto, transmissões e DMs, com privacidade reforçada que oculta o conteúdo confidencial de mensagens privadas.

# ConTALK 0.1.44

- No **Modo Grade**, as transmissões começam fechadas e sem som. Use **Assistir** para abrir a imagem e o áudio de um card e **Fechar** para parar de assistir àquela transmissão.
- Transmissões que começam depois também entram fechadas na grade. O controle é individual para cada espectador.

# ConTALK 0.1.43

- O compartilhamento de tela no Windows ganhou o modo **Todos os aplicativos**. Ele transmite o som de vários aplicativos ao mesmo tempo, mesmo quando a imagem vem de uma única janela.
- O modo exclui o áudio do ConTALK e pode incluir notificações e som de outros monitores. A captura por aplicativo ou tela continua sendo a opção padrão.

# ConTALK 0.1.42

- Administradores podem definir de 1 a 16 vagas por canal de voz na aba **Visão geral** das configurações do canal. O padrão é 8.
- O limite vale para entradas e movimentações entre canais. Reduzir a capacidade mantém quem já está na chamada. Quando acabam as vagas, o aplicativo informa que o canal está cheio.
- A presença online da comunidade deixou de usar o limite de quatro participantes dos canais de voz.

# ConTALK 0.1.41

Modo Teatro Padrão na Transmissão de Tela (100% da Área Dedicada sem Bordas) e Controle Flexível de Proporção.

- **Modo Teatro Padrão em Transmissões de Tela:**
  - O Modo Teatro agora é o comportamento padrão ao visualizar compartilhamentos de tela no ConTALK.
  - Eliminação de restrições de largura fixa (`max-w-6xl` de 1152px) e margens centralizadas que causavam faixas vazias ao redor da transmissão.
  - O palco de transmissão (`ct-theater-stage` / `ct-theater-view`) ocupa 100% da largura e altura dedicadas da janela (do cabeçalho do canal até a base da interface).
  - Preenchimento externo (`padding`) e espaçamentos removidos em transmissões ativas, eliminando bordas em qualquer resolução ou estado das barras laterais.
  - Fundo em preto absoluto (`#000000`) para integração visual contínua sem cartões ou molduras cinzas.
- **Adaptação Total a Formatos Horizontais e Verticais:**
  - Transmissões de desktop/widescreen (16:9) expandem-se por toda a extensão horizontal do palco sem compressão em caixas menores.
  - Transmissões verticais (smartphones / vídeos 9:16) aproveitam 100% da altura vertical da área de trabalho, encostando exatamente abaixo do cabeçalho do canal e no rodapé da janela.
- **Novo Controle de Visualização "Ajustar / Preencher":**
  - Botão interativo no overlay de ferramentas da transmissão permitindo alternar dinamicamente entre:
    - *Ajustar (`contain`):* Exibe a transmissão na sua proporção nativa sem nenhum corte.
    - *Preencher (`cover`):* Preenche toda a área útil sem barras pretas.
- **Barra Flutuante de Múltiplas Transmissões e Interface Limpa:**
  - Controles e cabeçalhos flutuantes com esmaecimento automático suave no hover para visualização limpa e desobstruída.
  - Quando há mais de uma pessoa transmitindo na sala, miniaturas flutuantes na base do palco permitem trocar o foco imediatamente ou alternar para o Modo Grade.

Validação: tipos verificados sem erros (`npm run typecheck`), 284 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.40

Conexão WebRTC LAN Robusta (STUN Nativo), Busca Remota e Direta de Amigos na Comunidade e Login Social Oficial (Google, Instagram e LinkedIn).

- **Conexão WebRTC na Mesma Rede Local (LAN / Wi-Fi):**
  - Injeção de servidores STUN padrão de alta disponibilidade (`stun.l.google.com:19302`, `stun1.l.google.com:19302`, `stun.cloudflare.com:3478`) no backend Mediasoup (`scripts/community/realtime.mjs`) e como fallback automático no cliente (`src/media/realtime.ts`).
  - Dispositivos na mesma rede residencial ou comercial (notebook e PC atrás do mesmo roteador NAT/CGNAT) agora geram candidatos `srflx` e fecham canais ICE com a SFU sem bloqueios.
  - Alertas claros em português ao usuário quando a mesma conta tentar entrar na mesma sala em dois computadores simultaneamente (*session replaced*), orientando cada amigo a utilizar sua própria conta.
- **Busca e Adição de Amigos na Comunidade:**
  - Novo mecanismo de busca de contas no servidor (`accounts.search`) e rotas `GET /users/search?q=...` e `GET /users/:username` no serviço da comunidade.
  - Bridge segura IPC no Electron (`communitySearchUsers`) conectando a busca da comunidade diretamente ao aplicativo.
  - Nova aba "Adicionar amigo" reformulada em `src/components/HomeView.tsx` com formulário para envio de pedido por `@username` exato e pesquisa em tempo real de qualquer usuário registrado no ConTALK.
  - Feedback visual imediato com alertas estilizados para confirmação de envio, avisos de amizade existente e prevenção de auto-adicionar.
- **Login e Criação Oficial com Redes Sociais:**
  - Janela nativa modal de autenticação oficial (`auth-social-popup`) no Electron com User-Agent Chrome autêntico para Google, Instagram e LinkedIn.
  - Sincronização automática com a comunidade (`syncSocialCommunityAccount`), gerando credenciais seguras e sessão oficial criptografada (`community-<hash>.enc`).
  - Eliminação de qualquer mock ou conta local fictícia; as contas sociais agora possuem acesso integral e imediato a voz, canais e servidores.

Validação: tipos verificados sem erros (`npm run typecheck`), 284 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.39

Acessibilidade de Configurações da Comunidade, Silêncio Absoluto em Canais de Voz (Zero Chiado) e Refinamento Visual com a Skill Unslop.

- **Correção da Acessibilidade das Configurações da Comunidade:**
  - Reestruturação do banner do servidor com layout flexbox (`.ct-server-banner-header`), eliminando a sobreposição de camadas em que o título bloqueava cliques na engrenagem.
  - O botão de engrenagem (`.ct-server-role-settings`) agora conta com área confortável de toque de 28x28px, `z-index: 10`, cursor de ponteiro explícito e feedback visual sutil de hover.
  - Adicionado suporte a atalho direto: clique com o botão direito do mouse em qualquer área do banner da comunidade abre instantaneamente o painel de configurações gerais.
- **Eliminação do Chiado Contínuo em Silêncio nos Canais de Voz:**
  - Remoção do compressor dinâmico de saída Web Audio (`DynamicsCompressorNode`), que gerava ganho automático de até +18 dB sobre o ruído de fundo da sala em momentos de silêncio.
  - O ConTALK restaura a fidelidade 1:1 transparente do WebRTC Opus com cancelamento de eco e supressão acústica nativas sem inflar o chão de ruído.
  - Isolamento do elemento auxiliar de áudio (*sink*) em container exclusivo (`#contalk-audio-sinks`) com volume zero e mudo travado, impedindo interferências e desmutamentos paralelos.
  - Fechamento imediato do canal da placa de som (`ctx.close()`) após os avisos sonoros de entrada tocarem, liberando os canais WASAPI e restabelecendo silêncio absoluto.
- **Skill Unslop e Refinamento Visual:**
  - Integração da skill `unslop` para identificação de vícios visuais de IA e consolidação da identidade estética do ConTALK (técnica, ágil, escura e focada em comunicação).
  - Remoção de emojis residuais em metadados de cartões e substituição por ícones vetoriais padronizados da família Lucide.

Validação: tipos verificados sem erros (`npm run typecheck`), 284 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.38

Estabilidade e Inteligência de Áudio Vocal (Correção de Atenuação Indevida e Nivelamento Dinâmico) e Avisos Sonoros Nativos de Entrada em Canal.

- **Correção da Queda Involuntária de Volume na Comunicação:**
  - Correção na lógica de *Priority Ducking*: a atenuação de 75% não é mais aplicada permanentemente pela simples presença de um orador prioritário na sala. O ducking agora é dinâmico e ativado exclusivamente enquanto o orador prioritário estiver falando com voz ativa (`activeSpeakers`), restaurando 100% do volume imediatamente quando ele pausa.
  - Eliminação do congelamento de decodificação no Chromium: o elemento auxiliar de decodificação de áudio WebRTC (*sink*) agora permanece montado no DOM oculto (`#contalk-audio-tracks`), evitando que o coletor de lixo ou a economia de bateria do Chromium suspenda ou degrade a taxa de reprodução de voz durante a chamada.
  - Processamento Dinâmico de Fala com Web Audio (`DynamicsCompressorNode`): adição de compressor de voz transparente nas faixas remotas de áudio para elevar falas sussurradas ou microfones baixos sem distorção em picos sonoros.
- **Avisos Sonoros Nativos ao Entrar em Canais de Voz:**
  - Sintetizador harmônico puro construído na Web Audio API (`src/media/sounds.ts`), com latência zero e sem dependências de arquivos de áudio externos.
  - Chime harmônico de entrada (`playChannelJoinSound`): emitido com suavidade sempre que um novo membro entra no canal de voz ativo.
  - Confirmação harmônica de conexão (`playSelfJoinSound`): tom sutil emitido quando o usuário se conecta com sucesso a um canal de voz.
  - Respeito integral ao modo ensurdecido (*deafened*) e ao dispositivo de saída de áudio selecionado.

Validação: tipos verificados sem erros (`npm run typecheck`), 284 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.37

Interface Minimalista Instantânea (Zero Delay), Bloco de Notas Integrado a Canais e DMs, Menções Automáticas com @, Prévias Nativas Universais e Confirmação de Exclusão.

- **Interface Minimalista e Limpa:**
  - Remoção de avatares duplicados da barra de título e da rail lateral esquerda, além da remoção do botão 'Canais e conversas' e do ícone de calendário próximo ao status de membros.
  - Remoção dos menus suspensos 'Arquivo', 'Editar', 'Exibir' e 'Ajuda' da barra de título, unificando as ações e atalhos na Command Palette universal (`Ctrl+K`).
  - Remoção do fundo acinzentado e contornos de card do canal de voz conectado na barra lateral, proporcionando uma aparência limpa, integrada e contígua.
- **Bloco de Notas Colaborativo Direcionável:**
  - Novo modal interativo ao salvar notas colaborativas (`SaveNoteModal`), permitindo escolher dinamicamente em qual canal de texto salvar e/ou enviar diretamente como mensagem privada (DM) para amigos selecionados.
- **Menções Rápidas sem Botões:**
  - Menu suspenso de menções que surge automaticamente ao digitar `@` no campo de texto com navegação por teclado e inserção instantânea, dispensando cliques adicionais.
- **Visualização Única Integrada:**
  - Substituição da caixa de seleção por um botão compacto com o ícone `1` em círculo embutido ao lado do botão de envio no compositor.
- **Tópicos como Configuração Interna do Canal:**
  - Aba nativa 'Tópicos' integrada ao painel de configurações internas de canais de texto (`ChannelSettings`), permitindo criar, renomear, arquivar e excluir tópicos de forma centralizada.
- **Pop-ups de Confirmação Segura:**
  - Pop-up modal com alerta e foco inicial no botão 'Cancelar' para confirmação explícita ao excluir mensagens.
  - Pop-up modal independente para confirmação segura ao excluir canais e tópicos.
- **Prévias Automáticas Padrão para Todos os Links e Arquivos:**
  - Ativação permanente e sem exceções de prévias automáticas: imagens em alta definição, reprodutores nativos de vídeo e áudio, visualizador de snippets de texto/código, PDFs, documentos e pacotes compactados.
- **Latência Zero e Fim dos Delays:**
  - Eliminação de todos os atrasos de transição e animações CSS de entrada (`codex.css`), proporcionando resposta instantânea em todos os botões, menus e abas.
  - Remoção do debounce de 400ms no controle de escala e densidade da interface.
  - Áudio e captura de microfone configurados com restrição nativa `latency: 0` e `latencyHint: 0` no Web Audio.
- **Auditoria e Limpeza Ponytail Ultra:**
  - Remoção de arquivos legados (`ActiveCallCard.tsx`, `ParticipantVolumePopup.tsx`, `TitleMenus.tsx`) e de mais de 1.100 linhas de CSS morto, reduzindo o tamanho final do bundle de distribuição.

Validação: tipos verificados sem erros (`npm run typecheck`), 281 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

# ConTALK 0.1.36

Retorno à Engenharia Reversa Perfeita do Discord (Foco em Comunicação e Transmissão de Tela), Bloco de Notas Colaborativo em Tempo Real e Otimização Ponytail Ultra.

- **Foco Absoluto em Comunicação e Transmissão:** O ConTALK retorna à sua essência original de alto desempenho, priorizando chamadas de voz e vídeo WebRTC de latência ultra-baixa e compartilhamento nítido de tela.
- **Remoção de Complexidades e IA Interna:** Remoção total de modelos generativos, configurações de API/tokens, canais de IA e cartões de prompt/automação, restabelecendo leveza, velocidade imediata e estabilidade.
- **Remoção do Navegador Compartilhado:** Eliminação do navegador compartilhado interno e janelas externas de navegação acopladas.
- **Remoção de Integrações Externas:** Remoção de conectores externos (GitHub, Jira, Confluence). As ferramentas nativas de produtividade da equipe (Kanban, Tarefas, Documentação e Roadmap) foram integralmente preservadas e limpas de dependências de terceiros.
- **Bloco de Notas Colaborativo:** O antigo editor de código foi transformado em um Bloco de Notas Colaborativo moderno com suporte a múltiplas abas, edição simultânea em tempo real, cursores coloridos dos participantes, identificação de presença e contador dinâmico de palavras/caracteres.
- **Auditoria Ponytail Ultra:** Eliminação de dependências não utilizadas em runtime (`clsx`, `tailwind-merge`, `sql.js`), remoção de mais de 25 arquivos e testes obsoletos e redução do tempo de compilação.

Validação: tipos verificados sem erros (`npm run typecheck`), 281 testes unitários e de integração aprovados (`npm test`) e build de produção Vite e Electron concluídos com sucesso.

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
