# Enquetes nos canais de texto

Continuação local sobre 0.1.17, ainda sem publicação ou implantação. A enquete é uma mensagem da comunidade, persistida no mesmo volume, com identidade autenticada, revisões e SSE. Não há serviço novo de contas, mídia ou imagens.

## Criação e apresentação

O ícone de enquete no compositor abre um formulário compacto com pergunta, opções, emojis Unicode opcionais, duração e seleção múltipla. O rascunho de texto/anexo do chat é conservado: publicar a enquete envia uma mensagem separada. Perder a permissão enquanto o formulário está aberto bloqueia a publicação e mantém seu rascunho.

Criar exige Ver canal, Enviar mensagens e `SEND_POLLS`. O modo lento também se aplica. O servidor valida pergunta de até 300 caracteres, 2–10 opções distintas de até 55 caracteres e prazo de 1–768 horas. IDs das opções, prazo e listas de votos são gerados pelo serviço; campos de votos ou encerramento enviados por um cliente não são aceitos como autoridade. Não se combinam enquetes com anexos ou visualização única.

Os limites e a imutabilidade após publicação seguem a [referência técnica oficial de enquetes](https://github.com/discord/discord-api-docs/blob/main/developers/resources/poll.mdx). O formulário informa que os votos são públicos e que pergunta/opções não podem ser editadas depois de publicar. A mensagem ainda pode ser fixada ou apagada pelas operações existentes.

## Votação e direitos

O cartão mostra as opções, contagens, percentuais, escolhas da própria conta, prazo e lista de quem votou. Em seleção múltipla, percentuais são calculados sobre participantes distintos; a soma pode ultrapassar 100%. Cada pessoa aparece uma única vez em cada opção. Salvar substitui apenas a cédula autenticada; trocar de opção ou retirar o próprio voto não altera a cédula de outra conta.

Votar não exige Enviar mensagens nem Criar enquetes: participantes de canais somente leitura também podem votar. É necessário Ver canal, ter acesso à enquete e não estar sob timeout. Com Ler histórico, é possível participar de enquetes anteriores. Sem essa permissão, a autoridade aceita somente enquetes entregues ao vivo na sessão SSE ainda ativa. IDs de enquetes antigas, perdidas ou de outro canal não dão acesso ao conteúdo. A [FAQ oficial](https://support.discord.com/hc/en-us/articles/22163184112407-Polls-FAQ) também descreve a visibilidade pública dos votos e a distinção entre criação e participação.

Quando a sessão de eventos é interrompida, o cliente limpa mensagens recebidas exclusivamente ao vivo nos canais sem histórico. Assim a reconexão não oferece votação em uma enquete que o servidor não consegue autorizar novamente. Canais com histórico autorizado conservam seus dados. Revogação de acesso, timeout, revisão obsoleta e concorrência continuam sendo validados no backend.

## Encerramento e persistência

Somente o criador pode encerrar antes do prazo, com confirmação separada. Outros administradores podem apagar a mensagem se tiverem Gerenciar mensagens; isso não os torna autores da enquete. Cancelar o encerramento mantém a votação aberta. Pergunta e respostas publicadas são imutáveis; votos ficam congelados ao encerrar ou vencer o prazo.

O prazo fica persistido na mensagem. Um índice de vencimentos acorda os clientes conectados quando uma enquete expira; o backend recusa novas cédulas depois do prazo, inclusive após reiniciar. Não depende de o aplicativo do autor continuar aberto. O encerramento antecipado registra responsável/data e auditoria; votos comuns não geram registros administrativos repetitivos. Uma repetição do comando sobre uma enquete já encerrada não inventa outro encerramento na auditoria.

Os cartões usam o relógio informado pela comunidade e um despertar no vencimento, sem atualização contínua de cada enquete. A contagem do modo lento no editor só roda durante a espera. Deltas de cédula também atualizam enquetes antigas já carregadas, preservando autor, texto e fixação. A autoria exibida pode resolver o nome do perfil local/presença, conservando a identidade original e o apelido específico do servidor.

## Evidências e limites

- `tests/community-polls.test.mjs`: HTTP/SSE reais; validação, limites de dez opções/32 dias, permissão de criação, modo lento, dados forjados, imutabilidade, seleção única/múltipla, retirada, concorrência, canal privado, timeout, falta de histórico, entrega ao vivo e fim da sessão, criador, persistência/reinício, exclusão, vencimento e falha de gravação. Também confere fixação com os resultados preservados.
- `tests/community-history.test.mjs`: cédulas aplicadas ao histórico paginado sem apagar autor, pergunta, conteúdo ou fixação.
- `tests/community-runtime.test.mjs`: perda da sessão limpa mensagens exclusivamente ao vivo e conserva histórico autorizado, sem recuperar a enquete antiga ao reconectar.
- `tests/run-moderation-ui-smoke.mjs`: Electron com ponte real, editor/foco, rascunho paralelo, publicação, votos de duas contas, escolha múltipla, retirada, confirmação/cancelamento, vencimento automático, revogação da permissão sem perder o rascunho e voto em canal somente leitura. Capturas `poll-editor.png` e `poll-results.png` em `release/moderation-ui-smoke`.
- Tipos, 171 testes e build aprovados. Regressões de interface geral, cargos, convites e mídia com quatro clientes também passaram. Logs em `release/polls-verify.log` e `release/polls-build.log`.

`SEND_POLLS` está habilitado no catálogo porque existe operação real no serviço e na interface. Esta continuação atende enquetes de canais de texto da comunidade configurada; não adiciona enquetes ao transporte legado ou a mensagens diretas. Tópicos, eventos, expressões, bots, aplicações e integrações continuam em andamento como partes do objetivo integral de cargos. Nenhuma release existente foi sobrescrita e a VPS não foi alterada.
