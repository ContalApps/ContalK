# Comunicação WebRTC na Meteor Cloud

## Auditoria e diagnóstico (24/10/2026)

As branches remotas main e dev/caliari estavam em b821d90, sem migração de mídia alternativa e sem alterações locais. Conforme orientação posterior do usuário, a correção está na branch codex/corrigir-comunicacao-vps e retira o LiveKit completamente: SDKs, servidor, configuração, assinatura no frontend/Electron/Tauri, emissor anônimo e diagnósticos legados foram removidos. Chaves de servidor não são distribuídas no cliente.

Constatações executadas: comunidade.contalapps.com.br resolve para 74.0.5.249 e GET /health respondeu 200. voz.contalapps.com.br retornou ENOTFOUND. O código antigo conectava ao Cloud quando a comunidade não estava configurada e tinha credenciais privadas embutidas. O histórico do projeto registra anteriormente HTTP 429 por franquia, mas isso não foi reproduzido nesta sessão. Sem credencial individual de produção e acesso ao painel, não é possível comprovar a causa específica do erro apresentado. Saúde HTTP sozinha não valida WebSocket nem mídia.

## Arquitetura final

- O mesmo backend de comunidade Node 24 mantém HTTP/SSE e passa a servir WebSocket em /realtime. Contas, mensagens, arquivos, cargos, controles e interface são preservados.
- Um worker nativo mediasoup dentro do container encaminha áudio/vídeo (SFU), com Opus/VP8 e uma porta UDP/TCP multiplexada. Não há malha entre clientes, Redis nem serviço externo de mídia.
- Coturn é o segundo container, para STUN/TURN. Usa autenticação temporária HMAC; o segredo compartilhado fica apenas no backend e no coturn. As credenciais temporárias de relay vencem em uma hora.
- Os endpoints autenticados /presence-token e /servers/:id/voice-token agora emitem tickets opacos aleatórios de uso único, com 30 segundos de validade, vinculados à identidade e sala. Não são JWTs. O ticket vai no primeiro frame WebSocket, nunca na URL ou log do proxy. Presença permite dados/perfil, não mídia.
- O servidor valida VIEW_CHANNEL, CONNECT, SPEAK e STREAM ao publicar/consumir e fecha produtores/sessões quando as permissões são revogadas. Quatro identidades por sala, uma sessão por identidade/sala, até dois transportes e quatro fontes por participante. Há limite de frames, fila, payload, sessões e buffers.
- O cliente refaz tickets, transportes e publicações após interrupção, em até seis tentativas com espera de 1–8 segundos e timeout de 10 segundos por RPC/conexão. Esgotamento exige entrada manual. Trocar canal/conta ou sair encerra captura e transportes. Volume de voz e áudio da tela permanecem separados; o áudio de tela conserva captura isolada WASAPI.

O HQ continua com todos os participantes como coproprietários; não eleja proprietário único para testar permissões. O cliente suportado é Electron Windows. O Tauri legado teve a assinatura removida, mas ainda precisa implementar a ponte de comunidade antes de poder ser distribuído como cliente equivalente. Navegador sem essa ponte não dispõe de autenticação de comunidade.

## Variáveis do backend

Use .env.example como referência, sem substituir as variáveis atuais no Coolify:

| Variável | Valor/finalidade |
| --- | --- |
| CONTALK_COMMUNITY_TOKENS | Preservar mapa privado das chaves individuais já configuradas |
| CONTALK_COMMUNITY_INTERNAL_TOKEN / STORAGE_URL | Preservar integração de arquivos existente |
| CONTALK_COMMUNITY_DATA | /app/data, sobre o MESMO volume atual |
| CONTALK_REALTIME_URL | wss://comunidade.contalapps.com.br/realtime |
| CONTALK_MEDIA_PUBLIC_IP | 74.0.5.249 |
| CONTALK_MEDIA_PORT | 40000 |
| CONTALK_TURN_URLS | turn:74.0.5.249:3478?transport=udp,turn:74.0.5.249:3478?transport=tcp |
| CONTALK_TURN_SECRET | Novo segredo hexadecimal aleatório de 32 bytes ou mais, igual no coturn |

Não use VITE_ nem argumentos de build para segredos. O backend falha ao receber endereço público sem WSS. Em desenvolvimento local use ws://127.0.0.1:8789/realtime e IP de mídia 127.0.0.1; TURN pode ficar ausente. community:setup continua recusando sobrescrever uma instalação existente. Não o rode sobre o ambiente atual para regenerar chaves.

## Publicar no Coolify sem perder dados

