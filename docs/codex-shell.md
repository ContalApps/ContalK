# ConTALK: estrutura do Codex + recursos do Discord

Objetivo definido pelo VG: o ConTALK deve ter o layout e a navegação do app Codex e, sobre essa base,
os recursos do Discord (servidores, canais, voz, tela) e desenvolvimento colaborativo com IA, GitHub,
editor e cursores ao vivo. Cada fase sai como release própria. Nada aparece como disponível antes de
existir de verdade: itens de fases futuras ficam desabilitados com "em breve".

Decisões do VG (27/10/2026): terminal e editor trabalham na pasta local de cada pessoa; GitHub por
token pessoal (guardado como as chaves de IA); o tema Vice City continua como opção.

## Fase 1: shell do Codex (0.1.26)

- Barra de título de 44px: voltar, avançar, barra lateral, menus Arquivo/Editar/Exibir
  (`TitleMenus.tsx`), busca central (Ctrl+K), sino, painel direito e avatar.
- Arquivo: Nova conversa, Abrir pasta, Sair da conta (só desconecta) e Encerrar (fecha o app e todos os
  processos: terminais, captura de áudio, atalho de voz e leitura). Nova janela, Nova conversa
  temporária e Novo projeto ficam "em breve".
- Editar: desfazer, refazer, recortar, copiar, colar, excluir e selecionar tudo (`webContents`) e
  Configurações. Exibir: barra lateral (Ctrl+B), terminal (Ctrl+J), painel direito (Ctrl+Alt+B), barra
  de servidores, mensagens fixadas, zoom e tela cheia (F11).
- Terminal integrado (`electron/terminal.ts` + `TerminalPanel.tsx`): `node-pty` 1.1 (N-API, binários
  prontos) e xterm.js; PowerShell ou pwsh na pasta aberta; várias abas; altura ajustável. Nada do
  terminal sai do computador.
- Layout: rail, sidebar (Canais e Chamadas recolhíveis, card da chamada com pessoas e tempo), centro com
  painel inferior e painel direito (`RightPanel.tsx`: chamada ativa com controles, miniaturas de
  compartilhamento de tela e participantes).

Nova janela exige reescrever o roteamento por janela de comunidade, IA, voz, captura e atalhos (hoje
presos a uma janela); fica para uma fase própria.

## Próximas fases

- Fase 2, Projetos: entidade nova no servidor (projeto agrupa canais e chamadas; Visão geral, Tarefas,
  Documentação, Roadmap), permissões, seção Projetos e "Novo projeto".
- Fase 3, código local + GitHub: árvore da pasta aberta, editor com abas, token GitHub, repositório e
  branch, PRs, issues e Actions; seção Repositórios e card GitHub no painel direito.
- Fase 4, colaboração ao vivo: atividade de quem está em qual arquivo ou branch, cursores com nome e cor,
  sessões de IA compartilhadas e agentes na pasta local com aprovação por ação; conversa temporária.
- Fase 5, design/Canva: depende do que a API do Canva permite; pesquisar antes de prometer.

## Nota técnica

O Chromium 130 do Electron descarta o restante de um bloco CSS aninhado quando encontra um
pseudo-elemento (`::placeholder`, `::-webkit-scrollbar-*`). Em `codex.css` essas regras ficam fora dos
blocos aninhados. O build de produção achata o aninhamento, mas o modo de desenvolvimento não.
