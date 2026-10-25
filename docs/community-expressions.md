# Emojis e figurinhas personalizados

Implementação local sobre 0.1.17, ainda sem publicação. O ícone de expressões no compositor abre emojis e figurinhas, escolha do servidor de origem e administração dos recursos do servidor atual. A seleção cria um rascunho; Enviar publica a imagem e o texto opcional. Prévia estática: emoji compacto e figurinha maior. Não há exigência de assinatura nem cobrança.

## Criação e uso

Criar expressões autoriza criar, renomear e excluir os próprios recursos. Gerenciar expressões autoriza renomear/excluir os de outros membros e não concede criação sozinho. Esses limites seguem a [referência oficial de emojis](https://github.com/discord/discord-api-docs/blob/main/developers/resources/emoji.mdx) e a [definição das permissões](https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx). A biblioteca permite 100 emojis e 100 figurinhas, sem depender de benefícios pagos.

As imagens usam o armazenamento já configurado: PNG, JPEG, GIF ou WebP, até 1 MB. O original permanece no serviço de arquivos; a comunidade guarda referência autorizada e uma prévia JPEG estática de até 12.000 caracteres em base64. O aplicativo reduz a prévia recebida do Windows antes do cadastro. Não cria automaticamente conta ou canal Telegram, nem presume armazenamento de perfis/imagens na VPS.

Uma pessoa pode consultar bibliotecas dos servidores dos quais é membro. Para enviar do servidor atual, precisa de Ver canal e Enviar mensagens; para usar outro servidor, exige também Usar emojis externos ou Usar figurinhas externas, conforme o tipo, além da associação atual ao servidor de origem. Anexar arquivos e Gerar prévias não controlam a imagem escolhida como conteúdo da expressão. Tópicos, modo lento, timeout e regras de categoria continuam aplicáveis.

O serviço resolve a referência para o recurso registrado, valida a autorização do arquivo e conserva sua origem. Não aceita metadados de imagem falsificados pelo remetente. Uma expressão não se combina com anexo, TTS, enquete, gravação ou visualização única. Mensagens já enviadas conservam nome e imagem ao renomear/excluir o recurso; excluir não permite reutilizar o identificador para trocar conteúdo antigo.

## Segurança e operação

Bibliotecas são consultadas sob demanda; imagens não são adicionadas a cada snapshot geral da comunidade. Uma revisão específica invalida o painel quando os recursos locais mudam. Trocar de conversa ou de conta e perder acesso encerra o painel; o histórico central continua em memória, sem expor imagens de outra conta no cache legado. O arquivo registrado fica acessível aos membros da biblioteca ou aos destinatários autorizados de mensagens que o referenciam, seguindo o controle existente de arquivos.

A criação conserva nome e imagem após falha de persistência e reaproveita o upload ao tentar novamente. Alterações com versão antiga dão conflito e pedem carregar a expressão atual; a exclusão tem confirmação separada. A autorização é verificada no serviço, independentemente dos botões.

## Validação

Sete testes HTTP cobrem criação/manutenção própria, administração de terceiros, arquivos, metadados, duplicidade, limites independentes, uso interno/externo, associação à origem, persistência, conflitos, exclusão, falha de disco e autorização de download. run-expressions-ui-smoke.mjs passou 14 verificações com Electron e ponte reais, seleção de arquivo PNG, redução de prévia Windows, upload e serviços locais de comunidade/arquivos: criação, erro e repetição, emoji/figurinha no chat, permissão externa ao vivo, renomeação, confirmação de exclusão, conservação de mensagens e navegação. O seletor de arquivos do teste retorna uma imagem sintética da pasta de teste; nenhum arquivo pessoal é enviado.
