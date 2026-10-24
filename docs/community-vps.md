# Cargos na VPS

O endereço pode ser informado depois. A administração de cargos usa o serviço central; o aplicativo mostra a configuração pendente até conseguir autenticar a conexão. A engrenagem do servidor abre esse fluxo mesmo antes da primeira configuração. O HQ mantém todos os participantes provisionados como coproprietários nesta fase.

## Preparar sem endereço

Na raiz do repositório, com Node 24 ou superior, execute substituindo os nomes pelos usernames exatos das contas ConTALK:

```sh
npm run community:setup -- --member seu_username --member outro_username
```

Isso gera `.community-deploy/.env` e `.community-deploy/access.json`, ignorados pelo Git. O primeiro contém a configuração privada do servidor; o segundo relaciona as chaves individuais às contas. Nenhuma chave é mostrada no terminal. O comando recusa um diretório existente para não substituir credenciais em uso. Preserve os arquivos e entregue a cada participante somente sua própria chave.

O domínio fica vazio. Você pode preparar esses arquivos no seu computador e transferir a configuração privada para a VPS depois. Para instalações adicionais, use `--directory caminho`; o Compose fornecido espera os arquivos em `.community-deploy` na raiz.

## Executar na VPS

O pacote em `deploy/community` usa Docker Compose. O serviço roda como usuário sem privilégios, com sistema de arquivos somente leitura, volume persistente para cargos e histórico, healthcheck e reinício automático. A porta 8789 fica acessível somente pelo loopback da VPS. O antigo `docker-compose.yml` da raiz é um ambiente legado de LiveKit; não é o pacote de comunidade.

Com Docker Engine e Compose instalados, na raiz do repositório:

```sh
docker compose --env-file .community-deploy/.env -f deploy/community/compose.yml up -d --build community
curl --fail http://127.0.0.1:8789/health
```

O healthcheck público informa apenas se o processo está respondendo. Canais, cargos e operações continuam exigindo autenticação. A configuração permite validar cargos e chat antes de configurar voz ou Telegram; essas funções exigem seus respectivos serviços.

## Informar o endereço depois

Em `.community-deploy/.env`, preencha `CONTALK_COMMUNITY_DOMAIN` com o domínio, sem protocolo ou caminho, por exemplo `comunidade.seudominio.com`. Aponte o DNS para a VPS e disponibilize as portas 80 e 443. Então execute:

```sh
docker compose --env-file .community-deploy/.env -f deploy/community/compose.yml --profile public up -d --build
```

O proxy Caddy encaminha as requisições e as atualizações SSE e administra o HTTPS. Somente o domínio é passado ao proxy; as chaves individuais ficam no serviço de comunidade. O fluxo segue a documentação de [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https), [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) e [serviços do Compose](https://docs.docker.com/reference/compose-file/services/).

No ConTALK, abra a engrenagem do servidor ou o menu do próprio perfil → Configurações → Comunidade. Informe `https://comunidade.seudominio.com` e a chave correspondente à sua conta. A conexão verifica o username e conserva a chave cifrada no Windows. O endereço pode ser definido ou trocado nessa tela sem recompilar o aplicativo. Os cargos e as atribuições são carregados da VPS; não existe uma autoridade local independente para cada instalação.

## Voz e arquivos

As variáveis `CONTALK_COMMUNITY_LIVEKIT_URL`, `CONTALK_COMMUNITY_LIVEKIT_API_KEY` e `CONTALK_COMMUNITY_LIVEKIT_API_SECRET` ficam somente no arquivo privado da VPS. Use um projeto com cota disponível e credenciais privadas; as credenciais distribuídas pelos clientes legados precisam ser revogadas na migração. Não é necessário configurá-las para testar somente cargos e mensagens.

O armazenamento Telegram é opcional e separado. Para anexos com autorização por canal, configure `CONTALK_COMMUNITY_STORAGE_URL` e a mesma chave interna nos dois serviços, conforme [o guia da comunidade](community-service.md). A imagem da comunidade não inclui sessão Telegram nem chaves do cliente legado. Os usuários precisam estar provisionados com o mesmo username nos serviços utilizados.

Após alterar chaves ou variáveis, execute novamente `up -d` para recriar os serviços com o novo ambiente. Para acrescentar uma pessoa, gere uma chave aleatória de 32 bytes, acrescente o par chave → username em `CONTALK_COMMUNITY_TOKENS` e entregue somente essa chave. Não gere outra configuração por cima da existente. Reiniciar mantém cargos e histórico no volume `community_data`.

## Backup e atualização

Pare o serviço antes de copiar os dados, para obter uma cópia consistente:

```sh
docker compose --env-file .community-deploy/.env -f deploy/community/compose.yml stop community
docker compose --env-file .community-deploy/.env -f deploy/community/compose.yml cp community:/app/data .community-deploy/backup
docker compose --env-file .community-deploy/.env -f deploy/community/compose.yml --profile public up -d
```

Guarde também o arquivo `.env` em local privado. Para atualizar o código, mantenha a configuração e os volumes e execute `up -d --build`. `down -v` remove os volumes e seus dados; não faz parte do fluxo de atualização. O serviço JSON deve ter uma única instância gravadora, sem réplicas concorrentes sobre o mesmo volume.

## Evidência de validação

Os testes automatizados iniciam o ponto de entrada de produção usando o ambiente gerado, autenticam duas contas, criam e atribuem cargos, reiniciam o processo e verificam a persistência e a auditoria. O teste de interface cobre o estado sem endereço, configuração pelo painel e administração com o serviço real de teste. A execução do contêiner e a emissão de certificado no domínio da VPS precisam ser conferidas na implantação; Docker não está instalado no ambiente local de desenvolvimento.
