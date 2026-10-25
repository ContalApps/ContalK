# Moderação de voz — continuação local sobre 0.1.17

Estado: implementada e validada localmente, ainda sem publicação do aplicativo ou implantação do serviço. O mediasoup, o coturn, o Coolify e o volume existente da comunidade continuam sendo a arquitetura usada. Não foram adicionados LiveKit, segredos ao cliente, autenticação central de contas ou armazenamento central de imagens.

## Ações e permissões

O menu do perfil abre o painel do membro, que exibe a seção Voz quando ele está conectado a um canal visível. Cada ação pede confirmação separada e aceita motivo opcional de até 512 caracteres. As operações usam a identidade autenticada, a revisão da comunidade e a sessão real no SFU, sem confiar no canal informado pelo cliente.

- `MUTE_MEMBERS`: bloqueia o microfone do participante no servidor. O SFU encerra o produtor; o cliente atualizado encerra a captura e identifica o bloqueio no card e na bandeja.
- `DEAFEN_MEMBERS`: bloqueia o recebimento de áudio, incluindo o áudio de transmissões, e a publicação do microfone. Os consumidores de áudio ficam pausados no SFU. Vídeo e tela continuam disponíveis. Pedir diretamente a retomada de um consumidor não contorna a restrição.
- `MOVE_MEMBERS`: move para outro canal autorizado ou desconecta da voz. Para mover, o moderador precisa Ver, Conectar e Mover no destino; o participante precisa Ver e Conectar. Uma sala cheia ou sem acesso não encerra a chamada original.

As permissões de moderação de voz são verificadas por canal, sem a hierarquia específica de expulsão, banimento e apelidos. Essa distinção segue a [referência oficial de permissões](https://docs.discord.com/developers/topics/permissions). Os critérios de conexão e destino seguem a [operação de alteração do membro](https://docs.discord.com/developers/resources/guild#modify-guild-member). Todos os participantes do HQ conservam a copropriedade; ela não impede ações de áudio autorizadas nem é alterada por elas. As proteções de expulsão e banimento permanecem próprias dessas operações.

Os bloqueios de áudio são campos opcionais em `policy.voiceRestrictions`, persistidos no mesmo JSON/volume com auditoria. Eles permanecem após reconexão ou troca de sala, até serem removidos por alguém autorizado enquanto o membro está na voz. Expulsão, banimento e nova entrada por convite removem o estado anterior. Remover um bloqueio nunca abre automaticamente o microfone. Silenciamento e volumes pessoais continuam separados dessas restrições.

## Troca de sala

O backend reserva uma vaga e um ticket aleatório de uso único para o destino antes de salvar o comando. O ticket dura 30 segundos, fica vinculado à identidade e ao canal e é entregue apenas pela conexão autenticada do participante. Conexões concorrentes não podem tomar a vaga reservada durante a persistência. Se a gravação falhar, a reserva é cancelada e a chamada original continua.

Após salvar, o serviço entrega a instrução e encerra a sessão original. O aplicativo conecta os novos transportes no destino e verifica novamente o acesso. Preserva microfone e saída silenciados pelo usuário, encerra câmera e compartilhamento e mantém a renovação de tickets vinculada ao servidor correto. A auditoria registra “Movimentação de voz solicitada”: o cliente ainda pode perder a conexão antes de entrar no destino; a lista de ocupantes confirma a entrada efetiva. Nenhum token permite atravessar uma revogação posterior de acesso.

Clientes anteriores sem suporte a `voice-move-v1` recebem uma recusa de movimentação com pedido de atualização, conservando a chamada. Ainda podem ser desconectados ou ter áudio bloqueado no SFU. O cliente atualizado diferencia o encerramento por moderação e limpa o canal ativo, sem uma indicação falsa de reconexão. Respostas antigas de ocupantes são ignoradas após troca de conta, servidor ou revogação.

## Validação

- `tests/voice-moderation.test.mjs`: HTTP e WebSocket reais, permissões por canal, copropriedade, estados inválidos, sessão ausente, persistência/auditoria, reconexão com bloqueio, destino privado/cheio, ticket único, compatibilidade anterior, cancelamento da reserva por erro de gravação e disputa pela última vaga.
- `tests/voice-connection.test.mjs`: controles pessoais e troca de microfone não contornam a restrição; movimento preserva mute/deafen e usa o ticket recebido; desconexão informa o motivo; respostas antigas não restauram presença privada.
- `tests/tray.test.mjs`: bloqueios identificados e ações desabilitadas no menu nativo.
- `tests/run-community-voice-smoke.mjs`: quatro renderers Electron, worker mediasoup real e áudio/vídeo sintéticos. Confere encerramento da captura pelo mute, impossibilidade de republicar, interrupção efetiva de RTP de áudio pelo deafen, continuidade de vídeo, retomada de RTP sem abrir microfone e conexão por ticket de movimentação.
- `tests/run-moderation-ui-smoke.mjs`: painel real, ponte Electron, HTTP/SSE/WebSocket, confirmação/cancelamento, mute/deafen reversíveis, seleção do destino e desconexão. Também conserva os cenários de expulsão, banimento, limpeza de acesso e proteção dos coproprietários do HQ.

Resultados e capturas ficam em `release/native-voice-smoke` e `release/moderation-ui-smoke`, ignorados pelo Git. Não foram utilizados participantes ou credenciais da VPS. Restam a implantação coordenada de serviço/aplicativo, a validação humana com dispositivos físicos e redes distintas e as demais operações ainda indisponíveis do catálogo de cargos. Esta entrega não conclui tópicos, eventos, bots ou integrações.
