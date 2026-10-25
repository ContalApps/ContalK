# Mensagens de voz

Implementação local sobre 0.1.17, ainda sem publicação ou implantação. O botão discreto de microfone no compositor abre uma gravação separada da chamada. Ela usa o microfone selecionado, tratamento mono e proteção contra entradas de loopback. Parar permite ouvir a prévia, descartar, gravar novamente ou enviar explicitamente. Limites: um minuto, Opus em WebM e 1 MB. Não há envio automático ao atingir o limite.

Enviar mensagens de voz possui permissão própria, além de Ver canal e Enviar mensagens; não depende de Anexar arquivos. Modo lento, timeout, tópicos e regras de categoria continuam aplicáveis. A semântica da permissão segue a [referência oficial de mensagens de voz](https://discord.com/blog/discord-voice-messages). O serviço exige duração válida, codec e arquivo autorizado; não aceita texto, enquete, TTS ou visualização única nessa modalidade. Gravações publicadas podem ser apagadas, mas não editadas.

O áudio usa o armazenamento de arquivos já configurado, com sua autorização atual. A VPS da comunidade guarda a mensagem e sua referência; esta implementação não configura Telegram automaticamente nem introduz armazenamento central de imagens. Sem serviço de arquivos configurado, a gravação informa a necessidade de configurá-lo pelo botão de anexar. Falha ao persistir a mensagem conserva a prévia e permite tentar novamente sem novo upload.

A reprodução exige clique e consulta autenticada da mensagem atual antes do download autorizado. O Electron entrega bytes limitados de WebM ao renderer, sem expor credenciais ou links assinados. A saída escolhida é aplicada antes de tocar. Silenciar globalmente, trocar de dispositivo, conversa ou conta, perder conexão, acesso ou histórico interrompe e descarta o áudio. Reativar a saída não repete a mensagem. Navegar ou perder permissão durante uma gravação encerra as faixas do microfone sem enviar o rascunho.

## Validação

Tipos e 233 testes passaram, sem casos ignorados. Quatro testes HTTP cobrem permissões, referências de arquivo, duração, combinações inválidas, imutabilidade, limite, timeout, modo lento e persistência. Três testes de IPC cobrem origem, credenciais, redirecionamentos, conteúdo inválido, tamanho declarado/real e troca de conta.

run-voice-message-ui-smoke.mjs passou 13 verificações com interface Electron, MediaRecorder e áudio WebM reais, microfone sintético e serviços locais de comunidade/arquivos. Conferiu prévia, falha de disco, repetição sem novo upload, reprodução, mute, revogação e navegação. As duas últimas verificações conferem também que as faixas de captura terminaram. O teste usa um backend de arquivos em memória, sem Telegram ou contas de produção.
