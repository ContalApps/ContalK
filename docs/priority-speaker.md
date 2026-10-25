# Prioridade de fala

Implementação local, ainda sem publicação ou implantação. Nas configurações de Microfone e voz, Pressionar para falar oferece a opção Prioridade de fala. A opção e a tecla ficam nas preferências da conta. Alterar essa opção durante a chamada silencia o microfone até a pessoa reativá-lo.

O serviço verifica a permissão Prioridade de fala no canal/categoria, junto de Conectar, Falar e dos bloqueios de voz. O recurso depende da tecla pressionada e de uma publicação de microfone habilitada. Metadados de perfil não concedem prioridade. A copropriedade do HQ permanece preservada.

Enquanto houver uma pessoa com prioridade, as outras vozes são reproduzidas a 25% do volume pessoal escolhido pelo ouvinte. Os volumes salvos não são alterados; editar um volume durante a prioridade conserva essa preferência. Áudio das telas permanece no nível escolhido. Mute/deafen prevalecem e a saída da prioridade restaura os níveis exatos. Mais de uma pessoa pode ter prioridade, sem acumular reduções sobre as demais.

Soltar a tecla, vencer a renovação, fechar o microfone, perder a permissão, desconectar ou receber bloqueio de voz remove a prioridade. Perder somente a permissão de prioridade permite continuar falando normalmente. O serviço comunica os participantes efetivamente autorizados aos clientes; a interface exibe um SVG discreto na lista de voz. Atualizações repetidas da mesma lista não são retransmitidas a cada renovação.

Tipos, 209 testes e build aprovados. O teste `run-priority-voice-smoke.mjs` usa três clientes Electron, os stores reais da aplicação, mídia sintética e worker mediasoup. Verifica RTP recebido, ganho Web Audio, volumes pessoais, áudio de tela, deafen, revogação, pedidos sem permissão, liberação e mute do servidor. O teste de interface de voz também cobre a opção, seu efeito no mute, indicação visual, liberação e persistência por conta. Artefatos ficam em `release/priority-voice-*` e `release/voice-input-ui-smoke`.

A relação entre prioridade, cargos/canais e Pressionar para falar foi conferida na [referência oficial do Discord](https://support.discord.com/hc/pl/articles/360011876531-Setting-up-Priority-Speaker). A intensidade de redução descrita acima é a implementada no ConTALK.
