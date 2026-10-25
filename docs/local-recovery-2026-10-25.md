# Retomada local — 25/10/2026

## Preservação e comparação

O `AGENTS.md` foi lido antes da sincronização. A branch local era `dev/caliari`, no commit `b821d906d34a1e53136805fbf9236b709c43a257` (0.1.15). Não havia alterações em arquivos rastreados, alterações no índice ou commits exclusivos em relação à `main` remota. O único arquivo novo não ignorado era `Sistema de Cargos.docx`, referência já utilizada no estudo de cargos, mantida sem versionar.

Antes do fetch, todos os refs Git foram preservados em um bundle completo, verificado pelo Git, em `release/local-preservation-20261025-045350`. A referência DOCX e os dois arquivos locais de referência ignorados foram copiados e conferidos por SHA-256. O diretório também conserva o estado anterior, as exclusões locais e os patches do índice e da árvore de trabalho, ambos vazios. O backup é local, ignorado pelo Git, e não deve ser publicado: inclui o histórico e referências privadas.

Após `git fetch origin --prune`, a `main` remota estava 16 commits à frente, em `cbba6ed`, tag `v0.1.17`; `origin/dev/caliari` apontava para o mesmo commit. A sincronização foi realizada por `git merge --ff-only --no-overwrite-ignore origin/main`. Não houve conflitos, rebase, descarte, limpeza, substituição dos arquivos não versionados nem criação de branch. A branch `main` local não foi editada.

## Funcionalidades já integradas

| Trabalho anterior | Estado na base sincronizada |
| --- | --- |
| Google Sans, nome ConTALK, grade de transmissões e seleção em tela cheia | Integrados no histórico anterior, preservados na migração |
| Barra de título, escala numérica, colunas recolhíveis e interface compacta | Integrados até 0.1.15; teste de interface passou após sincronizar |
| Configurações e volumes pelo perfil, controles compactos de voz | Preservados e cobertos pelos testes de interface e controles |
| Sino, avisos do sistema, contadores de mensagens e bandeja | Integrados até 0.1.15; testes de notificação e bandeja passaram |
| Correção do encerramento durante atualização e instância única | Integradas anteriormente; testes correspondentes passaram |
| Editor, aparência, hierarquia, atribuições, menções, categorias, regras e auditoria de cargos | Integrados; editor validado com dois clientes e serviço de teste |
| Preparação do serviço de comunidade e persistência | Integrada; mensagens e cargos continuam no volume existente da VPS |
| Comunicação | Atualizada em 0.1.16/0.1.17 para WebSocket, tickets temporários, mediasoup e coturn, com implantação pelo Coolify |

Não existia uma implementação local parcial para reaplicar por cima da migração. Esta retomada corrigiu o diagnóstico nativo para aceitar `ELECTRON_PATH`, como os outros testes Electron, e atualizou os textos que ainda descreviam a implantação da VPS como pendente. Não alterou o protocolo, as credenciais, o volume de produção ou a arquitetura de contas e imagens.

## Validação desta retomada

- Dependências locais sincronizadas com o lockfile, sem alteração de `package-lock.json`; worker mediasoup oficial instalado para a versão fixada no projeto.
- `npm run verify`: tipos e 114 testes aprovados, nenhum ignorado neste ambiente.
- `npm run build`: frontend, processo principal e preload aprovados, com o aviso existente de tamanho de chunk.
- `node tests/run-community-voice-smoke.mjs`, com Electron 33.2.0 local: quatro clientes isolados, mídia sintética e worker mediasoup real. Áudio, câmera, tela com áudio, RTP recebido, mute, reconexão e revogação de Falar/Conectar aprovados. A recusa de ticket no caso de revogação é esperada.
- `node tests/run-roles-ui-smoke.mjs`: configuração, editor, atribuições, regras, categorias, histórico, conflitos de edição e privacidade do cache aprovados.
- `node tests/run-ui-smoke.mjs`: interface, escala, transmissão em grade, tela cheia, volumes, notificações e navegação aprovados.
- `node scripts/verify-community-vps.mjs`: HTTPS e `/health` públicos aprovados. As sondagens autenticadas não foram executadas nesta retomada por ausência de chave individual no ambiente; nenhum segredo foi solicitado nem incorporado ao aplicativo.

