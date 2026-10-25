# ConTALK 0.1.18

- Interface compacta, escala de 80% a 120%, atalhos na barra de título e controles de voz concentrados no card do usuário.
- Notificações de atividade, contagem de mensagens não lidas, atualizações em tempo real e controles de áudio na bandeja.
- Moderação de membros e voz, banimentos, convites, apelidos, configurações do servidor e estatísticas do histórico autorizado.
- Reações, mensagens fixadas, modo lento, enquetes, tópicos públicos/privados e eventos agendados.
- Atividade de voz, Pressionar para falar com atalho global no Windows e prioridade de fala.
- Leitura de mensagens com vozes locais do Windows, desativada por padrão, e mensagens de voz gravadas com prévia antes do envio.
- Emojis, figurinhas e sons personalizados no armazenamento configurado, com permissões para uso externo e administração.
- Integrações por webhook com chave individual, identificação própria, renovação, limites e revogação.
- Modo de palco e plateia nos canais de voz: pedido de fala, convite, aceite, moderação e retorno à plateia. Entrar ou aceitar convite mantém o microfone silenciado até ativação explícita.

Os recursos novos da comunidade exigem que o serviço da VPS também use o código desta versão. O instalador não configura nem implanta a VPS ou o Telegram automaticamente. Preserve o volume existente ao atualizar pelo Coolify.

A comunicação continua usando mediasoup/coturn e tickets temporários. Contas e perfis continuam locais. Anexos, gravações e expressões dependem do serviço de arquivos configurado; a atualização não cria armazenamento central de imagens ou autenticação central.

O ConTALK HQ mantém todos os membros conhecidos como coproprietários nesta fase. Aplicativos, comandos, atividades e cargos gerenciados/vinculados continuam reservados para a próxima implementação. Assinaturas, impulsionamentos e monetização permanecem indisponíveis por decisão do usuário.

Validação local: tipos, 262 testes sem falhas ou casos ignorados e build do cliente/Electron. Integrações Electron exercitam interface, HTTP/SSE, sinalização, captura sintética, worker mediasoup, áudio local e atualização de instalações isoladas. Testes com microfones físicos, WASAPI e participantes em redes independentes não foram repetidos nesta entrega.
