# Reações, fixações e modo lento

Continuação local sobre 0.1.17. Ainda não publicada ou implantada. As operações usam a autoridade da comunidade, a revisão atual e o mesmo volume de mensagens e cargos. Não alteram a arquitetura mediasoup/coturn, as contas locais, os perfis ou o armazenamento de imagens.

## Reações

As mensagens dos canais de texto têm controles SVG compactos ao passar o mouse ou usar o teclado. As reações existentes permanecem visíveis, com contagem, indicação da própria participação e nomes de usuário no título. O seletor oferece escolhas rápidas e um campo para outro emoji Unicode. Não aceita URLs, texto arbitrário ou emojis externos de outros serviços.

É necessário Ver canal e Ler histórico para reagir. Criar um grupo novo de emoji exige `ADD_REACTIONS`; participar de um grupo existente não exige essa permissão. Cada conta aparece uma única vez por emoji. A própria reação pode ser retirada. Durante timeout, não é possível adicionar reações. São aceitos até 20 emojis diferentes por mensagem; juntar-se a um já existente continua permitido quando o limite foi atingido. Remover o último participante libera a vaga.

Quem tem `MANAGE_MESSAGES` pode remover a reação de outra pessoa ou todas as reações. A remoção em lote pede confirmação separada; cancelar conserva os dados. A identidade do autor é obtida da chave autenticada: não é possível adicionar uma reação em nome de outra pessoa. Remoções administrativas têm auditoria; participações comuns não enchem o registro administrativo.

A distinção entre criar e participar de reações segue a [operação oficial de reação](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx#create-reaction). A normalização unifica seletores de apresentação e aceita sequências Unicode, incluindo tons de pele, famílias, bandeiras e teclas. Emojis/figurinhas externos continuam dependentes dos módulos ainda inexistentes de expressões.

## Mensagens fixadas

`PIN_MESSAGES` permite fixar e desafixar com os controles da mensagem. Consultar a lista exige Ver canal e Ler histórico. A lista é aberta pelo ícone de fixação no cabeçalho do canal e inclui mensagens antigas que já saíram da janela das últimas 100 mensagens. Não é necessário carregar o histórico inteiro para encontrá-las.

O limite local é de 250 fixações por canal. A fixação conserva autor, identidade, conteúdo e data original, acrescentando data e responsável pela fixação. Repetir a mesma ação não troca o responsável inicial. Apagar a mensagem a remove também da lista. Perder acesso ao histórico ou trocar de conta/servidor oculta imediatamente o conteúdo e invalida respostas pendentes. A consulta da lista não acrescenta mensagens antigas ao contador de não lidas.

Mensagens de visualização única não aceitam fixação ou reações: esses controles não devem expor permanentemente algo que foi enviado para ser aberto uma vez. O controle de acesso da consulta e a permissão específica de fixação seguem a [referência oficial de mensagens](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx#get-channel-pins).

## Modo lento

Na engrenagem do canal de texto, a seção Modo lento permite definir de 0 a 21600 segundos por pessoa; 0 desativa o intervalo. Salvar exige `MANAGE_CHANNELS`. A interface conserva o rascunho se outra pessoa alterar o intervalo durante a edição.

O serviço verifica o intervalo na fila serial de comandos. A última publicação é persistida por canal/conta, separada do texto da mensagem: apagar a última mensagem ou reiniciar não libera o envio antes da hora. Falhas de gravação não consomem o próximo envio. Editar ou reagir não conta como uma nova mensagem. Somente `BYPASS_SLOWMODE` ignora o intervalo; o privilégio de proprietário/administrador já engloba essa permissão. Gerenciar mensagens ou canais isoladamente não a substitui, conforme a [definição atual de canal](https://github.com/discord/discord-api-docs/blob/main/developers/resources/channel.mdx#channel-object).

O snapshot informa somente o prazo da própria conta nos canais visíveis. O compositor mostra a espera, permite continuar digitando, conserva anexos/rascunho e libera Enviar ao terminar. A contagem usa o horário informado pelo servidor e tempo monotônico no cliente, para funcionar com o relógio do computador adiantado ou atrasado. Também foi corrigido o botão Enviar para aceitar um arquivo selecionado no desktop antes de seu upload.

## Moderação e privacidade do histórico

O menu compacto também permite apagar mensagens de outros membros com `MANAGE_MESSAGES`, pedindo confirmação separada. O autor continua sendo o único que pode editar seu texto. Cancelamentos não modificam a mensagem.

Deltas de reação/fixação atualizam mensagens antigas já carregadas sem apagar texto, marca de edição ou menções. As mudanças de metadados não criam mensagens novas. O SSE foi corrigido para não enviar edições ou metadados de mensagens antigas a quem não tem Ler histórico. Essa pessoa ainda recebe atualizações de mensagens que chegaram ao vivo durante a sessão autorizada. Perder Ver canal ou transitar pelas permissões de histórico limpa esse rastreamento, evitando recuperar conteúdo antigo por um evento posterior.

## Validação e estado de entrega

- `tests/community-chat.test.mjs`: HTTP/SSE reais; Unicode, limites, idempotência, autor autenticado, reações existentes, moderação, timeout, canais privados, histórico negado, visualização única, fixações antigas, persistência/reinício, exclusão, falha de gravação, modo lento e concorrência, bypass específico e proteção de eventos antigos.
- `tests/community-history.test.mjs`: deltas aplicados ao histórico paginado sem perda de texto/edição/menções, retirada de fixação e limpeza após perda de acesso.
- `tests/run-moderation-ui-smoke.mjs`: Electron com ponte HTTP/SSE real, fixação fora da janela recente, lista e desafixação, reação, confirmação/cancelamento de remoção em lote e de mensagem alheia, uso de reação existente sem Adicionar reações, concessão de fixação, limpeza da lista ao perder histórico, configuração do intervalo, contagem com relógio local adiantado, preservação do rascunho e envio após a espera.
- Tipos, 159 testes e build passaram. Regressões de interface geral, cargos, convites e quatro clientes com worker mediasoup real também passaram; capturas e logs ficam em `release`, ignorados pelo Git.

Adicionar reações, Fixar mensagens e Ignorar modo lento estão habilitados no catálogo porque agora existem operações correspondentes no serviço e no aplicativo. O objetivo integral do documento de cargos continua em andamento: tópicos, eventos, expressões, comandos/aplicações e integrações, entre outros recursos, ainda não estão disponíveis. A continuação seguinte também implementa [enquetes](community-polls.md). Nenhum serviço de produção ou instalador publicado foi modificado por esta continuação.
