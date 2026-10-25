# ConTALK

Aplicativo Windows de comunicação para uma comunidade privada, com React/TypeScript, Electron, mensagens e cargos centrais e WebRTC auto-hospedado.

## Arquitetura e execução

O backend Node 24 mantém mensagens/cargos via HTTP e SSE, presença/dados via WebSocket autenticado e mídia via um worker mediasoup. O cliente usa mediasoup-client e captura nativa do navegador/Electron. Coturn fornece STUN/TURN com credenciais temporárias. Não há dependência de serviço de mídia Cloud, emissor anônimo de tokens ou segredo de servidor no aplicativo.

Instale dependências com `npm ci`, valide com `npm run verify` e inicie com `npm run dev`. O cliente suportado para comunidade é Electron. O código Tauri legado conserva autenticação local, mas ainda não implementa a ponte de comunidade e não deve ser publicado como cliente equivalente.

Para preparar um backend de teste, execute `npm run community:setup -- --member seu_username`, configure o arquivo privado gerado conforme [.env.example](.env.example) e execute `npm run community:start`. Para teste local, use `CONTALK_REALTIME_URL=ws://127.0.0.1:8789/realtime` e IP de mídia 127.0.0.1. No aplicativo, conecte a comunidade com endereço HTTP loopback e a chave individual do username correspondente. Nenhuma conta demo é criada.

Instalação de produção, DNS, portas, preservação de volumes, rollback e aceite com quatro usuários: [Meteor Cloud / Coolify](docs/meteor-voice.md). Não use o Compose de produção sem identificar primeiro o volume já existente. `npm run build:electron` gera o instalador Windows; a publicação segue o fluxo abaixo.

## Validação

- `npm run verify`: tipos e testes de permissões, mensagens, persistência, sessões WebSocket e controles.
- `node tests/run-community-voice-smoke.mjs`: quatro clientes Electron isolados, worker real, mídia sintética, reconexão e revogação no servidor; sem contas/arquivos de produção.
- `node scripts/verify-community-vps.mjs`: saúde pública; com `CONTALK_VERIFY_TOKEN`, identidade, snapshot e autenticação WebSocket. Não testa mídia da VPS.

Interface: [tipografia e transmissões](docs/interface-and-streams.md), [barra de título](docs/title-bar.md), [serviço de comunidade](docs/community-service.md), [IA compartilhada e projetos privados](docs/ai-projects.md).

## Atualizações do Electron (Windows)

O instalador Electron usa `electron-updater` com GitHub Releases. A verificação ocorre ao iniciar, a cada cinco minutos e ao focar a janela. O sino mostra a versão disponível e suas notas. Ao autorizar a atualização, o aplicativo baixa, instala silenciosamente e reabre; esse processo encerra chamadas e transmissões. A distribuição das atualizações usa o GitHub, independentemente do serviço de comunidade.

Para publicar usando o próprio computador, sem GitHub Actions:

1. Atualize a versão em `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock` (pacotes do workspace) e `src-tauri/tauri.conf.json`.
2. Escreva `RELEASE_NOTES.md`.
3. Execute `npm ci`, `npm run build:audio`, `npm run verify` e `npm run build:electron`.
4. Faça commit na `dev/caliari`, abra o PR para `main`, confira os checks e faça o merge respeitando as proteções. Crie a tag `v<VERSÃO>` no commit integrado à `main` e envie a tag ao GitHub. Preserve e sincronize a `dev/caliari`.
5. Execute `npm run publish:electron` com o GitHub CLI autenticado. O script verifica os hashes, publica o instalador, o blockmap e `latest.yml` em um rascunho e só então torna a versão pública.

O empacotamento requer Windows x64, Visual Studio C++ Build Tools e Windows SDK 10.0.20348 ou posterior. O fluxo em `.github/workflows/release.yml` executa os mesmos passos quando uma tag é enviada; aguarde esse fluxo em vez de disputar a publicação com uma execução local. Confirme a release pública, marcada como latest, com instalador, blockmap e `latest.yml` antes de informar que a atualização está disponível. Os pacotes Electron e Tauri possuem atualizadores distintos; `latest.yml` é exclusivo do Electron.

## Áudio das transmissões

O Electron captura vídeo sem áudio global. O helper `native/audio-capture/main.cpp` usa WASAPI process loopback para capturar somente a árvore do processo selecionado. Para monitores, enumera janelas visíveis no monitor predominante e atualiza a seleção a cada segundo, excluindo o processo do ConTALK e seus filhos. Janelas minimizadas não entram nessa seleção. O áudio capturado vai para uma faixa WebRTC separada, sem ser reproduzido localmente.

É necessário Windows 10 build 20348 ou Windows 11. Janelas/abas do mesmo processo não podem ser isoladas umas das outras por esse método. Use compartilhamento de aba no navegador para áudio exclusivo de uma aba. Nunca há fallback para o som geral do computador; uma falha de captura aparece no seletor ou no palco de voz.

`npm run verify` verifica tipos do frontend e do Electron, o buffer de áudio e a inicialização nativa. O teste nativo usa apenas o próprio processo do teste. Para validação em chamada real, teste dois participantes e duas telas: voz da chamada, som de um aplicativo na tela compartilhada e som de outro aplicativo na outra tela; verifique também mover/fechar janelas, iniciar/parar/reiniciar a transmissão e ensurdecer durante uma nova assinatura de áudio.


## Licença

MIT
