# Leitura em voz

Implementação local sobre 0.1.17, ainda sem publicação. A permissão Enviar mensagens com leitura em voz autoriza marcar texto do canal como TTS; Enviar mensagens, modo lento, timeout e acesso ao canal continuam obrigatórios. TTS não aceita anexos, enquetes ou visualização única. A marca fica no histórico da comunidade, sem guardar áudio.

Cada pessoa decide se deseja ouvir novas mensagens TTS do canal aberto. A opção começa desativada e fica nas preferências locais por conta, junto de voz e volume. Microfone e voz → Leitura em voz consulta as vozes realmente instaladas no Windows. Também é possível ler uma mensagem comum pelo seu botão de alto-falante e interrompê-la no mesmo lugar.

O componente Windows usa System.Speech para sintetizar texto simples em WAV na memória, sem serviço externo, SSML ou arquivo temporário. O texto segue por entrada privada do processo; não aparece nos argumentos. O Electron aceita somente o frame principal confiável, limita duração e tamanho, cancela ao recarregar e encerra o processo quando necessário. A saída de áudio escolhida é aplicada antes da reprodução; falha de dispositivo não desvia o som para outra saída.

Silenciar a saída no card ou na bandeja também funciona fora de uma chamada. Para a leitura, descarta áudio e fila; reativar não repete mensagens. Trocar de canal, conta, servidor, perder a conexão, o acesso ou o histórico também cancela. A reprodução consulta novamente a mensagem autenticada e atual antes de sintetizar, incluindo leitura ao vivo sem histórico somente quando o serviço comprovou a entrega nessa sessão. Mensagens de visualização única não são expostas nesse endpoint. Edições e exclusões interrompem uma leitura em andamento. Nenhuma mensagem antiga é anunciada ao abrir o canal ou ativar a opção.

## Validação

Os testes de serviço cobrem permissão, combinações, timeout, modo lento e consulta autenticada de mensagens. Os de execução cobrem vozes reais instaladas, WAV real em memória, validação de IPC, cancelamento, descarte de respostas tardias, mudança de saída e preferências por conta.

O teste Electron run-speech-ui-smoke.mjs passou 15 verificações com interface, ponte, HTTP/SSE e sintetizador Windows reais: envio e persistência, voz instalada, volume e saída, leitura automática optativa e manual, mute pela bandeja sem chamada, revogação de histórico, entrega ao vivo, troca de conversa e isolamento de conta. A janela de teste teve sua saída física silenciada.
