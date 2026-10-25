# Status dos canais de voz

Implementação local na base 0.1.17, ainda sem publicação ou implantação. A permissão Definir status do canal de voz agora controla uma operação real no serviço da comunidade.

## Comportamento

O painel da engrenagem do canal de voz permite definir, substituir e remover seu status. Esse texto informa o assunto da conversa, sem renomear a sala ou alterar o perfil de uma pessoa. O status aparece abaixo do nome da sala na barra lateral e no cabeçalho do canal. Na coluna recolhida continua aparecendo apenas a primeira letra do canal; o status não ocupa uma nova área. Textos longos são cortados visualmente e permanecem acessíveis pelo tooltip.

São aceitos até 500 caracteres, incluindo emojis. O serviço normaliza Unicode e remove espaços nas extremidades; vazio ou `null` removem o status. Controles e quebras de linha são rejeitados.

## Autorização

- É necessário Ver canal e Definir status do canal de voz.
- Quando a pessoa não está conectada à sala, também é necessário Gerenciar canais.
- A conexão é conferida pelo serviço na sessão WebSocket autenticada, no servidor e canal corretos. Uma alegação de conexão enviada pelo cliente não é suficiente.
- As regras do canal e da categoria são aplicadas. Timeout e revogação bloqueiam alterações. Gerenciar canais sozinho não substitui a permissão específica de status.
- A copropriedade de todos os participantes do ConTALK HQ permanece preservada.

O status é persistido junto ao canal no volume existente e sincronizado por HTTP/SSE. Quem não pode ver a sala não recebe seu status; o registro de auditoria também respeita esse contexto. Ao perder acesso, os dados saem da interface. O texto não é transmitido por mensagens de presença nem incorporado ao perfil global.

Conflitos de edição preservam o rascunho e exigem carregar explicitamente o status atual. A perda de permissão desabilita o salvamento sem apagar o rascunho. Uma falha de gravação conserva o status anterior e o texto digitado; a interface não apresenta sucesso indevido.

## Validação e limites

- Tipos, 194 testes e build aprovados (`release/voice-status-verify.log` e `release/voice-status-build.log`). Permanece o aviso conhecido de tamanho de chunk.
- `tests/voice-status.test.mjs` usa HTTP e WebSocket reais para verificar participação, canal correto, cargos, categoria, timeout, revogação, privacidade, reinício, conflitos e falha de persistência.
- `tests/run-voice-status-ui-smoke.mjs` executa 13 verificações na aplicação Electron com ponte real, worker mediasoup e microfone sintético. Não usa dispositivos físicos nem altera a VPS.

A separação entre a permissão de status, a participação na chamada e Gerenciar canais foi conferida na [referência oficial do endpoint de status](https://github.com/discord/discord-api-docs/blob/main/developers/resources/channel.mdx#set-voice-channel-status). Contas locais, perfis, anexos, tickets temporários e transporte mediasoup/coturn permanecem na arquitetura atual. Atividade de voz e Pressionar para falar são implementados no [módulo de entrada de voz](voice-input-modes.md). Prioridade de fala foi implementada no [módulo de prioridade](priority-speaker.md); as demais operações indisponíveis do catálogo continuam pendentes.
