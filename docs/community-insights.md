# Estatísticas da comunidade

Implementação local, ainda sem publicação ou implantação. Ver estatísticas do servidor controla uma consulta autenticada em `/servers/:id/insights`, acessível na aba Estatísticas das configurações do servidor. Essa permissão não concede Gerenciar servidor, Gerenciar cargos, Ver canais ou Ler histórico.

O painel mostra membros atuais, canais visíveis, mensagens e autores do período, reações atuais nas mensagens do período, enquetes e fixações visíveis. Há contagens diárias e canais mais movimentados em 7 ou 30 dias. Os dias seguem o fuso do usuário, incluindo mudanças de horário de verão. Apenas canais com visualização e histórico autorizados participam das contagens de mensagens; tópicos privados continuam sujeitos ao acesso correspondente. Não são devolvidos conteúdos de mensagens nem listas de autores.

As contagens correspondem aos dados centrais atualmente armazenados. Mensagens apagadas e histórico que continua somente em outro dispositivo não entram no resultado. As reações refletem o estado atual das mensagens do período, sem inventar uma cronologia de reações. Sem histórico autorizado, o painel indica essa condição e não apresenta um gráfico fictício de zeros.

Entradas por convite registradas são contadas somente entre os membros atuais com registros disponíveis. O painel informa quantos membros não possuem data de entrada conhecida; não supõe datas de criação das contas locais. Não há números financeiros, de assinaturas ou impulsionamentos nesta função, conforme a decisão do usuário de manter monetização indisponível.

A consulta é feita ao abrir o painel, alterar o período, mudar o acesso ou pedir atualização. Não é recalculada em cada mensagem do SSE. Revogar a permissão ou alterar o conjunto de canais acessíveis limpa os dados e invalida respostas antigas, inclusive requisições que já estavam em andamento. A consulta não altera a revisão nem grava dados no volume.

Tipos, 214 testes e build aprovados. Testes HTTP cobrem autorização, privacidade, datas, repetição de horas em mudanças de fuso, contagens e revogação. `run-insights-ui-smoke.mjs` valida a ponte Electron e HTTP/SSE reais em 11 verificações: períodos, escopo privado, entrada direta para membro com somente essa permissão, contagens, revogação, resposta atrasada e perda do histórico. Logs e capturas ficam em `release/insights-*`.
