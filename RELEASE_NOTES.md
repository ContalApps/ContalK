# ConTALK 0.1.27

Central de desenvolvimento colaborativa inspirada no Codex com integração completa ao Discord.

- **DevCodeEditor Interativo:** Editor de código multi-abas com botão para criação de novos arquivos (`+`), suporte à tecla `Tab` para indentação (2 espaços), atalho `Ctrl+S` / `Cmd+S` para salvamento no disco via IPC, indicador de arquivo não salvo (`•`) e status "Salvo ✓".
- **Presença em Tempo Real:** Cursores remotos colaborativos com tags coloridas (*Mariana*, *Rafael*, *Lucas*) e numeração de linhas sincronizada com rolagem e destaque da linha ativa.
- **Sistema de Arquivos Real do Workspace:** Leitura e gravação direta de arquivos no computador através de IPC seguro no Electron (`workspaceListFiles`, `workspaceReadFile`, `workspaceWriteFile`).
- **Navegação de Projetos e Repositórios:** Árvore de arquivos locais sob demanda no item "Código" da barra lateral, e modais interativos para Pull Requests, Issues, Actions, Wiki, Visão Geral, Tarefas e Roadmap.
- **Terminal com Abas de Categoria:** Sessões PTY reais no Windows conectadas via `node-pty` + `xterm.js`, com categorias interativas: Terminal, Problemas (0 erros e avisos), Saída (logs de build e workspace) e Console de depuração.
- **Painel Direito e GitHub:** Card do repositório `ContalApps/ContalK` com branch ativa (`dev/caliari`), hash e mensagem do commit mais recente, acompanhado das chamadas de voz ativas e miniaturas com badge `LIVE`.
- **Inteligência Artificial:** Criação de canais com opção de IA e seleção dinâmica de modelos no compositor de mensagens, com blocos de código formatados e botão de cópia.

Validação: tipos (`tsc --noEmit && tsc -p tsconfig.electron.json`), 306 testes automatizados aprovados e build de produção do Vite e Electron gerado com sucesso.
