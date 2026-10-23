# ContalK 0.1.5

Correção da conexão de voz e da presença.

- Corrigida a permissão canUpdateOwnMetadata nos tokens do Electron, navegador, servidor local e Tauri. Essa permissão permite atualizar o próprio nome/perfil, sem conceder administração da sala.
- Falhas ao sincronizar a foto/perfil não interrompem a chamada nem a presença; são mostradas como avisos separados.
- Tentativas de conexão que falham são encerradas explicitamente. Trocas rápidas de canal e cliques repetidos não deixam conexões anteriores alterarem a sala atual.
- Falhas de consulta não mantêm listas antigas de ocupantes indefinidamente. O canal permanece selecionado para permitir tentar novamente.

Feche as instâncias antigas do ContalK e reabra a versão atualizada para encerrar conexões deixadas abertas pelas versões anteriores.

Validado com testes de regressão e conexão real ao LiveKit em sala temporária, com confirmação de atualização de nome/metadados, envio de dados, publicação de uma faixa silenciosa gerada para teste e encerramento da conexão. O teste não captura microfone nem câmera.
