# Eventos da comunidade

Continuação local da base 0.1.17, ainda sem publicação ou implantação. O calendário usa o serviço HTTP/SSE e o volume existentes da comunidade. Contas, perfis e armazenamento de imagens permanecem como estão; não há nova autenticação ou segredo no aplicativo.

## Uso e permissões

O ícone de calendário junto ao nome do servidor abre os próximos eventos e os anteriores, com busca e acesso ao formulário de criação. Um evento contém nome, descrição, início e local: um canal de voz ou um endereço informado pelo organizador. Não são criados canais nem iniciadas conexões de áudio automaticamente.

Criar eventos permite criar e administrar os próprios eventos. Gerenciar eventos permite administrar eventos de outras pessoas, sem exigir a hierarquia de expulsão/banimento. Ter apenas Gerenciar eventos não concede a criação. Em canais de voz, ambas as operações exigem Ver canal e Conectar, além da permissão de eventos correspondente, herdada inclusive de categorias. Alterar o local exige autorização no local anterior e no novo.

Eventos de canais ocultos não aparecem na listagem nem revelam seus nomes no registro de auditoria a quem não pode ver o canal. A perda de acesso remove os avisos internos e o evento da interface, inclusive avisos persistidos encontrados após reconectar. A exclusão do canal remove seus eventos associados. Expulsão ou banimento remove a pessoa dos interessados. O ConTALK HQ conserva todos os participantes como coproprietários nesta fase.

## Ciclo de vida

- Eventos em outro local começam e terminam automaticamente nos horários informados. O término é obrigatório nesse caso.
- Eventos de voz podem ser iniciados e encerrados pelo organizador autorizado ou por quem gerencia eventos. Se houver horário de término, um evento de voz já iniciado termina automaticamente nesse horário. Sem término informado, o encerramento é manual; a saída dos participantes da chamada não encerra o evento nesta implementação.
- Um evento de voz que não foi iniciado até uma hora após o horário agendado passa a cancelado.
- Eventos concluídos ou cancelados não podem ser reabertos ou editados. O início e o local de um evento em andamento não podem ser alterados.

Os estados automáticos são calculados pelo relógio do serviço, com avisos SSE nos vencimentos e resultado consistente após reiniciar. Não há gravação a cada segundo. Iniciar, cancelar, encerrar e excluir exigem confirmação separada na interface. Falhas de persistência conservam os dados e a confirmação aberta. Conflitos e perda de permissão preservam o rascunho de edição.

Há até 100 eventos agendados/em andamento e 500 eventos armazenados por servidor. O agendamento permite até um ano de antecedência. O nome aceita até 100 caracteres, a descrição até 1.000 e o local até 100. A remoção definitiva de eventos antigos libera espaço; identificadores excluídos não podem ser reutilizados.

## Interessados e notificações

Cada pessoa marca ou retira seu próprio interesse. O serviço publica o total e o estado da pessoa autenticada, sem distribuir a lista de interessados. Uma restrição temporária impede novas inscrições, mas permite retirar interesse.

Interessados recebem avisos de alteração, início, término e cancelamento pelo sino e, conforme a preferência existente, pelo sistema operacional. Clicar no aviso abre a lista com o evento destacado. A primeira carga não transforma eventos históricos em avisos novos. Avisos já entregues ao sistema operacional não são removidos retroativamente pela limpeza interna.

## Evidências

- `npm run verify`: tipos e 189 testes aprovados, sem falhas ou testes ignorados. Os testes incluem criador versus gerente, autorização nos dois locais, categoria, visibilidade, auditoria, revogação, interessados, restrição temporária, estados automáticos, reinício, falha de gravação e revisões concorrentes.
- `npm run build`: frontend, main e preload aprovados; permanece o aviso conhecido de tamanho de chunk.
- `node tests/run-events-ui-smoke.mjs`: Electron com ponte e HTTP/SSE reais, identidades sintéticas e 17 verificações. Inclui navegação pelo sino, criação permitida apenas em um canal de voz, conflitos, rascunho após revogação, encerramento por moderador, confirmação cancelada, falha de persistência e início/término automático.
- Regressões de interface geral, cargos, moderação, tópicos, convites e mídia com quatro clientes aprovadas.

Logs e capturas estão em `release/events-*`, ignorados pelo Git. Não foram alterados dados da VPS. A referência primária consultada para a separação de permissões e estados foi a [documentação oficial de eventos agendados](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild-scheduled-event.mdx); os limites e o comportamento descritos acima são os efetivamente implementados no ConTALK. Expressões, aplicações, integrações e outras operações ainda indisponíveis do documento de cargos continuam pendentes.
