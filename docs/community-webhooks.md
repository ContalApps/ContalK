# Integrações por webhook

Implementação local sobre 0.1.17, sem publicação ou implantação. Configurações de um canal de texto → Integrações por webhook permite criar, renomear, renovar a chave e excluir integrações. Exige Ver canal e Gerenciar webhooks naquele canal, inclusive regras de categoria. Há até 10 por canal e 50 por servidor. Tópicos não recebem webhooks próprios.

## Envio externo

A interface informa o endereço /hooks/SERVIDOR/INTEGRACAO e oferece a chave apenas ao criar ou renovar. O serviço externo faz POST com Authorization: Bearer CHAVE e JSON com content (texto de até 2000 caracteres) e nonce (identificador único com letras, números, dois-pontos, hífen ou sublinhado). A resposta informa id da mensagem e channelId. Não há chave embutida no aplicativo nem token na URL. A comunidade persiste somente SHA-256 da chave aleatória de 256 bits; snapshots e SSE não expõem chaves ou hashes. Use HTTPS ao publicar o serviço na VPS.

Repetir nonce e texto por até cinco minutos retorna a mesma mensagem, sem persistir ou notificar novamente, limitado às últimas 100 tentativas de cada integração. Mudar o texto desse nonce dá conflito; uma mensagem apagada não é recriada nessa janela. O serviço permite cinco envios por cinco segundos, além do modo lento do canal. Os limites são independentes da interface e persistem.

O envio usa a autorização atual do criador: membro presente, canal visível, Enviar mensagens e ausência de timeout. A integração pode continuar depois de perder a permissão de administrar webhooks, mas não depois de perder autorização de envio. Remover seu criador ou excluir o canal revoga os webhooks permanentemente; renovar ou excluir invalida imediatamente a chave anterior. Excluir mantém mensagens existentes.

Esta modalidade recebe somente texto, identificado visualmente como Integração. Não aceita identidade de usuário, anexos, TTS, enquetes, mensagens de voz ou menções autorizadas a cargos/todos. Não executa comandos no servidor nem concede cargos de bot. Uma integração não possui perfil de pessoa. Seu nome é validado e não altera a origem registrada de mensagens antigas.

O painel oculta a credencial ao fechar, trocar conta/servidor/conexão ou perder permissão. Renovar e excluir exigem confirmação própria. Alterações são persistidas atomicamente antes do SSE; falha de disco não confirma a alteração nem publica mensagem. Concorrência usa a revisão da comunidade e conserva o nome em edição para resolver conflitos.

## Validação

Seis testes HTTP cobrem permissão, segredo não persistido, autorização atual, identificação, cargas inválidas, renomeação, renovação, exclusão, idempotência, limites, modo lento, timeout, reinício, remoção do criador/canal e falha de disco. run-webhooks-ui-smoke.mjs passou 14 verificações na interface Electron e ponte reais, com publicação por um cliente HTTP externo local, indicação visual e cancelamento de confirmações.
