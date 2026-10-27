# Retomada do ConTALK

## Após a 0.1.23: chamada Gemini pendente

O usuário atualizou para 0.1.23. Uma chamada no canal “Google IA” ficou em “A IA está respondendo…”; ao interrompê-la, outra mensagem mostrou “Pedido na fila…”. A revisão publicada não impõe tempo limite à contagem, ao resumo ou ao streaming do Gemini. A correção em `dev/caliari` limita cada etapa a três minutos, identifica qual etapa expirou e garante que uma chamada parada ou interrompida libere a próxima da fila. Testes de integração reproduzem uma contagem pendente e verificam falha, cancelamento e avanço da fila. Ainda falta confirmar uma chamada real e saber o resultado do teste do usuário com outro modelo Gemini. Não atribuir causa definitiva à API, à rede da VPS ou à chave sem essa evidência. A correção ainda não foi integrada nem publicada.

## Validação do Gemini e preparação da 0.1.23

Na versão 0.1.22, o usuário configurou o canal “Google IA” do servidor “ContalApps” com o modelo `gemini-3.8-flash`. Duas chamadas curtas terminaram como “A API de Gemini não concluiu o pedido.” O código da 0.1.22 agrupa códigos HTTP não previstos nessa mensagem; portanto, a causa exata ainda não foi confirmada. A revisão em `dev/caliari` adiciona duas tentativas com espera crescente para códigos transitórios e mostra o código HTTP em falhas persistentes, além de distinguir falta de créditos. Testes simulados, tipos e build passaram. Após PR, merge e publicação, confirme o deploy automático do serviço na VPS e peça ao usuário uma nova chamada no aplicativo; não afirme que a comunicação real foi corrigida sem esse teste. A chave pessoal permanece no armazenamento seguro do aplicativo e não deve ser pedida no chat.

O usuário confirmou que o serviço está na VPS. A documentação histórica abaixo sobre implantação pendente refere-se à entrega 0.1.20 e não descreve a situação atual. Versão pública mais recente antes desta preparação: 0.1.22.

## Trabalho na branch dev/vg: tudo no servidor, do zero

Decisão do VG (dono do projeto): ninguém configura endereço, chave, token ou Telegram, igual ao Discord. As contas existem só no servidor (accounts.mjs; o Electron só guarda sessão e cache de perfil); o "+" da lateral cria um servidor ou entra por convite (ServerDialog.tsx); os arquivos ficam no disco da VPS (local-files.mjs). A base começa do zero em `/app/data/contalk-v2`; contas e dados antigos não são migrados. Fase de testes com cerca de 4 pessoas numa VPS pequena. Veja [community-service.md](community-service.md).

Estado: versão 0.1.21, integrada à `main` por PR da `dev/vg`. O Coolify faz deploy automático da `main`, então o merge atualiza o servidor; a release do aplicativo sai pela tag `v0.1.21` (workflow release.yml). Confirme o deploy e a release no Coolify/GitHub antes de afirmar que estão no ar. Pendentes: recuperação/troca de senha, perfil (nome/foto) ainda local, testes de interface Electron (run-*-smoke) não executados por falta do runtime local, `scripts/community-setup.mjs` obsoleto.

## Trabalho atual: APIs de outras LLMs

