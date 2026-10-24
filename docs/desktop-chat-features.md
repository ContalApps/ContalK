# Funcionalidades de chat e desktop

Implementação na branch `dev/caliari`, para o aplicativo Electron.

## Armazenamento central no Telegram

A conta do administrador é a central de arquivos. A sessão MTProto fica somente no serviço Node; nenhum aplicativo recebe a sessão, API Hash ou senha do Telegram. O serviço cria um canal **privado** chamado `ConTALK Storage`. Os usuários acessam os arquivos pelo serviço, sem entrar no canal. Um canal público exporia as publicações e não é necessário para esta arquitetura.

O estudo do TeleDrive considerou `src/lib/telegram/client.ts`, `channelManager.ts`, `loginFlow.ts` e `uploader.ts` no repositório https://github.com/senapati484/teledrive. A implementação do ConTALK é independente e usa GramJS, sessão isolada e upload em partes; não incorpora o código do TeleDrive. Consulte também https://core.telegram.org/api/files para os limites e o protocolo. O pacote GramJS `telegram` instalado atualmente está arquivado; uma eventual migração para o sucessor requer validação de compatibilidade.

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

Ao anexar o primeiro arquivo, informe o endereço HTTPS e a chave individual fornecidos pelo administrador. Para trocar esses dados, clique com o botão direito no próprio perfil e abra Configurações → Arquivos. As credenciais são protegidas pelo `safeStorage` do Electron. Para um teste local, o endereço pode ser `http://127.0.0.1:8788`.

A chave individual é associada ao username exato no servidor. Use a mesma associação para todas as instalações desse usuário e chaves diferentes para usuários diferentes. A configuração atual é manual, adequada ao teste com usuários provisionados pelo administrador. Ainda não há provisionamento automático integrado ao login ConTALK. Sem integração com a comunidade, arquivos seguem o acesso legado entre usuários provisionados. Com [a autoridade de comunidade configurada](community-service.md), uploads novos verificam o acesso por canal e destinatário, inclusive no consumo dos links; arquivos antigos conservam sua política anterior.

Arquivos selecionados pela janela nativa: até 2 GiB (2.147.483.648 bytes). Imagens coladas: até 1 MiB nesta implementação. Os limites e a disponibilidade do Telegram continuam aplicáveis; o aplicativo não promete uma garantia contratual de armazenamento ilimitado. O download usa um link assinado válido por 15 minutos, aberto no navegador. Imagens recebem uma miniatura local; PDFs e outros arquivos recebem cartão de nome/tamanho e download. Miniaturas antigas sem Telegram continuam legíveis.

## Mensagens

O remetente escolhe `Gerar prévia` e `Visualização única por pessoa` antes de enviar. A opção é transmitida aos destinatários. Links continuam clicáveis quando a prévia está desativada. `@ Mencionar` insere o username e as menções conhecidas recebem destaque. O sino, os contadores e os avisos do sistema notificam novas mensagens. Na comunidade configurada, menções a cargos são validadas pelo serviço e respeitam a preferência do destinatário.

O autor pode editar o texto e apagar a mensagem. A identidade de quem enviou a alteração é conferida contra a autoria. IDs estáveis evitam duplicação e mensagens apagadas têm marcador contra replay. No transporte legado, as alterações se propagam entre participantes conectados. Na comunidade configurada, o serviço persiste o histórico e oferece carregamento paginado conforme as permissões; Gerenciar mensagens permite apagar mensagens de terceiros com auditoria. Apagar uma mensagem não apaga o original no Telegram.

A visualização única registra um recibo atômico no servidor por username e mensagem antes de abrir o conteúdo. O recibo impede uma segunda abertura inclusive em outra instalação com a mesma chave/username. É uma restrição de interface: o transporte e o histórico local ainda contêm o conteúdo. Não é DRM nem mecanismo contra captura de tela, cópia do histórico ou download do arquivo pelo destinatário. Para conteúdo sigiloso, será necessário armazenar a mensagem somente no servidor e entregar o conteúdo por uma autorização de leitura consumível.