Os testes locais de mídia usam contas e dados sintéticos, sem tocar na comunidade de produção. Os resultados e as capturas ficam em `release`, ignorados pelo Git. A validação externa de TURN realizada na implantação está registrada separadamente no [relatório da comunicação](communication-validation.md); não foi repetida nesta retomada.

## Pendências reais

- Não havia funcionalidade local inacabada para recuperar. As permissões de operações ainda inexistentes no catálogo de cargos continuam desabilitadas: expulsão/banimento, moderação de voz de terceiros, convites, tópicos, eventos e integrações, entre outras. A migração não implementa essas operações por si só.
- Contas e perfis permanecem locais. Armazenamento central de imagens não foi criado; anexos dependem do serviço separado de arquivos e sua configuração.
- Permanecem os testes humanos de microfone/câmera físicos, captura WASAPI e participantes em redes distintas, além do limite de redes que bloqueiam a porta TURN atual, conforme o relatório de implantação.
- Não foi criada nova release nem modificado qualquer instalador publicado. A base é 0.1.17; uma integração futura das correções desta retomada deve respeitar o fluxo de PR, checks e nova versão do `AGENTS.md`.

## Continuação local após a retomada

O quadro e os números anteriores registram o estado encontrado na retomada. Depois da sincronização foram implementados e validados localmente: [expulsão, banimento e revogação](member-moderation.md), [convites e readmissão](community-invites.md) e [moderação de voz](voice-moderation.md). Os arquivos novos e as alterações continuam na árvore de trabalho de `dev/caliari`; nenhuma nova versão foi publicada ou implantada por essa continuação. As operações restantes do catálogo continuam desabilitadas até terem implementação real.

### Validação da continuação

- Tipos e 142 testes aprovados, sem falhas ou testes ignorados (`release/local-recovery-verify.log`).
- Build do frontend, main e preload aprovado (`release/local-recovery-build.log`); permanece o aviso conhecido de tamanho de chunk.
- Testes Electron de interface geral, editor de cargos, moderação e convites aprovados.
- Quatro clientes com worker mediasoup real aprovados, incluindo RTP de áudio interrompido por deafen, vídeo preservado, retomada sem abrir microfone e troca de sala por ticket temporário.
- SHA-256 dos três arquivos locais de referência continua igual ao backup anterior ao fetch. Nenhum commit local foi descartado; o HEAD permanece na base integrada `cbba6ed`, com as implementações novas ainda sem commit.

O catálogo completo do documento de cargos continua em andamento: operações ainda inexistentes, como tópicos, eventos, bots e integrações, permanecem indisponíveis. A continuação requer futura integração/publicação e implantação coordenada do serviço para chegar aos usuários; não houve modificação da versão 0.1.17 publicada.

### Apelidos e configurações gerais

Também foram implementados localmente [apelidos e configurações do servidor](community-settings.md). As permissões Alterar próprio apelido, Gerenciar apelidos e Gerenciar servidor agora controlam operações reais, com persistência, auditoria e sincronização. Apelidos aparecem em canais/voz; conta, perfil global, amizades, nomes nas mensagens diretas e identidade de mídia permanecem separados. Configurações gerais permitem alterar nome e descrição. A copropriedade do HQ continua intacta.

A validação desta continuação aprovou tipos, 149 testes e build (`release/continuation-verify.log` e `release/continuation-build.log`). As regressões de interface geral, editor de cargos, convites, moderação e mídia com quatro clientes passaram. O teste de moderação cobre formulário de apelido, atalho/foco, nome nas mensagens diretas, perfil global fora do servidor, configuração geral na aplicação e conflitos de edição. Não houve commit, PR, publicação ou alteração da VPS. Os recursos restantes do catálogo continuam pendentes.

### Reações, fixações e modo lento

A continuação local adicionou [reações, fixações e modo lento](community-chat.md), com controles compactos, autorização, persistência e sincronização. Há também confirmação para apagar mensagens alheias e remover reações em lote. O histórico paginado preserva os metadados e o SSE deixou de expor alterações antigas a quem não tem Ler histórico. A espera de envio usa o relógio do serviço, conserva o rascunho e continua sendo aplicada após excluir a última mensagem ou reiniciar.

Tipos, 159 testes e build aprovados (`release/chat-features-verify.log` e `release/chat-features-build.log`). Os testes Electron cobrem a ponte real, mensagens fixadas antigas, concessão/revogação, confirmações, espera e relógio local incorreto; interface geral, cargos, convites e mídia foram novamente conferidos. Código permanece local em `dev/caliari`, sem nova publicação ou implantação. O restante do catálogo continua pendente.

