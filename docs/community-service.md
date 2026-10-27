# Serviço de comunidade

Tudo fica no servidor da VPS (`https://comunidade.contalapps.com.br`): contas, servidores, canais, mensagens, cargos e arquivos. O aplicativo já vem apontado para esse endereço. Ninguém digita endereço, chave, token ou configura armazenamento; não há Telegram nem serviço de arquivos separado.

## Contas

A conta existe só no servidor. Criar conta (`POST /register`: usuário, e-mail e senha) e entrar (`POST /login`: usuário ou e-mail e senha) vão sempre ao servidor; o computador guarda apenas a sessão, cifrada com `safeStorage`, e um cache do perfil (nome de exibição, foto e descrição continuam locais). Sair encerra a sessão no servidor (`POST /logout`). A senha é guardada com scrypt em `accounts.json`; a sessão, só como hash.

Regras: usuário com 3 a 32 letras, números, `_` ou `-` (sem diferenciar maiúsculas); e-mail único; senha de 8 a 200 caracteres. Cadastro e login são limitados por endereço (último `X-Forwarded-For`, posto pelo proxy do Coolify; a porta 8789 não é publicada). Cada conta mantém até 10 sessões; a mais antiga cai quando uma nova é criada. Não há recuperação nem troca de senha ainda. O cadastro é aberto a quem tiver o aplicativo.

Perfis criados antes desta versão são ignorados: depois de atualizar, cada pessoa cria a conta de novo.

## Servidores

Conta nova não pertence a nenhum servidor. O botão "+" da lateral abre "Criar ou entrar em um servidor": criar (`POST /servers`, até 10 por conta; quem cria é o único dono e recebe um canal de texto e um de voz) ou entrar com o convite de um amigo. Convites, cargos e permissões seguem as regras já existentes. `GET /identity` devolve os servidores da conta, e só eles aparecem na lateral.

## Dados e implantação

O serviço grava tudo em `contalk-v2/` dentro de `CONTALK_COMMUNITY_DATA` (`/app/data` no container): `accounts.json`, `community.json` e `files/`. Não há dados de versões anteriores na VPS: o volume, conferido em 26/10/2026, só tinha `contalk-v2/`, porque o serviço antigo nunca chegou a gravar dados. `CONTALK_COMMUNITY_TOKENS`, `CONTALK_COMMUNITY_INTERNAL_TOKEN` e `CONTALK_COMMUNITY_STORAGE_URL` não são mais lidos.

No Coolify, o app da comunidade usa `deploy/community/compose.coolify.yml` da `main` com deploy automático: um merge na `main` atualiza a VPS.

Para testar localmente (Node 24+): `npm run community:start` com `CONTALK_COMMUNITY_HOST=127.0.0.1`, `CONTALK_COMMUNITY_PORT=8789` e `CONTALK_COMMUNITY_DATA=.community-data` no `.env.community`, e abra o aplicativo com `CONTALK_COMMUNITY_URL=http://127.0.0.1:8789`.

O arquivo `community.json` conserva cargos, atribuições, canais, regras, mensagens e auditoria. Cada operação exige a revisão atual; alterações concorrentes recebem conflito e devem ser recarregadas. A substituição do arquivo termina antes da publicação da nova revisão. SSE envia a cada cliente um retrato filtrado por suas próprias permissões. Canais privados, suas exceções e seu histórico não são entregues a membros sem acesso.

O retrato contém as 100 mensagens recentes de cada canal. O histórico anterior continua persistido e pode ser carregado em páginas de 100, mediante Visualizar canal e Ler histórico. Quem pode visualizar, mas não ler o histórico, recebe somente mensagens novas durante a conexão autorizada. Revogar o acesso limpa o histórico correspondente da memória do aplicativo.

## Arquivos e mensagens diretas

Os arquivos ficam no disco da VPS, em `contalk-v2/files/`: `POST /files` (até 2 GB por arquivo), `GET /links/:id` (link assinado de 15 minutos), `GET /files/:id` (download), `POST /files/:id/share` e `POST /views/:id`. Cada pessoa tem 5 GB (`CONTALK_FILE_QUOTA_MB`), e os uploads param enquanto restariam menos de 2 GB livres no disco. Até 4 uploads e 16 downloads simultâneos. Arquivos não são apagados automaticamente.

O autor conserva acesso ao original; mensagens diretas concedem acesso ao destinatário. Nos canais, Visualizar canal e Ler histórico autorizam a consulta; quem recebe a mensagem sem Ler histórico tem acesso aos anexos efetivamente entregues. Cada download verifica de novo a autorização e uma revogação invalida links já emitidos. A chave que assina os links é gerada a cada início do serviço.

## Comunicação central

A presença usa WebSocket autenticado em /realtime; o backend emite tickets opacos de uso único com 30 segundos de validade. A mídia usa mediasoup, com autorização de publicação/recepção no servidor e fechamento das publicações quando permissões mudam. Não há assinatura de sala no desktop.

Veja [implantação Meteor/Coolify](meteor-voice.md) para variáveis, portas, manutenção e testes. O teste isolado usa outro servidor lógico para validar negações.