## Desktop, voz e atualizações

O sino na barra de título reúne atualizações e atividades e permite iniciar download/instalação. A verificação ocorre cinco segundos após abrir, a cada cinco minutos e ao focar a janela. O app se oculta durante o download; o progresso separado continua visível. Ao concluir, o instalador silencioso fecha e reabre o app. Falhas devolvem a janela. A barra usa controles personalizados com a sobreposição nativa de minimizar, maximizar e fechar no Windows.

Os botões de microfone e áudio alternam o estado de captura e recepção. A seleção de dispositivos fica no menu aberto com o botão direito sobre o próprio perfil e em Configurações → Voz e áudio. A saída escolhida é aplicada à sala atual e às próximas chamadas. As permissões e o suporte do dispositivo seguem o Chromium/Windows.

Fechar a janela mantém o processo na bandeja e preserva a conexão. Clique esquerdo ou direito no ícone abre o menu, que inclui controles de microfone, saída de áudio e `Fechar ConTALK`. O ícone anima barras enquanto o microfone local está ativo na chamada, sem esperar a detecção de fala; não é um medidor de amplitude PCM. A instalação de atualizações pode encerrar o processo normalmente.

## Validação

Os testes automatizados cobrem autoria, deduplicação, anexos centrais de 2 GB por metadados, integridade do cofre, assinatura/expiração dos links e comportamento da bandeja. Tipos e build são verificados separadamente. A atualização Windows foi validada com duas versões de uma instalação de teste isolada; consulte [a validação dos ajustes](experience-validation.md). O login real do Telegram, envio/baixa de um arquivo de 2 GB e dispositivos físicos exigem validação com a infraestrutura correspondente.

## Controles compactos e configurações de canais

O card inferior esquerdo concentra microfone, áudio recebido, câmera, compartilhamento e desconexão. O botão direito sobre o perfil abre configurações pessoais e seletores de dispositivos. O card permanece ancorado enquanto a lista de canais rola. O palco não repete a barra grande de controles.

A engrenagem de cada canal e o clique direito abrem `ChannelSettings`. O painel permite renomear preservando ID e histórico, consultar o acesso atual e solicitar exclusão com confirmação separada. Na comunidade configurada, as regras individuais e por cargo são aplicadas pelo serviço; a política inicial do HQ mantém todos os membros como coproprietários. O modo legado conserva a administração compartilhada de canais.

No transporte legado, nomes são compartilhados em `community-channels` com `nameUpdatedAt`. Revisões antigas são ignoradas; empates são resolvidos pela ordem do nome, para convergir. Na comunidade configurada, mudanças exigem a revisão atual do serviço e chegam por SSE. O nome da chamada ativa também é atualizado. Clientes antigos precisam atualizar para receber essas mudanças.

## Visual de referência compacto

O tema clássico usa uma paleta neutra, com roxo concentrado nos estados ativos. `compact.css`, importado depois dos estilos base em `src/main.tsx`, define cabeçalho de 56 px, trilho de 64 px, lateral de canais de 240 px e painel de membros de 256 px em telas largas. As laterais se adaptam em telas menores e continuam respeitando a escala pessoal da interface.

O cabeçalho e os cartões do servidor usam `BrandMark` em SVG. As estatísticas mostram apenas dados disponíveis (membros online e canais), sem inventar região ou latência. A sala de voz agrupa seus participantes e identifica transmissões ativas.

A transmissão mantém o vídeo real e apresenta um estado de espera até receber `loadeddata`. Os chips de participantes do rodapé foram removidos. Volumes de voz e transmissão ficam no menu de contexto do perfil, acessível também em tela cheia. O teste de interface em Electron valida as dimensões principais, agrupamento, ausência de transbordamento e remoção do estado de espera quando o vídeo fica pronto.