### Enquetes

A continuação local implementou [enquetes em canais de texto](community-polls.md), com permissões de criação, modo lento, votos públicos únicos/múltiplos, retirada, resultados sincronizados, confirmação para encerrar e vencimento independente do autor. O formulário conserva o rascunho do chat e seu próprio rascunho ao perder a permissão. Há validação de sessão para votar sem histórico; a perda do SSE limpa mensagens exclusivamente ao vivo, conservando o histórico autorizado.

Tipos, 171 testes e build aprovados (`release/polls-verify.log` e `release/polls-build.log`). O Electron validou o editor, votos de duas contas, leitura, rascunhos, revogação, encerramento e vencimento; as regressões de interface, cargos, convites e mídia passaram. As alterações continuam locais em `dev/caliari`, sem commit, PR, publicação ou implantação.


### Tópicos públicos e privados

A continuação local implementou [tópicos públicos e privados](community-threads.md), com herança de permissões, envio independente do canal principal, participação, notificações, origem em mensagem, busca de arquivados, arquivamento por inatividade, bloqueio e exclusão confirmada/em cascata. A revogação elimina acesso ao histórico e aos anexos, e limpa a interface e os avisos internos. A copropriedade do HQ permanece preservada. A confirmação de exclusão do canal principal também foi corrigida para conservar dados e diálogo quando o serviço falhar.

Tipos, 181 testes e build aprovados (`release/threads-verify.log` e `release/threads-build.log`). O Electron validou os tópicos com HTTP/SSE reais, inclusive notificações, revogação, permissões independentes de envio e falha de persistência. As regressões de interface geral, cargos, moderação, convites e mídia com quatro clientes passaram. Os arquivos locais de referência continuam preservados. As implementações permanecem sem commit em `dev/caliari`; não houve PR, publicação, implantação nem alteração da versão 0.1.17. O restante do catálogo continua pendente.


### Eventos da comunidade

A continuação local implementou [eventos da comunidade](community-events.md): Criar eventos administra os próprios; Gerenciar eventos permite atuar nos de terceiros. Eventos de voz respeitam canal, categoria e Conectar; eventos em outro local têm início e término automáticos. Há interessados, busca, histórico, edição, confirmações, avisos no sino e no sistema e navegação para o evento. Rascunhos são preservados em conflitos e revogações. Avisos persistidos sem acesso são removidos ao carregar os dados autorizados; a auditoria de canais removidos também passou a conservar a privacidade do contexto anterior.

Tipos, 189 testes e build aprovados (`release/events-verify.log` e `release/events-build.log`). O Electron validou 17 verificações de eventos, incluindo ponte HTTP/SSE, notificações, autorização, revogação e falha de persistência. Regressões de interface geral, cargos, moderação, tópicos, convites e mídia com quatro clientes passaram. Não houve commit, PR, publicação ou implantação. As alterações continuam em `dev/caliari`, na base 0.1.17; arquivos de referência locais permanecem preservados. Expressões, aplicações, integrações e as demais operações indisponíveis do catálogo continuam pendentes.


### Status dos canais de voz

A continuação local implementou [status dos canais de voz](voice-channel-status.md), separado de renomeação e de perfis. Definir status exige a permissão específica e participação real na sala; fora dela, exige adicionalmente Gerenciar canais. Há persistência, auditoria, sincronização e privacidade conforme o canal/categoria. O painel conserva rascunhos em conflitos ou revogações, e falhas de gravação não produzem confirmação falsa. O texto fica compacto na lista e no cabeçalho, sem aparecer na coluna recolhida. Também foi ajustado o posicionamento do ícone de eventos para não ocupar uma linha adicional no card do servidor.

Tipos, 194 testes e build aprovados (`release/voice-status-verify.log` e `release/voice-status-build.log`). O teste Electron executa 13 verificações com sessão de voz e worker mediasoup reais, microfone sintético, HTTP/SSE e ponte do desktop. Não houve commit, PR, publicação ou implantação. As alterações continuam locais em `dev/caliari`; os arquivos de referência foram preservados. Detecção de atividade de voz, Pressionar para falar, Prioridade de fala e demais operações indisponíveis do catálogo continuam pendentes.

