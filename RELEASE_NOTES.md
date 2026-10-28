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
