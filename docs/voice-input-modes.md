# Atividade de voz e Pressionar para falar

Implementação local sobre a base 0.1.17, ainda sem publicação ou implantação. Usa os tickets temporários, a sinalização e o mediasoup existentes; não acrescenta autenticação central, credenciais no aplicativo ou armazenamento de mídia.

## Uso

Clique com o botão direito no próprio perfil e abra Selecionar microfone. O painel Microfone e voz reúne modo de entrada, tecla, dispositivos e teste local, com os detalhes de diagnóstico recolhidos. Mute e áudio recebido continuam no card do usuário e na bandeja.

A preferência inicial é Atividade de voz. Pressionar para falar usa F8 inicialmente; é possível escolher F6 a F24, Ctrl direito ou 0 do teclado numérico. Modo e tecla ficam nas preferências locais de cada conta. Alterar o modo durante uma chamada silencia o microfone e pede que a pessoa o reative no próprio card.

O card mostra a tecla para falar, o preparo do atalho ou a indicação de que o atalho depende da janela ativa. O Windows possui um componente global, funcionando também com a janela oculta. Se esse componente não estiver disponível, o aplicativo informa a limitação e oferece o atalho enquanto sua janela estiver ativa. O modo local é liberado ao perder o foco.

## Permissões e transmissão

Atividade de voz controla o uso do modo automático. Sua negação em um canal força Pressionar para falar nessa sala, sem sobrescrever a preferência da conta para outras salas. A restauração da permissão retoma a preferência, conservando o microfone silenciado. As regras de canal, categoria, Conectar, Falar, timeout e moderação continuam valendo. A copropriedade do ConTALK HQ permanece preservada.

No modo automático, permanecem o tratamento de entrada e o Opus com DTX existentes. No modo de tecla, o dispositivo pode permanecer aberto para resposta rápida, com a faixa desabilitada e a publicação pausada enquanto a tecla estiver solta. O desktop observa a tecla; o serviço autoriza a publicação e controla o prazo dessa autorização.

Ao soltar a tecla, o áudio local é cortado antes de aguardar resposta da rede. O serviço recebe confirmações enquanto ela estiver pressionada, a cada 400 ms, e pausa a publicação se não houver renovação em 1,8 segundo. Publicar diretamente ou tentar retomar a publicação sem a autorização correspondente é recusado no mediasoup. Mute, áudio desligado e bloqueios do servidor impedem a transmissão por tecla.

Reconectar ou reativar o atalho com a tecla já pressionada exige soltá-la antes de transmitir novamente. Trocar o dispositivo conserva a intenção de mute e aguarda a tecla; remover um bloqueio do servidor não abre o microfone automaticamente. A animação da bandeja acompanha a publicação efetivamente habilitada, sem aguardar o medidor de nível sonoro.

As confirmações de voz consultam apenas a política atual, os canais e os apelidos necessários à mídia. Elas não copiam o histórico de mensagens, convites ou auditoria a cada renovação.

## Componente Windows

O programa em `native/voice-input/Program.cs` consulta somente a tecla escolhida, com intervalo nominal de 8 ms, sujeito ao agendamento do Windows. Não intercepta digitação nem mantém um registro das teclas. Ele encerra quando o processo proprietário fecha sua entrada. O Electron o inicia sem janela e o interrompe ao fechar ou recarregar a página; mensagens antigas de outra configuração são ignoradas.

`npm run build:voice-input` compila o componente com o compilador do .NET Framework 4 do Windows. O instalador inclui o executável em `resources/voice-input`. O comando `build:electron` e o workflow de release compilam esse recurso antes do empacotamento. O componente de captura de áudio existente continua separado.

O comportamento das teclas foi conferido na [API oficial do Windows](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate); a organização dos dois modos segue a [referência de modos de voz do Discord](https://support.discord.com/hc/en-us/articles/211376518-Voice-Input-Modes-101-Push-to-Talk-Voice-Activated). Não há promessa de latência física nula: pressionar envolve captura, IPC e autorização de rede; soltar não acrescenta uma espera artificial ao corte local.

## Validação

- Tipos, 206 testes e build de frontend/main/preload aprovados (`release/voice-input-verify.log`, `release/voice-input-build.log`). O componente nativo também compilou. Permanece o aviso conhecido de tamanho de chunk.
- Testes do Windows verificam tecla inicialmente pressionada, renovações, liberação e encerramento por fechamento da entrada. A sonda confirma que o desktop permite observar a tecla sintética antes do teste; runners sem desktop utilizável indicam esse caso como ignorado. Na validação local, não houve testes ignorados.
- `run-voice-input-media-smoke.mjs`: dois clientes Electron com worker mediasoup e áudio sintético. Confere RTP enquanto a tecla está pressionada, parada ao soltar, renovação, vencimento, negação de pedidos diretos, revogação de Atividade de voz e moderação.
- `run-voice-input-ui-smoke.mjs`: 17 verificações com ponte, componente global, HTTP/SSE e mídia reais. Confere a janela oculta, perfil, preferências por conta, bandeja, mute/deafen, reconexão, modo exigido e troca de dispositivo.
- Regressões de interface geral, editor de cargos, moderação, voz com quatro clientes, status, eventos, tópicos e convites aprovadas nesta continuação.
- `run-update-live-smoke.mjs`: instalou e atualizou duas versões de teste, 1.0.0 e 1.0.1, com identificador, diretório e perfil próprios. O componente de tecla carregou nas duas instalações e a aplicação reabriu sem erro de execução. A limpeza temporária passou a tolerar o encerramento assíncrono do desinstalador do Windows.

Esses testes não usam contas, microfones ou dados da comunidade de produção. Prioridade de fala foi implementada separadamente no [módulo de prioridade](priority-speaker.md). As demais operações indisponíveis do catálogo continuam pendentes. O conjunto completo do documento de cargos ainda não está concluído.
