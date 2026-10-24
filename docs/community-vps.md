# Cargos na VPS

O endereço pode ser informado depois. A administração de cargos usa o serviço central; o aplicativo mostra a configuração pendente até conseguir autenticar a conexão. A engrenagem do servidor abre esse fluxo mesmo antes da primeira configuração. O HQ mantém todos os participantes provisionados como coproprietários nesta fase.

## Preparar sem endereço

Na raiz do repositório, com Node 24 ou superior, execute substituindo os nomes pelos usernames exatos das contas ConTALK:

```sh
npm run community:setup -- --member seu_username --member outro_username
```

Isso gera `.community-deploy/.env` e `.community-deploy/access.json`, ignorados pelo Git. O primeiro contém a configuração privada do servidor; o segundo relaciona as chaves individuais às contas. Nenhuma chave é mostrada no terminal. O comando recusa um diretório existente para não substituir credenciais em uso. Preserve os arquivos e entregue a cada participante somente sua própria chave.

O domínio fica vazio. Você pode preparar esses arquivos no seu computador e transferir a configuração privada para a VPS depois. Para instalações adicionais, use `--directory caminho`; o Compose fornecido espera os arquivos em `.community-deploy` na raiz.

## Implantar, atualizar e validar

Para a VPS com Coolify, siga [Meteor Cloud: comunicação WebRTC](meteor-voice.md). O perfil público com Caddy em deploy/community/compose.yml é somente para instalação independente; não o ative nesta VPS, que já tem proxy nas portas 80/443.

Use o recurso e volume de comunidade existentes. A migração opcional para Compose exige o nome exato do volume externo, as mesmas chaves individuais e backup consistente; não crie uma comunidade vazia em paralelo. A configuração gerada não substitui credenciais já cadastradas no Coolify.