1. Registre o ID do recurso, SHA atual, configuração, nome real do volume ou bind mount e caminho de community.json. Faça backup consistente com o container parado ou snapshot consistente. Conserve chaves individuais, token interno, credenciais Telegram e os arquivos. Não publique saídas de docker inspect/config contendo segredos.
2. Preserve o recurso atual, Dockerfile deploy/community/Dockerfile, contexto raiz, porta HTTP 8789 e domínio comunidade. O Dockerfile instala o worker nativo e roda como node. Configure mapeamento direto 40000:40000 em TCP E UDP, mantendo HTTP somente via proxy. Se o painel não permitir UDP no recurso Dockerfile, migre esse mesmo recurso para Compose conforme o próximo item; não suba outra comunidade com volume vazio.
3. Migração opcional para build pack Compose: base do repositório /deploy/community, arquivo /compose.coolify.yml. Copie as variáveis existentes e informe CONTALK_EXISTING_COMMUNITY_VOLUME com o nome EXATO do volume Docker atual. O Compose exige volume externo já existente e não cria substituto. Se o armazenamento atual for bind mount, adapte a montagem ao caminho verificado antes de publicar; não use esse Compose sem essa revisão. No domínio do serviço community use https://comunidade.contalapps.com.br:8789 (8789 é destino interno, público continua 443). Reserve 1536 MiB/1,5 CPU para comunidade+worker.
4. Crie recurso Git separado para coturn, branch main, build pack Compose, base /deploy/voice e arquivo /compose.yml. Cadastre CONTALK_MEDIA_PUBLIC_IP e o mesmo CONTALK_TURN_SECRET. Não associe domínio HTTP ao coturn. Ele expõe 3478 TCP/UDP e relay UDP 49160–49200. Não usa banco nem volume persistente. Limite de 256 MiB/0,5 CPU, quotas, logs rotativos e healthcheck de processo/porta. O relay IPv4 só permite o IP da VPS como peer. O Dockerfile e Compose devem ser construídos e validados na VPS antes de afirmar que a implantação funciona; Docker não está disponível nesta máquina.
5. Cadastre as novas variáveis do backend. No proxy Coolify, confirme TLS válido e Upgrade WebSocket para /realtime no mesmo domínio da comunidade. Não há proxy novo em 80/443. O domínio voz.contalapps.com.br é opcional: se optar por ele, crie A para 74.0.5.249, associe ao MESMO backend/porta 8789 e ajuste CONTALK_REALTIME_URL; sua ausência atual não bloqueia o uso do domínio comunidade.
6. Publique backend e coturn, confira healthcheck, logs e WebSocket. Publique o cliente corrigido apenas após validar o backend. Cada participante configura a URL de comunidade e SUA chave individual no app; a identidade deve corresponder ao username local. O servidor informa o endereço de sinalização sem recompilar o cliente.

O docker-compose.yml da raiz inclui os dois pacotes e também exige o volume externo explícito; requer Compose com suporte a include. Para Coolify prefira os arquivos específicos acima, sem include. deploy/community/compose.yml com Caddy é para instalação independente; NÃO ative seu perfil public nesta VPS, pois disputaria 80/443 com o proxy existente.

## DNS e firewall

| Entrada | Destino |
| --- | --- |
| comunidade.contalapps.com.br A | 74.0.5.249, já observado |
| voz.contalapps.com.br A | Opcional, ausente nesta validação |
| TCP 80/443 | Proxy Coolify atual, certificados, HTTPS e WSS |
| TCP/UDP 40000 | WebRTC direto ao worker no backend |
| TCP/UDP 3478 | STUN/TURN coturn |
| UDP 49160–49200 | Faixa de relay coturn |
| TCP 8789 | Interno ao proxy; não publicar diretamente na internet |

Libere mídia no firewall Meteor e nas regras Ubuntu/Docker. Preserve SSH e portas de administração; não faça reset do firewall. Docker pode ultrapassar regras simples do UFW. Não habilite CDN/proxy HTTP nos registros usados pela mídia. IP e portas anunciados precisam chegar ao mesmo container; o proxy HTTP não transporta UDP.

TURN/TCP 3478 ajuda redes que bloqueiam UDP, mas NÃO garante redes que só permitem TLS/443. Essa configuração não inicia TURN/TLS. Para esse caso, planeje certificado/domínio de TURN e IP dedicado ou proxy L4 que compartilhe 443 corretamente; outro host no proxy HTTP não resolve. Não ocupe 443 com outro serviço enquanto o Coolify já a utiliza. Valide o relay forçado em rede externa antes de declarar NAT/TURN aprovado.

## Deploy automático e atualização Windows

No painel, confirmar nos dois recursos Git: GitHub App instalada, repositório ContalApps/ContalK, branch main, deploy automático habilitado e evento push com entrega 2xx no histórico do webhook. Depois de aprovação/merge, conferir SHA, build e saúde do deploy. Esses ajustes privados não foram inspecionados nem alterados nesta sessão. Um push só publica backend se essa integração estiver habilitada.

