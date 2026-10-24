# Serviço de comunidade e cargos

O serviço está implementado e validado localmente. No aplicativo configurado para a comunidade central, canais e mensagens usam a autoridade HTTP, a voz solicita tokens ao serviço e os arquivos novos podem usar autorização por canal. Clientes anteriores continuam no transporte legado até a migração. A hospedagem escolhida é uma VPS, com endereço a ser informado depois. O [pacote de implantação](community-vps.md) prepara o serviço sem exigir esse endereço agora; a ativação pública depende da implantação e da configuração posterior no aplicativo.

## Execução local

Requer Node 24 ou superior para executar o módulo TypeScript compartilhado de permissões. Crie `.env.community` no servidor, fora do controle de versão:

```dotenv
CONTALK_COMMUNITY_HOST=127.0.0.1
CONTALK_COMMUNITY_PORT=8789
CONTALK_COMMUNITY_DATA=.community-data
CONTALK_COMMUNITY_TOKENS='{"chave_aleatoria_individual_com_pelo_menos_32_caracteres":"username_exato"}'
```

Gere uma chave aleatória diferente para cada pessoa com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. As chaves identificam contas provisionadas pelo administrador; não há inscrição automática baseada apenas no nome informado por um cliente. Mais de uma chave pode apontar para a mesma conta, permitindo a transição entre dispositivos.

Execute `npm run community:start`. Por padrão, o serviço só escuta neste computador. O serviço público deverá usar HTTPS e permanecer disponível para todos os participantes. Para preparar a VPS com chaves geradas, use `npm run community:setup -- --member username` e siga [o guia da VPS](community-vps.md). Nenhuma VPS foi acessada ou implantada nesta etapa. Não inclua tokens, arquivos de dados ou credenciais privadas nos instaladores.

O arquivo `community.json` conserva cargos, atribuições, canais, regras, mensagens e auditoria. Cada operação exige a revisão atual; alterações concorrentes recebem conflito e devem ser recarregadas. A substituição do arquivo termina antes da publicação da nova revisão. SSE envia a cada cliente um retrato filtrado por suas próprias permissões. Canais privados, suas exceções e seu histórico não são entregues a membros sem acesso. O HQ começa com todos os membros provisionados como coproprietários, conforme a decisão do usuário; outras comunidades podem ter proprietários específicos.

O retrato contém as 100 mensagens recentes de cada canal. O histórico anterior continua persistido e pode ser carregado em páginas de 100, mediante Visualizar canal e Ler histórico. Quem pode visualizar, mas não ler o histórico, recebe somente mensagens novas durante a conexão autorizada. Revogar o acesso limpa o histórico correspondente da memória do aplicativo; ele não é gravado no cache compartilhado do transporte legado.

## Arquivos e mensagens diretas

Para ligar os dois serviços, acrescente ao `.env.community`:

```dotenv
CONTALK_COMMUNITY_STORAGE_URL=https://arquivos.seu-dominio.com
CONTALK_COMMUNITY_INTERNAL_TOKEN=chave_interna_aleatoria_diferente_das_chaves_pessoais
```

E ao `.env.storage`:

```dotenv
CONTALK_COMMUNITY_URL=https://comunidade.seu-dominio.com
CONTALK_COMMUNITY_INTERNAL_TOKEN=mesma_chave_interna_dos_dois_servicos
```

A chave interna autentica somente a comunicação entre serviços. Cada pessoa mantém suas próprias chaves de acesso; as associações de username devem coincidir nos dois serviços. HTTPS é obrigatório fora do loopback. Não distribua a chave interna aos aplicativos.

Uploads novos nesse modo recebem acesso controlado. O autor conserva acesso ao original; mensagens diretas concedem acesso explícito ao destinatário. Nos canais, Visualizar canal e Ler histórico autorizam a consulta. Um destinatário conectado sem Ler histórico recebe acesso aos anexos efetivamente entregues a ele, enquanto ainda puder visualizar o canal. Republicar um descritor exige acesso atual ao arquivo. A emissão e o consumo do link assinado verificam novamente a autorização; uma revogação também invalida o uso de um link emitido anteriormente. Falha da autoridade impede a operação em vez de liberar o arquivo.