As regressões Electron de interface geral, editor de cargos, eventos, tópicos, moderação e convites também passaram nesta etapa. O teste com quatro clientes e worker mediasoup real confirmou novamente RTP, mute/deafen, movimentação por ticket e revogação de permissões.


### Atividade de voz e Pressionar para falar

A continuação local implementou [modos de entrada de voz](voice-input-modes.md). O serviço aplica Atividade de voz, exige tecla quando essa permissão falta e controla renovações da publicação no mediasoup. O componente global do Windows usa somente a tecla selecionada, funciona com a janela oculta e encerra com seu proprietário. Preferências ficam separadas por conta, e o modo exigido pela sala conserva a preferência global. Corte local, bandeja, mute/deafen, reconexão, troca de dispositivo e moderação foram ligados ao estado real da publicação. O painel de áudio foi compactado; o teste local e as proteções de entrada foram preservados. A autoridade interna de voz passou a consultar somente política/canais/apelidos, evitando montar o histórico do chat em cada renovação.

Tipos, 206 testes e build aprovados (`release/voice-input-verify.log` e `release/voice-input-build.log`), além da compilação do componente Windows. Dois clientes com RTP real validaram o protocolo de tecla; a interface Electron passou em 17 verificações com atalho global e mídia sintética. Interface geral, cargos, moderação, eventos, tópicos, convites, status e voz com quatro clientes também passaram. A atualização de duas instalações de teste, 1.0.0 para 1.0.1, carregou o novo componente e reabriu sem erro de execução (`release/voice-input-update-verify.log`); a limpeza temporária foi corrigida para tolerar o desinstalador assíncrono. Nenhum instalador publicado foi substituído.

As alterações continuam locais em `dev/caliari`, na base 0.1.17, sem commit, PR, publicação ou implantação. Arquivos locais de referência foram preservados. O catálogo está em 36 de 52 permissões disponíveis; prioridade de fala, expressões, aplicações, integrações e as demais operações indisponíveis continuam pendentes. O objetivo completo permanece em andamento.


### Integração e publicação autorizadas

O usuário solicitou concluir os recursos restantes e, somente depois, realizar PR e merge na main. Pela regra do AGENTS.md, essa conclusão também exige uma nova versão estável publicada, com instalador, blockmap e latest.yml válidos. Foi criado novo snapshot da árvore de trabalho e de todas as referências em release/local-preservation-continuation-*, antes do fetch; a main remota continua alinhada ao HEAD local cbba6ed. Monetização, assinaturas e impulsionamentos foram explicitamente excluídos desta entrega até existir cobrança; os demais recursos continuam no escopo. Nenhum PR, commit, merge ou publicação foi realizado nesta etapa.


### Prioridade de fala

Foi implementada [prioridade de fala](priority-speaker.md), com opção no modo de tecla, permissão por canal/categoria, indicação visual e redução temporária das outras vozes sem alterar preferências salvas nem áudio de tela. Perder a prioridade conserva a fala normal; mute, deafen, liberação e vencimento da tecla removem o efeito. Tipos, 209 testes e build aprovados. Três clientes reais validam RTP e ganhos Web Audio; a interface passou nas verificações adicionais de opção, mute, persistência, indicação e liberação. As alterações continuam locais, sem PR ou publicação; as demais capacidades e a integração/publicação autorizadas permanecem em andamento.


### Estatísticas do servidor

Foi implementado [o painel de estatísticas](community-insights.md), com permissão própria, consulta HTTP autenticada, contagens do histórico central autorizado e dias no fuso do usuário. Canais ocultos e sem histórico não são agregados; respostas antigas não restauram dados após revogação. Datas de contas e números financeiros não são inventados. O painel de administração passou a se chamar Configurações do servidor, reunindo cargos, categorias e as demais abas. Tipos, 214 testes e build aprovados; a interface Electron passou em 11 verificações com a ponte e HTTP/SSE reais. As alterações continuam locais e a integração/publicação só será executada após concluir o restante autorizado.

### Leitura em voz e mensagens gravadas

Foram implementadas [leitura em voz](community-speech.md) e [mensagens gravadas](voice-messages.md). TTS usa vozes Windows e WAV em memória, com reprodução automática optativa por conta; a consulta autenticada e atual respeita entrega ao vivo e perda de acesso. A saída global no card e na bandeja também funciona fora de chamadas. Mensagens gravadas possuem captura Opus, prévia, cancelamento, arquivo no armazenamento existente e envio explícito, com repetição de upload evitada após falha ao persistir a mensagem. Não foi criado armazenamento automático de imagens na VPS.

