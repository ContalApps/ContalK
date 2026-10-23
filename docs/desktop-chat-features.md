# Funcionalidades de chat e desktop

Implementação na branch dev-caliari, para o aplicativo Electron.

## Armazenamento central no Telegram

A conta do administrador é a central de arquivos. A sessão MTProto fica somente no serviço Node; nenhum aplicativo recebe a sessão, API Hash ou senha do Telegram. O serviço cria um canal **privado** chamado `ContalK Storage`. Os usuários acessam os arquivos pelo serviço, sem entrar no canal. Um canal público exporia as publicações e não é necessário para esta arquitetura.

O estudo do TeleDrive considerou `src/lib/telegram/client.ts`, `channelManager.ts`, `loginFlow.ts` e `uploader.ts` no repositório https://github.com/senapati484/teledrive. A implementação do ContalK é independente e usa GramJS, sessão isolada e upload em partes; não incorpora o código do TeleDrive. Consulte também https://core.telegram.org/api/files para os limites e o protocolo. O pacote GramJS `telegram` instalado atualmente está arquivado; uma eventual migração para o sucessor requer validação de compatibilidade.

### Configuração do servidor

Use Node 22 ou superior. No servidor central, crie `.env.storage` (ignorado pelo Git):

```dotenv
TELEGRAM_API_ID=preencha_com_o_api_id
TELEGRAM_API_HASH=preencha_com_o_api_hash
TELEGRAM_VAULT_KEY=preencha_com_64_caracteres_hexadecimais_aleatorios
CONTALK_STORAGE_TOKENS='{"token_aleatorio_individual":"username_contalk"}'
CONTALK_STORAGE_PUBLIC_URL=https://arquivos.seu-dominio.com
CONTALK_STORAGE_HOST=127.0.0.1
CONTALK_STORAGE_PORT=8788
CONTALK_STORAGE_DATA=.storage-data
```

Obtenha API ID e API Hash em https://my.telegram.org. Gere a chave de criptografia e cada token separadamente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Não reutilize a chave do cofre como token de usuário.

Execute `npm run storage:login` no terminal privado do administrador. Informe telefone, código e, se necessário, senha de duas etapas. A entrada da senha é visível nesse terminal. Depois execute `npm run storage:start`. A sessão é cifrada com AES-256-GCM. Preserve a chave e faça backup do diretório de dados: ele contém o índice dos arquivos e os registros de visualização única. Nunca distribua esse diretório ou a chave nos instaladores.

Publique o serviço atrás de um proxy HTTPS. O proxy precisa aceitar até 2 GB e permitir operações longas. O processo mantém até dois uploads e quatro downloads simultâneos. Reserve espaço temporário para dois arquivos de 2 GB. O Node recebe o arquivo em disco e o GramJS o envia em partes ao Telegram; os binários não passam pelo histórico do chat. O serviço precisa continuar ligado para uploads e downloads funcionarem.

### Configuração de cada aplicativo

Ao anexar o primeiro arquivo, informe o endereço HTTPS e a chave individual fornecidos pelo administrador. A engrenagem junto ao campo de mensagem permite trocar esses dados. As credenciais são protegidas pelo `safeStorage` do Electron. Para um teste local, o endereço pode ser `http://127.0.0.1:8788`.

A chave individual é associada ao username no servidor. Use a mesma associação para todas as instalações desse usuário e chaves diferentes para usuários diferentes. A configuração atual é manual, adequada ao teste com usuários provisionados pelo administrador. Ainda não há provisionamento automático integrado ao login ContalK nem controle de acesso por canal no serviço: usuários provisionados que obtenham o identificador de um arquivo conseguem solicitar seu download. Não publique o serviço como armazenamento aberto.

Arquivos selecionados pela janela nativa: até 2 GiB (2.147.483.648 bytes). Imagens coladas: até 1 MiB nesta implementação. Os limites e a disponibilidade do Telegram continuam aplicáveis; o aplicativo não promete uma garantia contratual de armazenamento ilimitado. O download usa um link assinado válido por 15 minutos, aberto no navegador. Imagens recebem uma miniatura local; PDFs e outros arquivos recebem cartão de nome/tamanho e download. Miniaturas antigas sem Telegram continuam legíveis.

## Mensagens

O remetente escolhe `Gerar prévia` e `Visualização única por pessoa` antes de enviar. A opção é transmitida aos destinatários. Links continuam clicáveis quando a prévia está desativada. `@ Mencionar` insere o username e as menções conhecidas recebem destaque. Não há notificação push de menção nesta etapa.