Arquivos anteriores à ativação conservam a política legada. Ativar os serviços não os torna privados retroativamente. O transporte binário permanece no Telegram; os testes de autorização usam os dois serviços HTTP reais com um provedor binário de teste. A autenticação e o envio real à conta Telegram ainda exigem configuração do administrador.

## Voz central

O serviço pode receber credenciais privadas por estas variáveis:

```dotenv
CONTALK_COMMUNITY_LIVEKIT_URL=wss://seu-projeto.livekit.cloud
CONTALK_COMMUNITY_LIVEKIT_API_KEY=chave_privada_do_servidor
CONTALK_COMMUNITY_LIVEKIT_API_SECRET=segredo_privado_do_servidor
```

Tokens de sala têm validade curta, identidade derivada da chave autenticada e fontes de publicação limitadas pelas permissões. O serviço usa a API administrativa para atualizar ou remover participantes ativos quando o acesso muda.

O serviço também emite tokens de presença com identidade autenticada, sem permissão de publicar mídia. Alterações de permissões são reconciliadas com os participantes ativos. Enquanto a reconciliação estiver pendente, novos tokens de voz são recusados; o estado é indicado no editor. Expirações de timeout também são processadas sem exigir uma nova ação do usuário.

O modo legado conserva a arquitetura anterior de emissão de tokens. A transição exige revogar as credenciais distribuídas anteriormente ou usar um novo projeto com credenciais privadas antes de tratar restrições de voz como proteção contra um cliente alterado. O aplicativo configurado solicita tokens centrais e não retorna ao modo legado quando o serviço recusa uma operação. A migração de produção permanece pendente.

A revogação foi validada com o servidor LiveKit oficial local: retirar Falar interrompe a publicação e impede republicação; retirar Conectar desconecta e bloqueia novos tokens. No projeto Cloud atual, novas conexões receberam HTTP 429 com `connection minutes limit exceeded`. A [documentação oficial de cotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/) descreve as restrições de franquia. O teste não altera o plano nem as cotas.

## Validação

`npm run verify` inclui testes HTTP com clientes autenticados, entrega de revisões por SSE, filtragem de canais privados, autoria, concorrência, persistência, auditoria e cálculo de permissões. Os testes de voz verificam a assinatura e as permissões dos tokens com o SDK instalado.

`node tests/run-roles-ui-smoke.mjs` abre um Electron isolado e conecta o editor e a tela de chat ao serviço HTTP real de teste. Verifica a configuração cifrada no Windows, criação, edição, atribuição, sincronização, conflito de rascunho, confirmação de exclusão, auditoria, mensagens centrais, exclusão dos dados privados do cache compartilhado, regras de canal, categorias, agrupamento, cores e menções. Pode usar `ELECTRON_PATH` para selecionar um runtime local. Capturas e resultados ficam em `release/roles-ui-smoke`, ignorados pelo Git.

`node tests/run-community-voice-smoke.mjs` é uma verificação opcional contra um SFU real. Recebe as três variáveis privadas de LiveKit apenas no processo de serviço, cria uma sala temporária, usa microfone sintético e tenta verificar a revogação de falar/conectar. O teste interrompe na checagem de franquia se o projeto estiver bloqueado; não aumenta cotas nem muda planos. Resultados sem credenciais ficam em `release/community-voice-smoke`.

`node tests/run-local-community-voice-smoke.mjs` executa esse mesmo cenário com um servidor local descartável, sem consumir o projeto Cloud. Requer o executável oficial em `release/livekit-local/livekit-server.exe` ou `LIVEKIT_SERVER_PATH`. A validação utilizou [LiveKit v1.13.10](https://github.com/livekit/livekit/releases/tag/v1.13.10), pacote Windows amd64 com SHA-256 `fd4b7c2c3c1e4c71adaa4f6a046ad1c0abaaaf1e09fae904b35bf231ffae11d2`. O processo usa portas locais, chave de teste e configuração temporária, e é encerrado pelo teste. Resultado em `release/local-community-voice/result.json`.
