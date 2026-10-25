# Painel de sons

Implementação local sobre 0.1.17, sem publicação ou implantação. O botão Sons fica junto aos controles compactos do card do usuário na chamada. Emojis e figurinhas → Painel de sons também permite administrar a biblioteca sem entrar em uma chamada. Volume local por conta começa em 50%, com opção de parar o som apenas neste dispositivo.

## Biblioteca e autorização

Criar expressões permite cadastrar, renomear e excluir os próprios sons. Gerenciar expressões permite manter os de outros membros. Há até 100 sons por servidor. O cadastro recebe áudio Opus WebM de 0,1 a 5 segundos e até 1 MB, usando o armazenamento já configurado. O aplicativo lê somente a seleção autorizada pelo Electron, decodifica o áudio para conferir a duração e oferece prévia antes de cadastrar. Não aceita um caminho arbitrário vindo do renderer. Falhar ao persistir conserva o rascunho e reutiliza o upload.

Reproduzir exige sessão WebSocket real naquele canal, Ver canal, Conectar, Falar e Usar painel de sons. Bloqueios de microfone/recepção do servidor e timeout impedem o envio. O mute pessoal de microfone não impede uma reprodução intencional pelo botão de sons. Um recurso de outro servidor exige também Usar sons externos e associação atual à origem. A autorização e os limites ficam no serviço: intervalo de três segundos por sessão emissora e de meio segundo por sala.

## Reprodução

O comando passa pela sinalização autenticada da comunicação existente. O serviço envia uma referência registrada a quem já está naquela chamada e pode receber áudio, incluindo o emissor. Cada cliente baixa o arquivo com sua autorização individual e o reproduz localmente, sem novo produtor de microfone nem serviço de mídia externo. O início depende do download de cada participante; não há promessa de sincronização exata.

Quem recebe som externo ganha apenas acesso temporário àquele arquivo durante a reprodução: até 15 segundos para a entrega, ligado à sessão presente no momento do comando. Outra sala, alguém que entre depois ou uma reconexão não recebem essa autorização. A origem da expressão e as permissões atuais continuam sendo conferidas. Nenhum histórico de sons é acrescentado ao chat, aos perfis ou ao volume de mensagens.

O cliente aplica a saída escolhida antes de tocar, combina o volume do painel com o volume pessoal do emissor e limita a reprodução a cinco segundos. Não altera volumes salvos, microfone ou áudio de tela. Desativar a saída, trocar de dispositivo/conta/chamada ou zerar o volume interrompe o som; reativar não repete. Mensagens antigas ou duplicadas da sinalização não são reproduzidas. A contagem local de tempo usa relógio monotônico, sem depender de o relógio do usuário estar igual ao da VPS.

Excluir a origem, remover associação ou revogar autorização do emissor cancela a reprodução para os destinatários. Sair da chamada também encerra o acesso temporário. Renomeação e exclusão usam a versão do recurso, conservam rascunhos em conflitos e exigem confirmação própria para excluir. O controle de arquivos existente valida novamente o acesso ao servir o download.

## Validação

Cinco testes de HTTP/WebSocket cobrem formato, duração, autorização, destinatários atuais, uso externo, limite, bloqueio de áudio, revogação, exclusão, expiração, saída/reconexão e autorização HTTP de arquivos. Quatro testes do controlador cobrem pacote, relógio, volume, saída antes do playback, descarte de respostas tardias, cancelamento e ausência de repetição. Há testes de preferências e de IPC da seleção de áudio.

run-soundboard-ui-smoke.mjs passou 19 verificações: gravação Opus sintética, seleção real pelo Electron, leitura autorizada, decodificação e prévia, erro de disco e repetição sem novo upload, biblioteca fora de chamada, chamada com worker mediasoup e microfone sintético, reprodução real de WebM, volume e saída, mute, revogação, sons externos, renomeação, exclusão e saída. Um segundo participante WebSocket autenticado recebe o comando e o cancelamento. A saída física da janela de teste fica silenciada; nenhum microfone ou conta pessoal participa.
