# Convites e readmissão

Implementação local na `dev/caliari`, sobre a arquitetura de comunidade e mídia da 0.1.17. Ainda não publicada nem implantada na VPS.

## Experiência no aplicativo

A engrenagem do servidor dá acesso à aba Convites quando a pessoa pode criar convites em um canal visível ou administrar algum convite existente. O formulário permite escolher canal, prazo e limite de usos. O link pode ser copiado novamente da lista; a revogação requer uma confirmação separada e não remove quem já entrou.

O botão compacto Entrar em um servidor, no trilho lateral, recebe um código ou link. O mesmo fluxo fica em Configurações → Comunidade → Usar convite. A pessoa confere o nome do servidor e confirma a entrada. Abrir a prévia não consome um uso nem concede participação. Uma chamada anterior é encerrada ao confirmar, conforme informado no painel.

O serviço de comunidade precisa estar configurado com endereço e chave individual correspondentes à conta local. O convite não cria conta central, não substitui uma chave individual e não provisiona uma identidade desconhecida. Links de outro domínio, com credenciais embutidas, query string ou fragmento são recusados antes de uma requisição de convite.

Um link `/invite/<código>` também abre uma página simples no navegador com o nome do servidor e a orientação de uso no ConTALK. Essa página não mostra membros, canais, cargos ou histórico e não aceita a entrada por si só. Conteúdo de nomes é escapado e a página não carrega recursos externos.

## Autoridade e limites

O serviço gera códigos aleatórios de 24 bytes. Criar exige Visualizar canal e Criar convite, avaliados no canal escolhido. Os limites são de até sete dias ou sem expiração, de um a cem usos ou sem limite e cem convites ativos por servidor. O catálogo habilita Criar convite porque a operação passa a existir.

Apenas o criador ou alguém com gerenciamento de servidor/canal aplicável recebe o código na lista e pode revogá-lo. Perder a capacidade de criar novos convites não impede o criador de revogar um convite próprio. Remover o criador do servidor ou excluir o canal invalida os convites correspondentes.

O aceite é autenticado e serializado junto com os demais comandos. Dois pedidos simultâneos para o último uso não conseguem exceder o limite. Um membro atual não gasta um uso para abrir seu próprio servidor; repetir o aceite já concluído da mesma identidade não duplica participação nem consumo. Expiração, revogação, esgotamento e banimento são conferidos novamente antes de uma nova entrada, independentemente da prévia. Falha de persistência não concede participação nem consome o uso.

Essa distinção acompanha o estudo fornecido e os recursos documentados de [convite por canal](https://docs.discord.com/developers/resources/channel#create-channel-invite) e [convites](https://docs.discord.com/developers/resources/invite), sem copiar a autenticação central de contas do Discord.

## Retorno após moderação

Uma pessoa expulsa pode aceitar outro convite válido. Uma identidade banida continua bloqueada, mesmo com o código. Remover um banimento não readmite automaticamente: a pessoa precisa aceitar um convite válido depois.

Uma entrada nova recebe a política padrão do servidor. Os cargos antigos, timeouts e exceções individuais não são restaurados. Convites não atribuem cargos nem abrem canais privados por conta própria. No HQ, a política explícita continua tornando os participantes coproprietários; essa condição é independente dos cargos visuais e não foi alterada.

O volume existente conserva convites, contadores e registros de entrada. A revisão e a auditoria são atualizadas. Para novas entradas por convite, o serviço registra data, origem, responsável e uma referência hash do convite, visíveis na revisão do membro quando o observador pode administrar cargos ou ler a auditoria. A referência permite relacionar entradas sem incluir o código de aceite no registro do membro. Datas antigas e idade da conta local não são inventadas.

## Cliente e sincronização

O aceite passa pela ponte Electron validada, usando a chave cifrada já configurada. A identidade não vem do corpo do pedido. A configuração é retida ao trocar de servidor na mesma comunidade; o cliente acompanha o SSE do servidor selecionado. Depois de uma readmissão, o estado de acesso revogado pode ser substituído por uma nova assinatura autenticada. Canais e histórico centrais continuam excluídos do cache compartilhado legado.

Os tickets de reconexão de mídia conservam o identificador do servidor da chamada, em vez de usar o servidor posteriormente selecionado na navegação. A implantação não muda portas, TURN, contas/perfis locais, imagens ou o volume de produção.

## Validação

- `tests/community-invites.test.mjs`: permissões e visibilidade de códigos; prévia sem canais privados; disputa pelo último uso; expulsão/banimento/readmissão; prazo; revogação; exclusão de canal; remoção do criador; persistência e falha de gravação; página pública e entrada restrita ao domínio configurado.
- `tests/role-revocation.test.mjs`: troca de servidor preserva a configuração e limpa o retrato anterior; respostas anteriores à revogação não restabelecem acesso.
- `tests/community-voice-binding.test.mjs`: ticket de reconexão mantém o servidor original após mudança de navegação.
- `tests/run-invites-ui-smoke.mjs`: Electron e ponte real com HTTP/SSE. Criação, confirmação/cancelamento de revogação, prévia, retorno após expulsão, ausência dos cargos/exceções antigos, troca de servidor, cache, conta local e bloqueio/readmissão após banimento.

Resultados e capturas sintéticos ficam em `release/invites-ui-smoke`, ignorados pelo Git. Não foram usados códigos ou contas de produção.

O objetivo completo de cargos permanece em andamento: moderação de voz de terceiros, demais operações de servidor/canal e os módulos de tópicos, eventos, bots e integrações ainda não estão todos implementados. Suas permissões permanecem desabilitadas até existir aplicação real no serviço e no cliente.