O workflow release.yml preserva Windows/Node 24, tipos/testes, helpers, instalador, blockmap e latest.yml. electron-updater continua usando GitHub Releases. A nova arquitetura muda o protocolo de mídia: clientes antigos não são compatíveis; atualize backend e os quatro clientes em uma janela coordenada. Push em main não publica o instalador.

Este trabalho abre PR para revisão: não inclui merge, tag ou release. Na próxima publicação estável, incrementar consistentemente package/package-lock, Cargo workspace/lock e Tauri, escrever notas e publicar tag no commit integrado à main. Confirmar instalador, blockmap e latest.yml públicos/latest antes de dizer que há atualização disponível. Nunca substituir instalador publicado.

Rollback: selecionar imagem/commit anterior saudável no Coolify preservando EXATAMENTE a montagem e as variáveis atuais; reverter worker/backend junto com cliente compatível. Salas e tickets são efêmeros, mensagens/cargos ficam no volume. Não usar down -v, prune ou reinstalação que remova volume. Restaurar backup somente com destino confirmado e serviço parado. Reverter ao cliente com assinatura exposta reintroduziria a falha de segurança; prefira nova versão corretiva. Não alterar histórico Git nem revogar credenciais sem aprovação.

## Credenciais antigas

As credenciais antigas de LiveKit Cloud distribuídas em frontend, Electron, Tauri e fallback do token-server precisam ser revogadas/rotacionadas pelo responsável. Considere histórico e instaladores públicos como exposição. Nenhum valor é repetido neste documento. A remoção do novo build não invalida cópias antigas. Não houve revogação ou reescrita de histórico. Preserve as chaves atuais da comunidade e do armazenamento.

## Testes e aceite

Automatizados: npm run verify valida tipos, HTTP/SSE, persistência, cargos, autenticação WebSocket real, tickets de uso único, identidade, limite de quatro pessoas, dados direcionados e revogação CONNECT. node tests/run-community-voice-smoke.mjs abre quatro Electron isolados usando worker REAL, Opus e mídia sintética. Testa publicações, recebimento RTP, tela com faixa de áudio, mute, reconexão com ticket novo, revogação SPEAK e CONNECT e negação de novo ticket. Os resultados ficam em release/native-voice-smoke/result.json; isso prova integração LOCAL, não som físico ou rede da VPS.

Probe remoto: node scripts/verify-community-vps.mjs. Sem credencial testa apenas /health. Com CONTALK_VERIFY_TOKEN no ambiente protegido testa identidade, snapshot e autenticação WebSocket no canal CONTALK_VERIFY_CHANNEL (padrão vc-general). Não imprime segredos e não valida mídia; o probe ocupa brevemente uma vaga na sala e substitui sessão da mesma identidade nesse canal. Rode com sua sessão de voz encerrada. Apague a variável ao terminar.

Aceite humano (registrar versão, horário, sistema e rede de cada participante):

1. Quatro contas carregam mesmos canais/cargos; mensagem nova chega aos demais. Reiniciar backend e conferir cargo e mensagem anteriores, com o mesmo volume.
2. Dois usuários em redes diferentes conversam em ambos os sentidos; entram os outros dois. Confirmar quatro identidades, áudio recebido, microfone, mute, deafen e seleção de dispositivos.
3. Ativar câmera e tela; confirmar imagem e áudio isolado no Windows suportado, volume independente e fim da captura ao parar/sair. Testar duas telas e som de aplicativo fora da fonte selecionada. Áudio não existe para toda fonte/SO; registrar o que foi testado.
4. Interromper rede por 5–10 segundos e verificar recuperação sem duplicar áudio. Testar interrupção longa, falha final e entrada manual. Reiniciar worker/backend e repetir.
5. Usar o grupo isolado de teste para negar SPEAK, STREAM e CONNECT e conferir enforcement no servidor. Não alterar a política de coproprietários do HQ para testar negações.
6. Testar TURN em rede externa com UDP direto bloqueado e confirmar relay selecionado e RTP. Testar atualização/restart dos containers sem perder mensagens/cargos. Conferir bundle novo sem segredo e arquivos antigos de build removidos.

Referências: [mediasoup servidor](https://mediasoup.org/documentation/v3/mediasoup/api/), [cliente](https://mediasoup.org/documentation/v3/mediasoup-client/api/), [coturn 4.7.0](https://github.com/coturn/coturn/blob/4.7.0/examples/etc/turnserver.conf), [Coolify Compose](https://coolify.io/docs/applications/builds/docker-compose).
