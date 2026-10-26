# IA compartilhada e projetos privados

## Uso

Um gestor configura o identificador do modelo OpenAI nas configurações de um canal de texto. Isso ativa **Enviar à IA** no compositor. Cada pessoa informa sua própria chave em **Configurações → Inteligência artificial**; ela fica criptografada pelo armazenamento seguro do Electron para a conta local. O compositor permite ajustar os limites de contexto (1.024–32.768 tokens) e saída (128–8.192 tokens) antes de cada pedido. Desligar **Enviar à IA** envia apenas aos colegas.

O botão **Criar projeto** do canal cria um subchat privado. O criador e os delegados convidam leitores, colaboradores ou outros delegados. Leitores veem todo o histórico, colaboradores também escrevem e chamam a IA. A copropriedade do ConTALK HQ não abre projetos privados. O projeto herda o modelo do canal, mas um delegado pode escolher outro. Quem não tem acesso ao canal principal não pode participar. Sem criador ou delegado autenticável, o projeto fica arquivado e somente leitura. Um gestor que volte pode restaurá-lo explicitamente nas configurações do projeto; isso não concede acesso a outras pessoas.

Anexos para a IA são escolhidos pelo seletor do aplicativo. O tamanho total por pedido é 50 MB. PDF e imagens seguem para o modelo como arquivo e imagem. Textos, código, CSV/TSV e documentos modernos (`.docx`, `.odt`, `.pptx`, `.xlsx`) são convertidos em texto na VPS para que o limite de contexto possa ser conferido antes da geração. Arquivos `.xlsx` usam até as primeiras 1.000 linhas por aba. Formatos binários antigos como `.doc`, `.xls` e `.ppt`, arquivos sem texto legível e formatos desconhecidos são recusados com aviso; converta-os para PDF ou um formato moderno. O serviço verifica também os bytes de PDF, PNG, JPEG, GIF e WebP. O histórico conserva apenas nome, tipo e tamanho. Para reutilizar um anexo, selecione-o novamente. Anexos de mensagens entre pessoas continuam usando o armazenamento normal do chat.

## Serviço e dados

Implante a mesma revisão de `scripts/community/service.mjs` na VPS antes de distribuir um cliente que use IA. O serviço existente da comunidade persiste configuração de canais, lista de acesso dos projetos, mensagens, resumos de contexto, estado e uso das execuções no volume existente. Nenhum novo volume ou variável de ambiente é necessário. A VPS precisa ter saída HTTPS para `api.openai.com`. O acesso público à comunidade continua protegido pelo proxy HTTPS e por chaves individuais.

O Electron envia a chave OpenAI ao serviço somente no POST autenticado da execução. O serviço usa a chave em memória para contagem, resumo e geração, sem a incluir em mensagens, eventos ou dados persistidos. O serviço envia à Responses API `store: false`; resume mensagens antigas e envia as recentes para manter o contexto no ConTALK. A resposta parcial circula por SSE filtrado pela lista de acesso. Ao concluir, o serviço grava o texto e o consumo real. Se o autor fechar o aplicativo, a execução continua na VPS. Se o serviço reiniciar, as execuções em andamento são marcadas como interrompidas e podem ser refeitas pelo usuário.

Falhas de autenticação, acesso ao modelo, limite, formato de anexo e interrupção aparecem no histórico com estado de falha ou cancelamento; saída parcial não aparece como resposta concluída. Há apenas uma execução ativa por conversa; até três pedidos adicionais ficam na fila e podem ser retirados antes de começar. O usuário pode tentar novamente após uma falha, anexando os arquivos de novo. A chave pode ser removida nas configurações da conta local.

## Limite desta entrega

Não há execução de comandos, alteração de arquivos, MCP, conectores de outros provedores nem cobrança. O executor futuro precisará pedir aprovação explícita para cada ação que altere arquivos ou serviços externos.
