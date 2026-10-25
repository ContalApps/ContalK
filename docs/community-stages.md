# Palco e plateia

Entrega 0.1.18. Configurações do canal de voz → Modo do canal permite alternar conversa livre e palco, com confirmação separada. O modo de palco exige Ver canal e Gerenciar canais. Converter uma chamada ativa para palco interrompe microfone, câmera e compartilhamento; todos passam à plateia. A capacidade atual da sala continua a da comunicação existente, até quatro participantes; não foi introduzido um serviço de eventos de grande público.

O controle de participação fica no card do usuário. Pedir fala exige sessão real na chamada, permissão específica, Conectar e Falar, sem bloqueio de moderação. É possível cancelar o próprio pedido mesmo depois de perder a permissão. Moderar palco exige, naquele canal, Gerenciar canais, Silenciar membros e Mover membros, seguindo a [referência oficial de palco](https://support.discord.com/hc/en-us/articles/1500005513722-Stage-Channels-FAQ). O painel mostra fila e participantes; moderadores podem convidar, recusar e mover pessoas para a plateia. A hierarquia de banimento não é aplicada às operações de voz.

Todos entram como plateia, inclusive moderadores e coproprietários. Moderadores podem subir explicitamente; demais pessoas precisam aceitar um convite válido. Convites duram um minuto e pertencem à sessão de voz que os recebeu. Aceitar convite ou subir mantém o microfone silenciado; a ativação é feita no botão de microfone. Voltar à plateia encerra a captura e as publicações. Câmera, tela e sons também são bloqueados para a plateia pelo serviço.

Cada autorização de palco é vinculada a um identificador interno da sessão WebSocket. Reconectar não recupera uma autorização antiga nem publica automaticamente o microfone. Esses identificadores e as listas internas não são expostos nos snapshots da comunidade. A sinalização envia a fila completa somente aos moderadores; cada pessoa comum vê apenas seu pedido e seu convite. O aceite não pode ser feito em nome de outra pessoa. Os dados persistem atomicamente no volume existente; falha de disco não confirma participação ou convite.

O ConTALK HQ conserva a copropriedade de todos os membros conhecidos; ninguém é escolhido como proprietário exclusivo. Gerenciar cargos e permissões continua independente da posição atual de palco/plateia.

## Validação

Cinco testes HTTP/WebSocket cobrem conversão, permissões, privacidade, convite/aceite, autorização ligada à sessão, reconexão, moderação, copropriedade, expiração e falha de disco. run-stages-ui-smoke.mjs passou 17 verificações com Electron, ponte, HTTP/SSE, worker mediasoup e microfone sintético reais: confirmação de modo, corte da captura, plateia, seleção de entrada sem captura, pedido privado, convite, aceite sem abertura automática, publicação explícita, retorno à plateia, revogação, moderação, reconexão e volta à conversa livre sem reativar o microfone.
