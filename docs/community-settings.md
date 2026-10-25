# Apelidos e configurações do servidor

Continuação local sobre 0.1.17, ainda não publicada ou implantada. As alterações usam os comandos autenticados, as revisões, o SSE, a auditoria e o volume existente da comunidade. A conta, a senha, o perfil, a foto e o nome global continuam locais.

## Apelidos

No menu de contexto do perfil dentro de um servidor, “Alterar apelido no servidor” abre o painel do membro. O campo aceita até 32 pontos de código Unicode após normalização NFC; espaços externos são removidos, controles e quebras de linha são rejeitados. Deixar vazio e salvar remove o apelido, restaurando a apresentação do perfil. Emojis com unidores são aceitos dentro do limite.

Alterar o próprio apelido exige `CHANGE_NICKNAME`. Alterar o de outra pessoa exige `MANAGE_NICKNAMES` e posição superior, conservando a proteção do proprietário. No HQ, todos permanecem coproprietários: cada pessoa pode alterar seu próprio apelido, sem que outro coproprietário o sobrescreva. Essas regras seguem o [catálogo e a hierarquia oficiais](https://docs.discord.com/developers/topics/permissions), o [endpoint do membro](https://docs.discord.com/developers/resources/guild#modify-guild-member) e os [limites de nomes](https://docs.discord.com/developers/resources/user#usernames-and-nicknames).

O campo opcional `server.nicknames` armazena somente apelidos de membros atuais. Canais de texto, lista de membros, perfil no contexto do servidor, ocupantes e transmissões exibem o apelido. O serviço de mídia envia `serverNickname` separado de `name` e `identity`; o cliente não pode forjá-lo com uma atualização de perfil. Presença global, amizades, mensagens diretas, autoria e IDs continuam usando a identidade e o perfil originais. Renomear não reescreve o histórico nem muda os direitos do membro.

O apelido é recebido por outros clientes via SSE e pelo perfil de mídia, inclusive em uma sessão já conectada; também permanece após reconectar ou reiniciar o serviço. Expulsão/banimento remove o apelido e readmissão por convite não o recupera. Um editor com rascunho não sobrescreve silenciosamente uma alteração recebida de outra pessoa: exige carregar o valor atual antes de salvar novamente.

## Configurações gerais

A engrenagem do servidor abre Configurações do servidor. A aba Geral permite salvar nome (1–100 caracteres) e descrição (até 300), com `MANAGE_GUILD`. O nome chega à navegação, ao título e aos clientes conectados. A descrição pode ser consultada no título do nome na lateral, sem recriar o antigo card “Sobre o servidor”.

O comando aceita apenas esses dois campos. Não altera ID, participação, copropriedade, cargos, permissões, canais ou mensagens. Gerenciar servidor é independente de Administrador, Gerenciar cargos e Gerenciar canais: um gerente de servidor não recebe essas outras ações automaticamente. Alterações concorrentes preservam o rascunho e exigem recarregamento explícito; revisão obsoleta ou falha de persistência não publica uma atualização. Não há configuração de credenciais de infraestrutura nesta interface.

## Evidências

- `tests/community-nicknames.test.mjs`: validação Unicode, permissões separadas, hierarquia/copropriedade, ator autenticado, identidade preservada, auditoria filtrada, persistência, erro de gravação, revisão obsoleta, expulsão/readmissão, SSE e perfis WebSocket reais. Inclui tentativa de forjar o apelido pelo canal de mídia.
- `tests/community-service.test.mjs`: gerenciamento do servidor com permissão específica, rejeição de campos indevidos, preservação de propriedade/dados, sincronização entre clientes, reinício, revisão obsoleta e falha de gravação.
- `tests/run-moderation-ui-smoke.mjs`: formulários reais no Electron com ponte e serviço HTTP/SSE/WebSocket, alteração própria pelo menu de contexto, restauração do nome do perfil, preservação do perfil global fora do servidor, rascunhos concorrentes, nome/descrição na aplicação e cancelamentos de moderação. Capturas em `release/moderation-ui-smoke`.
- Regressão: tipos, testes, build, interface geral, editor de cargos, convites e quatro clientes de mídia com worker mediasoup real.

Essas três permissões passaram a ter operações reais e estão habilitadas no catálogo. Os demais recursos inexistentes, como tópicos, eventos e integrações, continuam indisponíveis. Implementar estes formulários não equivale a concluir o documento de cargos inteiro.