Após a release pública [v0.1.19](https://github.com/ContalApps/ContalK/releases/tag/v0.1.19), o usuário pediu suporte a APIs além da OpenAI. A branch `dev/caliari` contém conectores nativos para Claude/Anthropic, Gemini/Google e Grok/xAI, perfis para endpoints compatíveis com OpenAI Responses e Chat Completions, seleção de provedor por canal/projeto e chaves pessoais separadas por provedor. Hosts personalizados precisam ser autorizados pelo administrador em `CONTALK_AI_ALLOWED_HOSTS`. Consulte [ai-projects.md](ai-projects.md) para os limites de protocolo, anexos e contagem. O usuário pediu PR, merge e release 0.1.20; confirme o resultado no GitHub antes de afirmar que foi publicado. **A VPS ainda não recebeu esta revisão.** Não substituir a release 0.1.19.

Tipos, 282 testes e build passaram localmente com provedores simulados. A implementação não recebeu chaves reais nem acesso à VPS. Os arquivos locais `native/audio-capture/main.cpp` e `Sistema de Cargos.docx` permanecem fora dos commits. A implantação e validação na VPS continuam adiadas a pedido do usuário.

## Histórico da primeira entrega de IA

## Trabalho posterior na branch dev/caliari

Após a publicação 0.1.18, a primeira entrega de IA compartilhada foi implementada e ajustada em `dev/caliari`. O pedido de PR, merge e publicação da 0.1.19 foi feito em 25/10/2026. Confira PR, main, tag e release antes de informar o estado da publicação. **A implantação na VPS foi adiada pelo usuário.** Mesmo com o cliente publicado, não atribuir essas funcionalidades ao servidor existente até implantar e validar a revisão do serviço da comunidade.

O serviço oferece modelo OpenAI por canal, projetos privados com leitores, colaboradores e delegados, listas de acesso sem bypass dos coproprietários do HQ, fila de pedidos, streaming SSE, cancelamento, retomada manual após falha e resumo de contexto. A chave pessoal é guardada com `safeStorage` no Electron e enviada por HTTPS apenas na execução iniciada pela pessoa. O serviço persiste mensagens, contexto e consumo no volume existente; não persiste chave nem bytes de anexos. PDF/imagens são enviados como entrada multimodal; texto, código e documentos modernos são convertidos em texto para contagem prévia. Consulte [ai-projects.md](ai-projects.md) para uso, formatos e implantação.

`npm run verify` passou com 278 testes; `npm run build` passou. Os testes exercitam a ponte Electron com o serviço local e um provedor OpenAI simulado. O ajuste posterior em `electron/preload.ts` encaminha os limites de tokens por solicitação e o ID da execução a retirar da fila; há um teste específico para esses argumentos. Não havia chave OpenAI pessoal nem Docker/Coolify acessível para validar uma chamada paga real ou criar a imagem de produção. **O usuário pediu explicitamente para anotar o acesso/validação Coolify e tratar disso depois.** Antes de ativar em produção, obter o endereço/projeto e método de acesso, preservar o volume e os segredos atuais, implantar a revisão do serviço e validar uma chamada real com uma chave configurada no aplicativo. A imagem Docker agora inclui `src/roles/ai.ts` e a dependência `fflate`.

Os arquivos locais `native/audio-capture/main.cpp` e `Sistema de Cargos.docx` continuam fora dos commits. A etapa posterior de agentes, MCP e alterações de arquivos/serviços externos permanece fora desta primeira entrega; cada ação de escrita futura exigirá aprovação explícita. Não ativar integrações de aplicativos nem monetização por inferência deste trabalho.

Leia AGENTS.md primeiro. Em 25/10/2026 o usuário decidiu encerrar a implementação após a validação atual do palco, fazer PR/merge/publicação e deixar os recursos restantes para outra LLM. Não continue automaticamente o escopo completo do documento de cargos como se esta entrega ainda estivesse aberta.

## Primeiro passo

Trabalhe na branch de quem pediu (`dev/vg` ou `dev/caliari`, veja AGENTS.md), sem criar branches. Leia git status e preserve arquivos modificados/novos antes de fetch ou sincronização. Não use reset --hard, git clean nem sobrescreva arquivos locais. Confira main/dev remotas, PRs e release atual. A confirmação final desta publicação, com URLs e commit integrado, será registrada localmente em release/HANDOFF_FINAL.md após verificar os arquivos publicados; essa pasta é ignorada pelo Git.

A versão preparada nesta etapa é 0.1.20; a entrega anterior foi 0.1.19. A fonte de verdade da publicação é a release GitHub, não o merge: confirme tag, isDraft=false, latest e instalador Windows, blockmap e latest.yml. O AGENTS.md exige publicação estável quando o usuário pede PR e merge, exceto exclusão explícita. Não substitua instaladores de versões existentes.

## Arquitetura preservada

- Electron/React/TypeScript; contas, senhas e perfis locais. Não presumir identidade ou imagens de perfil centrais.
- VPS/Coolify com mediasoup, coturn e tickets temporários de mídia. LiveKit foi removido; não reintroduzir SDK, transporte antigo ou segredos no aplicativo.
- Mensagens, cargos e novos metadados persistem no volume existente da comunidade. Não recriar esse volume na implantação.
- Arquivos e imagens usam um serviço separado de arquivos/Telegram, somente quando configurado. Atualizar o app não configura Telegram nem armazenamento automaticamente. Não substituir por conteúdo em texto base64 nas mensagens centrais.
- Interface leve; controles de voz no card inferior esquerdo. Configuração de canal por engrenagem; exclusão com confirmação. HQ: todos os membros conhecidos continuam coproprietários.

O backend da VPS precisa acompanhar o código 0.1.18 para oferecer as novas ações. Merge e release não provam redeploy no Coolify. Verifique a implantação antes de afirmar que as funcionalidades estão ativas em produção. Não faça testes destrutivos com membros reais.

## O que foi concluído

A base 0.1.17 foi incorporada por fast-forward, sem conflitos ou perda de commits. Foram preservados os ajustes de densidade, atualização automática, notificações, barra de título, laterais compactas e bandeja.

As funcionalidades adicionais têm operação no serviço, interface e testes:

| Área | Referência principal |
|---|---|
| Expulsão, banimento e voz moderada | member-moderation.md; voice-moderation.md |
| Convites, readmissão, apelidos e servidor | community-invites.md; community-settings.md |
| Reações, pins, modo lento e enquetes | community-chat.md; community-polls.md |
| Tópicos públicos/privados e eventos | community-threads.md; community-events.md |
| Status de canal e estatísticas autorizadas | voice-channel-status.md; community-insights.md |
| Atividade de voz, tecla global e prioridade | voice-input-modes.md; priority-speaker.md |
| TTS local e mensagens gravadas | community-speech.md; voice-messages.md |
| Emojis, figurinhas e sons personalizados | community-expressions.md; community-soundboard.md |
| Webhooks de texto autorizados | community-webhooks.md |
| Palco, plateia e pedido de fala | community-stages.md |

O catálogo está em 48 de 52 permissões com operação disponível. Os números antigos em roles-study.md e local-recovery-2026-10-25.md são registros históricos da evolução. Não os use como contagem atual.

## Pendências para a próxima implementação

1. USE_APPLICATION_COMMANDS, USE_EXTERNAL_APPS e USE_EMBEDDED_ACTIVITIES: ainda sem execução, instalação ou atividade funcional. Permanecem desabilitados no catálogo. Definir protocolo, confiança, autorização, isolamento e instalação com o usuário antes de aceitar código ou serviços externos.
2. Cargos de bots/integrações e cargos vinculados: o modelo já distingue origens gerenciadas e bloqueia manipulação manual indevida, mas faltam provedores confiáveis, verificação de conexões/requisitos e atribuição/remoção automática reais. Webhooks de entrada não simulam bots nem atribuem cargos. Não habilitar por dados declarados pelo cliente.
3. Assinaturas, impulsionamentos e análises de monetização foram explicitamente excluídos até existir cobrança. Não são um bloqueio desta entrega.
4. Confirmar o redeploy do backend na VPS preservando volume e segredos. Não confundir validação local sintética com implantação ou testes físicos em produção.

Não há código começado para as três capacidades de aplicativos nesta entrega. O palco foi o último recurso implementado por determinação do usuário.

## Arquivos para orientar a próxima LLM

- scripts/community/service.mjs: autorização HTTP, transações, SSE e persistência; realtime.mjs: tickets, sessões, mídias e moderação; webhooks.mjs: credenciais e publicação externa.
- src/roles: cálculo de permissões, comandos e regras de cada recurso. stages.ts vincula convite/fala a uma sessão real; essas chaves internas não aparecem em snapshots públicos.
- src/media/realtime.ts e src/store/useVoiceStore.ts: transporte e intenção local de áudio. Aceitar palco, remover mute do servidor ou recuperar permissão não deve abrir microfone automaticamente.
- src/store/useRoleStore.ts e src/roles/runtime.ts: aplicação de snapshots, histórico e proteção dos caches locais ao trocar conta/permissão.
- electron/community.ts e storage.ts: IPC confiável, configuração criptografada por conta e autorização de arquivos. Nunca expor chaves ou URLs assinadas ao renderer sem necessidade.
- electron/push-to-talk.ts, speech.ts e native/voice-input/Program.cs: atalho global e síntese Windows em memória, sem log de digitação ou serviço externo de TTS. Compilar com npm run build:voice-input.
- .github/workflows/verify.yml e release.yml; scripts/publish-electron.mjs: validação e publicação Windows. O script recusa versão já publicada.

## Validação e limitações

Tipos e 262 testes passaram localmente sem falhas/casos ignorados; build frontend/main/preload aprovado. Os testes Electron exercitam ponte real, HTTP/SSE, WebSockets, worker mediasoup, mídia sintética, captura encerrada, dispositivos/volumes, controles, cache e revogação. Veja os relatórios de cada módulo e os resultados locais em release/*/result.json. Os testes de interface de palco, sons, expressões e webhooks têm 17, 19, 14 e 14 verificações, respectivamente.

Comandos de retomada: npm run build:voice-input; npm run verify; npm run build. Para testes Electron neste computador, definir ELECTRON_PATH para release/electron-runtime/electron.exe. Os testes run-*-smoke.mjs são separados de npm test e usam dados sintéticos. O teste de atualização instala duas versões de um aplicativo isolado; não altera a instalação pessoal.

Neste computador não há Visual Studio Build Tools para recompilar o C++ de captura. Os executáveis anteriores de áudio/atualização foram preservados; o novo componente C# compila localmente. O workflow Windows compila os auxiliares antes de gerar o instalador. Não apresentar uma execução parcial de build:electron como sucesso. Testes físicos de microfone, WASAPI e redes independentes não foram repetidos.

## Preservação local

Os bundles e cópias ficam em release/local-preservation-20261025-045350 e release/local-preservation-continuation-*. O primeiro files.json registra SHA-256 das referências originais. Sistema de Cargos.docx permanece não rastreado; API Google Stich + MCP.txt e Google_Sans.zip são privados/ignorados. Não anexar esses arquivos a commits, PRs ou releases.

O commit 8f7e414 preserva o conjunto até expressões; 7141ba1 registra o painel de sons. A integração final e a versão são commits posteriores desta mesma branch. Arquivos index.lock antigos, vazios e sem processo Git ativo foram preservados como index.lock.stale-* dentro de .git para liberar operações; não remover locks ativos.

O arquivo native/audio-capture/main.cpp pode aparecer modificado por final de linha, sem diff de conteúdo; esse estado local foi preservado e não incluído nos commits. Não sobrescrever o arquivo para limpar o status. A main local pode continuar antiga; dev/caliari deve ser sincronizada com origin/main após o merge, sem edição direta da main.
