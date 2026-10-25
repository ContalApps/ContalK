# Moderação de membros

Implementação local na `dev/caliari`, sobre a arquitetura mediasoup/coturn da 0.1.17. Estas alterações ainda não estão publicadas nem implantadas na VPS.

## Ações disponíveis

O menu do perfil dá acesso ao painel de cargos e moderação quando a pessoa possui a permissão correspondente. Expulsar e banir exigem confirmação separada, com motivo opcional de até 512 caracteres. As ações são autenticadas e verificadas novamente no serviço da comunidade, independentemente da interface.

- **Expulsar:** remove a participação, os cargos, o timeout e as exceções individuais daquele servidor. Não cria um banimento e não apaga o histórico de mensagens.
- **Banir:** remove a participação e registra um bloqueio persistente da identidade provisionada no servidor, com responsável, motivo e data.
- **Remover banimento:** exige Banir membros e confirmação na aba Banimentos do painel do servidor. Remove o bloqueio, sem restaurar a participação, os cargos ou as exceções anteriores.

As regras seguem a distinção do documento de referência e a [hierarquia de permissões](https://docs.discord.com/developers/topics/permissions), com operações separadas de [remoção de membro e banimento](https://docs.discord.com/developers/resources/guild). Não é permitido agir contra si mesmo, contra proprietários ou contra membros de hierarquia igual ou superior, mesmo com Administrador. No ConTALK HQ, todos os participantes continuam coproprietários nesta fase: não se pode expulsar ou banir outro coproprietário. Essa política não foi alterada.

O banimento pertence ao servidor, não à conta local ou ao computador. A conta, o perfil e a participação em outras comunidades não são apagados. A lista e os motivos dos banimentos só são entregues a quem possui Banir membros; a auditoria mantém sua permissão de leitura própria.

## Aplicação e persistência

As operações usam a revisão atual do servidor e a mesma persistência JSON/volume de comunidade, acrescentando campos opcionais de remoções e banimentos. Não há substituição do volume ou criação de outra base de mensagens. Contas removidas não são readmitidas automaticamente pelo provisionamento no reinício do serviço. O histórico existente é preservado.

A remoção encerra o SSE do destinatário com um aviso de acesso revogado e um retrato vazio compatível com o parser de clientes anteriores. O backend reconcilia as sessões mediasoup, encerra a sessão removida e recusa novos tickets; um ticket anterior ainda não utilizado também não permite entrar depois da remoção.

O cliente atualizado limpa canais e histórico central da memória, encerra a chamada e conserva a configuração como central, sem voltar ao transporte legado. Respostas de requisições anteriores à revogação não podem restaurar o conteúdo. O arquivo local anterior à migração continua preservado; isso não oferece acesso novo ao servidor.

## Validação

- `tests/member-moderation.test.mjs`: serviço HTTP real, autoria autenticada, hierarquia, autoproteção, copropriedade, persistência, auditoria, filtragem da lista, histórico preservado, unban sem readmissão e fechamento do SSE. Também autentica um WebSocket real de mídia e verifica sua revogação e a rejeição de ticket anterior.
- `tests/role-revocation.test.mjs`: resposta HTTP atrasada não recupera o histórico após a revogação.
- `tests/run-moderation-ui-smoke.mjs`: Electron com ponte real e HTTP/SSE de teste. Perfil → moderação, cancelamento, confirmação, motivo, lista, remoção de banimento, recebimento da revogação pelo processo principal e renderer, limpeza da interface/cache e preservação da conta local. Confere a proteção do HQ.
- Regressão: suíte completa de tipos/testes, build, editor de cargos e quatro clientes Electron com worker mediasoup real.

Os testes usam identidades e dados sintéticos e não moderam participantes de produção. Capturas e resultados locais ficam em `release/moderation-ui-smoke`, ignorados pelo Git.

## Escopo restante do objetivo de cargos

Esta entrega habilita Expulsar membros e Banir membros no catálogo porque as operações agora existem. A continuação local também implementa [convites e readmissão](community-invites.md). A [moderação de voz](voice-moderation.md) também foi concluída e validada localmente. O objetivo completo do documento permanece em andamento: demais operações de servidor/canal e os módulos de tópicos, eventos, bots e integrações ainda precisam de implementação e validação. As respectivas permissões continuam desabilitadas.

O retorno após expulsão ou remoção de banimento exige aceitar um convite válido; não restaura cargos antigos nem ocorre durante um reinício. Enquanto houver banimento, o convite continua bloqueado. Integrações verificadas e recursos comerciais descritos no estudo continuam dependentes de seus módulos próprios, sem simulação.