Tipos, 233 testes sem falhas ou casos ignorados e build aprovados. Os testes Electron de TTS e mensagens gravadas passaram 15 e 13 verificações, respectivamente; a gravação usa microfone sintético e o serviço de arquivos local. Os componentes de captura são encerrados ao navegar ou perder permissão. Catálogo: 40 de 52 capacidades disponíveis. Os demais recursos não financeiros, PR, merge e publicação continuam em andamento; nada foi publicado nesta etapa.

### Integrações por webhook

[Webhooks de entrada](community-webhooks.md) receberam administração por canal, chave aleatória exibida uma vez e armazenada somente como hash, autenticação de envios externos, autorização atual do criador, mensagens identificadas, modo lento, limite de frequência e repetição controlada. Rotação, exclusão, remoção do criador e exclusão do canal revogam as credenciais. Seis testes HTTP e 14 verificações Electron passaram. As regressões de interface, cargos, voz com quatro clientes, tecla global e prioridade também passaram após a inclusão da saída global para mensagens de áudio. O catálogo passa a 41 de 52 permissões disponíveis. Monetização permanece excluída; demais recursos e integração/publicação ainda em andamento.

### Emojis e figurinhas personalizados

Foi implementada a [biblioteca de expressões](community-expressions.md): recursos por servidor, criação e manutenção com permissões próprias, imagens no armazenamento existente, prévias compactas, escolha no compositor, envio de emoji/figurinha e autorização distinta para uso externo. Há redução real da prévia Windows, conservação do upload após falha, atualização por revisão específica, conflitos e exclusão confirmada. O serviço de arquivos autoriza bibliotecas e referências preservadas no histórico conforme o membro e o canal. Sete testes HTTP e 14 verificações Electron cobrem a operação. O catálogo passa a 45 de 52 capacidades disponíveis. Sons, aplicativos, atividades, pedir fala e os fluxos de cargos gerenciados/vinculados ainda precisam ser concluídos, além da integração e publicação autorizadas. Não houve commit, PR, merge ou release nesta etapa.

### Commit local de preservação e painel de sons

O conjunto validado até emojis e figurinhas foi registrado localmente em 8f7e414, apenas em dev/caliari. Um index.lock antigo, vazio e sem processo Git ativo impedia o commit; foi preservado com outro nome dentro da própria pasta .git antes de prosseguir. O documento original e os arquivos privados continuam fora do commit, com hashes conferidos. O arquivo nativo de áudio conserva o estado local de final de linha, sem alteração de conteúdo incluída. Não houve push, PR, merge ou publicação.

A continuação implementou [painel de sons](community-soundboard.md): biblioteca de clipes Opus, manutenção própria/de terceiros, sinalização autenticada, autorização por canal e origem, reprodução local limitada, volumes e saída, bloqueios e acesso temporário para participantes atuais. Cinco testes de serviço, quatro do controlador e 19 verificações Electron cobrem o fluxo. Sons externos e exclusão da origem foram validados. Catálogo: 47 de 52 operações disponíveis; aplicativos, comandos, atividades, pedido de fala e fluxos de cargos gerenciados/vinculados ainda permanecem pendentes, além da integração/publicação autorizadas.

### Encerramento solicitado para continuação em outra LLM

O usuário delimitou esta entrega: terminar a validação do palco, fazer PR/merge/publicação e preparar a retomada, deixando os demais recursos para outra LLM. O [palco](community-stages.md) passou nas 17 verificações Electron; tipos, 262 testes sem falhas/casos ignorados, componente Windows e build passaram. A versão 0.1.18 foi preparada consistentemente nos manifestos Node/Tauri/Rust, com notas e [documento de transição](LLM_HANDOFF.md). O catálogo possui 48 de 52 operações disponíveis; as três capacidades de aplicativos e a monetização continuam desabilitadas. Cargos gerenciados/vinculados não são apresentados como integrados a provedores.

O registro de publicação confirmado, após a integração, ficará em release/HANDOFF_FINAL.md. O arquivo será local/ignorado, preservando o documento de transição versionado sem iniciar outra versão recursiva.
