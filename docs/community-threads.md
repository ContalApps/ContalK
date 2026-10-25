# Tópicos da comunidade

Implementação local sobre a base 0.1.17, ainda sem publicação ou implantação na VPS. Usa o serviço e o volume existentes da comunidade; não altera contas locais, perfis, armazenamento de imagens ou o transporte mediasoup/coturn.

## Operações disponíveis

- Criar tópicos públicos ou privados em canais de texto, com nome, participantes e arquivamento por inatividade de 1 hora, 24 horas, 3 dias ou 7 dias. Tópicos não contêm outros tópicos. Há um limite separado de 1.000 tópicos por servidor, sem consumir o limite de 500 canais principais.
- Abrir um tópico público a partir de uma mensagem, sem copiar seu conteúdo. Mensagens de visualização única não podem servir de origem. A lista permite buscar tópicos ativos ou arquivados; a barra lateral mantém os ativos e o arquivado selecionado.
- Acompanhar, deixar de acompanhar e administrar participantes. Em tópicos privados, a remoção de um participante revoga o acesso, inclusive histórico, anexos e notificações internas. Participantes com Gerenciar tópicos mantêm acesso quando podem visualizar o canal principal.
- Renomear, arquivar, reabrir, bloquear e configurar o modo lento no painel da engrenagem. Exclusão exige confirmação separada. Excluir o canal principal também remove seus tópicos e dados associados.

## Autorização e privacidade

Os tópicos herdam as permissões do canal principal e de sua categoria; não aceitam exceções próprias nem convites diretos de servidor. Enviar mensagens em tópicos é independente de Enviar mensagens no canal principal. Novas políticas incluem a permissão de envio em tópicos no cargo-base; políticas existentes não são reescritas silenciosamente. A copropriedade de todos os participantes do ConTALK HQ permanece preservada, inclusive o acesso administrativo a tópicos privados.

Criar tópicos públicos e privados exige as respectivas permissões. Gerenciar canais não substitui Gerenciar tópicos. O criador pode administrar seu tópico enquanto ele não estiver bloqueado; bloquear e desbloquear requer Gerenciar tópicos. A visualização do canal principal continua necessária em todas essas operações.

Enviar em um tópico arquivado e desbloqueado o reabre automaticamente. Um participante que acompanha o tópico pode reabri-lo sem precisar de permissão de envio. Tópicos bloqueados exigem Gerenciar tópicos para publicação e administração. Reações e votos continuam sujeitos às permissões normais enquanto o tópico bloqueado estiver ativo; arquivar impede essas alterações. As verificações são feitas no serviço, inclusive para clientes antigos ou requisições diretas.

A entrada de um participante gera aviso no sino, sem transformar mensagens históricas em novas notificações. A perda de acesso remove o histórico central da interface e os avisos internos correspondentes. Notificações já entregues ao sistema operacional não são apagadas por essa limpeza. Dados centrais privados continuam excluídos do cache legado local.

As decisões de herança, envio e participação foram conferidas na [referência oficial de tópicos](https://docs.discord.com/developers/topics/threads). As operações implementadas e os limites acima descrevem o ConTALK; não pressupõem recursos comerciais ou autenticação do Discord.

## Validação

- `npm run verify`: tipos e 181 testes aprovados, sem falhas ou testes ignorados. Os testes de tópicos cobrem autorização, hierarquia de canais, isolamento privado, SSE, downloads, bloqueio, enquetes, arquivamento, reinício, persistência e exclusão em cascata.
- `npm run build`: frontend, main e preload aprovados; permanece o aviso conhecido de tamanho de chunk.
- `node tests/run-threads-ui-smoke.mjs`: aplicação Electron com HTTP/SSE reais e identidades sintéticas. Verifica criação, navegação, permissões independentes de envio, arquivamento, participação privada, notificações, revogação, cache e confirmação de exclusão. Uma falha de persistência injetada mantém o diálogo aberto e os dados intactos; a interface não informa sucesso indevido.
- Regressões Electron de interface geral, cargos, moderação, enquetes e convites aprovadas; mídia novamente aprovada com quatro clientes e worker mediasoup real.

Logs e capturas ficam em `release/threads-*`, ignorados pelo Git. Esses testes não alteram a comunidade de produção. O restante do catálogo do documento de cargos, incluindo expressões, aplicações e integrações, continua pendente e não é apresentado como implementado.
