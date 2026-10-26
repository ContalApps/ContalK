# ConTALK 0.1.21

- Contas no servidor do ConTALK: criar conta e entrar (com usuário ou e-mail) vão direto à VPS. Ninguém configura endereço, chave, token ou armazenamento.
- Botão "+" da lateral: criar o seu servidor (com um canal de texto e um de voz) ou entrar no servidor de um amigo com um convite.
- Arquivos, imagens e mensagens de voz guardados no próprio servidor, com acesso controlado por canal e por destinatário. Não há mais Telegram nem serviço de arquivos separado.
- Removidas as abas Comunidade e Arquivos das Configurações e o formulário de armazenamento do chat.
- Regras de cadastro: usuário de 3 a 32 letras, números, `_` ou `-`; senha com pelo menos 8 caracteres; e-mail único.

**Começo do zero:** esta versão usa uma base nova no servidor. Contas e dados das versões anteriores não são migrados; depois de atualizar, cada pessoa cria a conta de novo. Versões anteriores do aplicativo deixam de conectar ao servidor.

Limites desta fase de testes: até 10 servidores por conta, 2 GB por arquivo e 5 GB por pessoa. Não há recuperação nem troca de senha, e nome de exibição e foto continuam salvos no computador.

Validação: tipos, 289 testes e build. Os testes de interface em Electron não foram executados nesta entrega.
