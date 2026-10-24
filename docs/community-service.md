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

## Comunicação central

A presença usa WebSocket autenticado em /realtime; o backend emite tickets opacos de uso único com 30 segundos de validade. A mídia usa mediasoup, com autorização de publicação/recepção no servidor e fechamento das publicações quando permissões mudam. Não há assinatura de sala no desktop.

Veja [implantação Meteor/Coolify](meteor-voice.md) para variáveis, portas, manutenção e testes. O HQ conserva todos os membros como coproprietários. O teste isolado usa outro servidor lógico para validar negações sem modificar essa política.