O autor pode editar o texto e apagar a mensagem. A identidade de quem enviou a alteração é conferida contra a autoria. IDs estáveis evitam duplicação e mensagens apagadas têm marcador local contra replay. As alterações se propagam aos participantes conectados, de acordo com o transporte atual. Ainda não existe sincronização de todo o histórico para usuários offline ou novas instalações. Apagar uma mensagem não apaga o original no Telegram.

A visualização única registra um recibo atômico no servidor por username e mensagem antes de abrir o conteúdo. O recibo impede uma segunda abertura inclusive em outra instalação com a mesma chave/username. É uma restrição de interface: o transporte e o histórico local ainda contêm o conteúdo. Não é DRM nem mecanismo contra captura de tela, cópia do histórico ou download do arquivo pelo destinatário. Para conteúdo sigiloso, será necessário armazenar a mensagem somente no servidor e entregar o conteúdo por uma autorização de leitura consumível.

## Desktop, voz e atualizações

O sino no topo do aplicativo mostra atualizações e permite iniciar download/instalação. A verificação ocorre cinco segundos após abrir, a cada cinco minutos e ao focar a janela. O app se oculta durante o download; o progresso separado continua visível. Ao concluir, o instalador silencioso fecha e reabre o app. Falhas devolvem a janela. A barra de título permanece nativa; o sino fica no cabeçalho do ContalK.

`Microfone` abre a seleção da entrada, mantendo teste local e opções de silenciar. `Áudio` abre a seleção da saída. A saída escolhida é aplicada à sala atual e às próximas chamadas. As permissões e o suporte do dispositivo seguem o Chromium/Windows.

Fechar a janela mantém o processo na bandeja e preserva a conexão. Clique esquerdo ou direito no ícone abre o menu, que inclui `Fechar ContalK`. O ícone anima barras enquanto o LiveKit indica que o microfone local está transmitindo voz; não é um medidor de amplitude PCM. A instalação de atualizações pode encerrar o processo normalmente.

## Validação

Os testes automatizados cobrem autoria, deduplicação, anexos centrais de 2 GB por metadados, integridade do cofre, assinatura/expiração dos links e comportamento da bandeja. Tipos e build são verificados separadamente. O login real do Telegram, envio/baixa de um arquivo de 2 GB, dispositivos físicos e troca real de release exigem validação manual com a infraestrutura e uma instalação Windows.

## Controles compactos e configurações de canais

O card inferior esquerdo concentra microfone, áudio recebido, câmera, compartilhamento e desconexão. As pequenas setas ao lado do microfone e fone abrem os seletores de dispositivos. O card permanece ancorado enquanto a lista de canais rola. O palco não repete a barra grande de controles.

A engrenagem de cada canal e o clique direito abrem `ChannelSettings`. O painel permite renomear preservando ID e histórico, consultar o acesso atual e solicitar exclusão com confirmação separada. Conforme a política atual, todos os membros podem administrar canais; ainda não existem cargos/permissões individuais.

Nomes são compartilhados em `community-channels` com `nameUpdatedAt`. Revisões antigas são ignoradas; empates são resolvidos pela ordem do nome, para convergir. O nome da chamada ativa também é atualizado. Clientes antigos precisam atualizar para receber renomeações. Alterações locais aguardam a conexão e usam as retransmissões periódicas existentes.

## Visual de referência compacto

O tema clássico usa uma paleta neutra, com roxo concentrado nos estados ativos. `compact.css`, importado depois dos estilos base em `src/main.tsx`, define cabeçalho de 56 px, trilho de 64 px, lateral de canais de 240 px e painel de membros de 256 px em telas largas. As laterais se adaptam em telas menores e continuam respeitando a escala pessoal da interface.

O cabeçalho e os cartões do servidor usam `BrandMark` em SVG. As estatísticas mostram apenas dados disponíveis (membros online e canais), sem inventar região ou latência. A sala de voz agrupa seus participantes e identifica transmissões ativas.

A transmissão mantém o vídeo real e apresenta um estado de espera até receber `loadeddata`. Os participantes e o volume ficam no rodapé; o volume completo continua recolhido até o clique. O teste de interface em Electron valida as dimensões principais, agrupamento, ausência de transbordamento e remoção do estado de espera quando o vídeo fica pronto.
