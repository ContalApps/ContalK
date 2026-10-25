# Sistema de cargos do ConTALK

## Referência e decisão inicial

O documento fornecido `Sistema de Cargos.docx` foi lido integralmente, incluindo o catálogo de permissões, regras de hierarquia, exceções, categorias, cargos gerenciados e roteiro de validação. A implementação tem validação local de interface, serviços e voz; sua ativação em produção ainda depende da infraestrutura e da migração descritas ao final.

O usuário determinou que **todos os participantes do ConTALK HQ sejam proprietários por enquanto**. Por isso, o servidor `srv-1` começa com a política explícita `all-members`: participantes conhecidos são coproprietários; um identificador desconhecido não recebe essa condição. Essa decisão é do ConTALK e difere da propriedade exclusiva descrita no documento do Discord. Um nome de cargo não altera a propriedade.

As regras fundamentais foram conferidas na [referência técnica de permissões](https://docs.discord.com/developers/topics/permissions): combinar permissões, avaliar exceções por canal e membro em ordem, conservar bits extensos como strings decimais e respeitar hierarquia na administração. A [visão geral de cargos](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions) orienta a organização visual e os limites administrativos. Os [estados de permissão por canal](https://support.discord.com/hc/en-us/articles/10543994968087-Channel-Permissions-Settings-101) distinguem autorização, negação e herança. Consulta em 23 de outubro de 2026.

## Modelo e cálculo

Cada servidor possui um cargo-base `@everyone`, obrigatório e não atribuível manualmente. Os demais cargos têm identificador, nome de até 100 caracteres, posição, permissões, cores, estilo, ícone, destaque na lista, opção de menção e origem de gerenciamento. A referência limita a estrutura a 250 cargos por servidor. A cor visível vem do cargo mais alto que forneça uma cor; cargos sem cor não apagam as cores inferiores. Organização visual não concede autoridade.

O cálculo parte do cargo-base e combina as permissões dos cargos atribuídos. Proprietários e Administrador possuem exceções explícitas. No canal, aplicam-se as decisões de `@everyone`, depois as negações e autorizações agregadas dos demais cargos e, por último, a exceção individual. Um cargo superior não cancela por si só um inferior. A atribuição de uma autorização pode prevalecer sobre a negação de outro cargo no mesmo nível de avaliação.

A ausência de visualização impede as ações dependentes do canal. A ausência de envio impede anexos, prévias e outras formas dependentes de publicação. Conectar e falar são permissões separadas. Timeout é um estado com prazo, separado dos cargos; não deve remover as atribuições do membro. O cálculo precisa distinguir as restrições temporárias da alteração permanente de uma função.

As categorias possuem suas próprias exceções. Canais sincronizados acompanham a categoria; os demais conservam suas decisões locais. Editar as exceções de um canal deve indicar que ele foi desassociado da sincronização. A opção de sincronizar novamente deve ser explícita.

## Administração e identidade visual

Criar, editar, reordenar, excluir, atribuir e remover cargos são operações distintas. Gerenciar cargos permite atuar abaixo do cargo mais alto do operador. O operador não pode conceder capacidades que não possui. Administrador ignora as exceções de canal, mas não elimina todas as restrições de hierarquia em ações contra outros membros. A exclusão deve limpar as atribuições e as exceções que referenciam o cargo, preservar `@everyone` e exigir confirmação.

A administração deve oferecer busca de membros, múltiplas atribuições, identificação de cargos gerenciados, agrupamento por cargo destacado e pré-visualização como um ou vários cargos. A pré-visualização não deve conceder privilégios reais ao observador nem simular estado de áudio individual inexistente. As cores e os ícones precisam aparecer de maneira consistente nas mensagens, perfis e listas de membros.

Menções de cargo dependem da opção de cargo mencionável ou da permissão de menções amplas do emissor. Receber notificações de menções de cargo também depende da preferência do destinatário. Menções não podem expor canais aos quais o destinatário não tem acesso.

## Catálogo de capacidades

O módulo de cálculo contempla o catálogo do documento, incluindo bits superiores a 32: servidor e canais, cargos, auditoria, convites, expulsão, banimento, apelidos, timeout, leitura, histórico, publicação, links, anexos, menções, reações, enquetes, fixação, modo lento, tópicos, voz, vídeo, transmissão, moderação de voz, eventos, expressões, aplicações, webhooks, atividades e análises. Uma permissão só deve ser apresentada como uma função executável quando a operação correspondente estiver implementada e autorizada no destino que a processa.

O documento também descreve recursos específicos do ecossistema Discord: impulsionamento, assinaturas, bots, integrações, conexões verificadas e palcos. No ConTALK, não se deve simular uma assinatura, uma conexão de conta ou uma verificação externa apenas pelo navegador. Cargos desse tipo exigem uma origem identificada e uma concessão verificada; cargos gerenciados não devem ser concedidos ou removidos manualmente como cargos comuns. Estilos gradientes, holográficos e ícones podem existir como apresentação do ConTALK sem alegar que o aplicativo oferece os planos comerciais do Discord.

Na continuação local de 25/10, Expulsar membros e Banir membros passaram a ter operações reais, com confirmação, hierarquia, persistência, auditoria e revogação de acesso por HTTP/SSE/WebSocket. A remoção de banimento não restaura cargos nem participação. A copropriedade do HQ permanece protegida. Os detalhes e o escopo ainda pendente estão no [guia de moderação](member-moderation.md); essa continuação ainda não foi publicada nem implantada.

Criar convite também passa a ter operação real na continuação local: link, prévia, prazo, limite de usos, revogação, aceite autenticado e readmissão sem cargos antigos. Banimentos impedem o aceite. Novas entradas registram data e origem para revisão, sem inventar a idade das contas locais. Os detalhes estão em [convites e readmissão](community-invites.md). Isso não conclui as demais operações do catálogo.

## Autoridade e sincronização

A comunicação atual usa WebSocket autenticado e SFU mediasoup. O backend aplica permissões de canal e encerra publicações/sessões ao revogar acesso; o teste isolado com quatro clientes verifica esse comportamento. Detalhes e limites de validação em [Meteor Cloud](meteor-voice.md).

Para o HQ, a política atual de copropriedade permite administrar a estrutura sem escolher um dono arbitrário. Essa exceção não deve ser utilizada como prova de que servidores com propriedade restrita já estão seguros. A migração deve manter histórico, IDs dos canais e preferências existentes, registrar alterações administrativas e sobreviver à reconexão e a clientes com dados antigos.

## Validação obrigatória da entrega

Os testes devem demonstrar combinação de cargos, precedência individual, conflitos entre autorizações e negações, proteção de `@everyone`, limites de hierarquia, prevenção de elevação, cargos gerenciados, sincronização de categorias, timeout, menções, apresentação e atualização após revogação. Também devem verificar operações entre clientes reais e tentativas de contornar a interface. A conclusão exige editor e atribuição de cargos, aplicação nas ações reais, sincronização e auditoria; testes do cálculo puro não bastam.

Estado atual: o cálculo e os comandos foram ligados a um serviço HTTP autenticado, com persistência, revisões, SSE e auditoria. O editor do Electron já cria, edita, ordena, exclui e atribui cargos; o menu do membro oferece atribuições e restrição temporária. Há regras de canal em três estados, categorias sincronizáveis, prévia sem privilégios do observador, cores, ícones, agrupamento e menções validadas no servidor. No modo de comunidade configurada, canais e mensagens usam comandos centrais e a voz solicita tokens com fontes limitadas pelas permissões. A interface e o serviço foram validados juntos com dois clientes autenticados.

Os downloads novos podem ser vinculados à autoridade da comunidade: o serviço de arquivos revalida o acesso tanto ao emitir o link quanto ao entregar o conteúdo. Os testes HTTP cobrem revogação, links já emitidos, compartilhamento direto e tentativa de republicar um arquivo privado sem acesso. Arquivos legados preservam sua política anterior; esse comportamento não equivale à migração dos arquivos existentes.

A comunicação atual usa WebSocket autenticado e SFU mediasoup. O backend aplica permissões de canal e encerra publicações/sessões ao revogar acesso; o teste isolado com quatro clientes verifica esse comportamento. Detalhes e limites de validação em [Meteor Cloud](meteor-voice.md).

A comunicação foi implantada na VPS com mediasoup e coturn, administrada pelo Coolify, conforme o relatório da versão 0.1.17. Mensagens e cargos continuam no volume existente da comunidade; sessões de mídia usam tickets temporários. O aplicativo não contém emissor de tokens do provedor anterior nem suas credenciais. Contas, senhas e perfis continuam locais; a migração não cria autenticação central de contas nem armazenamento central de imagens. O serviço separado de arquivos/Telegram ainda depende de configuração própria. Recursos de plataforma inexistentes permanecem identificados como indisponíveis; não foram simuladas integrações verificadas, assinaturas ou impulsionamentos. Consulte [a execução do serviço](community-service.md) e [a validação da comunicação](communication-validation.md).


A continuação local também habilita Silenciar, Desativar áudio e Mover membros: há autorização por canal, ações confirmadas no perfil, persistência/auditoria, bloqueio de RTP no mediasoup e movimentação com ticket temporário. Essas ações não usam a hierarquia específica de kick/ban. A copropriedade do HQ permanece intacta. Consulte [a implementação e os limites de validação](voice-moderation.md). Ainda não houve publicação ou implantação dessa continuação.

A continuação seguinte implementa Alterar próprio apelido, Gerenciar apelidos e Gerenciar servidor. Apelidos são específicos do servidor, com hierarquia para terceiros, preservação dos nomes globais e sincronização no SFU; as configurações gerais permitem nome e descrição, sem conceder permissões de cargos/canais. Os formulários preservam rascunhos em conflitos de edição. Veja [operações, testes e limites](community-settings.md).

Reações, fixações e modo lento também têm operações reais na continuação local. Adicionar reações distingue criar de participar de um emoji existente; Fixar mensagens inclui consulta de mensagens antigas; Ignorar modo lento controla o bypass validado no serviço. A interface oferece moderação confirmada de mensagens e reações. O SSE não expõe mudanças de mensagens antigas a quem não pode ler o histórico. Veja [escopo e evidências](community-chat.md).

Enviar enquetes também foi ligado a operações reais: criação por cargo/canal e modo lento, votação pública simples ou múltipla, retirada, autor autorizado a encerrar e vencimento automático. Participantes de canais somente leitura podem votar; sem histórico, apenas em enquetes recebidas na sessão ao vivo autorizada. Consulte [o escopo e os testes de enquetes](community-polls.md). O restante do catálogo permanece em implementação.


Tópicos públicos e privados também possuem operações reais na continuação local: criação, participação, herança do canal principal, envio independente, origem em mensagem, busca, arquivamento automático, bloqueio e exclusão confirmada. A revogação remove acesso ao histórico, anexos e avisos internos. Gerenciar canais não substitui Gerenciar tópicos; a copropriedade do HQ permanece preservada. Consulte [o escopo e a validação de tópicos](community-threads.md). Aplicações e integrações continuam pendentes.


Criar eventos e Gerenciar eventos também possuem operações reais na continuação local: eventos próprios e de terceiros, autorização por canal/categoria, agenda, edição, estados, interessados, notificações e exclusão confirmada. A perda de acesso limpa o evento e seus avisos internos; o relógio do serviço controla os estados automáticos. A copropriedade do HQ permanece preservada. Consulte [o escopo, os limites e os testes de eventos](community-events.md). Expressões, aplicações, integrações e outras operações do catálogo continuam pendentes.


Definir status do canal de voz também tem operação real na continuação local. O serviço confere a sessão autenticada no canal; fora da chamada, exige adicionalmente Gerenciar canais. O texto é persistido no volume existente, sincronizado, auditado e ocultado de quem não pode ver a sala. A interface preserva rascunhos em conflitos, revogações e falhas de gravação. Veja [o escopo e os testes do status de voz](voice-channel-status.md). Prioridade de fala continua pendente e não foi marcada como disponível.


Atividade de voz agora autoriza o modo automático no serviço; sua negação força Pressionar para falar apenas no canal correspondente. Há tecla global Windows, preferências por conta, corte local imediato ao soltar, prazo de renovação no mediasoup e respeito a mute/deafen, reconexão e moderação. A bandeja acompanha a publicação efetiva. Consulte [modos de entrada, limites e evidências](voice-input-modes.md). O catálogo local apresenta 36 das 52 permissões como disponíveis; as 16 restantes incluem prioridade de fala, leitura em voz, expressões, aplicações, webhooks, atividades, palcos, mensagens de voz e análises. Essa contagem não equivale a uma porcentagem do trabalho total, pois os recursos têm tamanhos diferentes.


## Decisão de escopo — monetização

Em 25/10/2026, o usuário confirmou: assinaturas, impulsionamentos e análises de monetização permanecem indisponíveis até existir um sistema de cobrança. Esta entrega não cria pagamentos, benefícios comerciais ou números financeiros simulados. A permissão VIEW_CREATOR_MONETIZATION_ANALYTICS e origens de cargos vinculadas a cobrança não são apresentadas como funções executáveis. Os demais recursos do documento continuam no escopo de implementação.


Prioridade de fala também possui operação real: opção por conta no Pressionar para falar, autorização no canal, lista de participantes fornecida pelo serviço e redução temporária das outras vozes. Os volumes pessoais e o áudio de tela são preservados; revogar prioridade não impede fala normal. Consulte [implementação e evidências](priority-speaker.md). O catálogo local passa a 37 de 52 permissões disponíveis; uma das indisponíveis é monetização, explicitamente excluída desta entrega pelo usuário.


Ver estatísticas do servidor possui consulta autenticada e painel próprio, com contagens do histórico central autorizado, períodos de 7/30 dias e calendário no fuso do usuário. Revogações invalidam os dados e respostas em trânsito. Não são criadas métricas financeiras nem datas fictícias de contas. Consulte [escopo e evidências de estatísticas](community-insights.md). O catálogo local passa a 38 de 52 permissões disponíveis, com monetização explicitamente fora desta entrega.

### Leitura em voz

Enviar mensagens com leitura em voz possui envio autorizado no serviço e reprodução local optativa, com voz Windows, volume e dispositivo de saída por conta. Consultas atuais e revogação impedem leitura de conteúdo indisponível. Consulte [funcionamento e validação](community-speech.md). O catálogo passa a 39 de 52 permissões disponíveis; monetização continua excluída por decisão do usuário.

### Mensagens de voz

Enviar mensagens de voz possui gravação Opus, prévia e envio explícito, arquivo no armazenamento configurado e reprodução autenticada. Permissão própria, modo lento, revogações e cancelamento da captura são efetivos. Consulte [implementação e validação](voice-messages.md). O catálogo passa a 40 de 52 permissões disponíveis; monetização permanece excluída por decisão do usuário.

### Integrações por webhook

Gerenciar webhooks possui painel no canal, criação com chave mostrada uma vez, renomeação, renovação e exclusão confirmadas. Envios HTTP externos usam texto identificado, autorização atual do criador, limites e repetição controlada por nonce. Chaves e hashes não entram nos snapshots; cargos de bot não são simulados. Consulte [escopo e evidências](community-webhooks.md). O catálogo passa a 41 de 52 permissões disponíveis, com monetização explicitamente indisponível até existir cobrança.

### Emojis e figurinhas

Criar expressões, Gerenciar expressões, Usar emojis externos e Usar figurinhas externas possuem operações reais. Há biblioteca por servidor, imagem no armazenamento configurado, seleção e envio no compositor, manutenção própria/de terceiros, limites, conflitos e exclusão confirmada. Prévia estática, sem cobrança. Consulte [funcionamento e evidências](community-expressions.md). O catálogo passa a 45 de 52 permissões disponíveis; sons, aplicativos, atividades e pedir fala continuam pendentes. Monetização permanece excluída.

### Painel de sons

Usar painel de sons e Usar sons externos possuem comandos na sessão real de voz, cadastro Opus na biblioteca e reprodução autorizada nos clientes presentes. Permissões, bloqueios do servidor, origem, limites, acesso temporário ao arquivo, saída e volume são efetivos. Consulte [escopo e validação](community-soundboard.md). O catálogo passa a 47 de 52 permissões disponíveis. Aplicativos, comandos, atividades e pedido de fala continuam pendentes; monetização está excluída desta entrega.
