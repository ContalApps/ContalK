# ContalK 🎙️

Um aplicativo desktop de comunicação por voz e vídeo estilo Discord, construído com **Rust + Tauri + React** e usando **LiveKit** como SFU open-source.

## Arquitetura

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Backend/Desktop:** Rust + Tauri v2
- **Mídia (Voz/Vídeo/Stream):** LiveKit Server (SFU) via Docker
- **Estado:** Zustand
- **Protocolo:** WebRTC (via LiveKit SDK)

## Pré-requisitos

- [Rust](https://rustup.rs/) (1.99+)
- [Node.js](https://nodejs.org/) (20+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para o LiveKit Server)

## Como Rodar

### 1. Iniciar o LiveKit Server (SFU)

```bash
docker compose up -d
```

Isso sobe dois containers:
- `contalspeak-livekit` — SFU na porta `7880`
- `contalspeak-token-server` — Gerador de tokens JWT na porta `3001`

### 2. Instalar dependências do frontend

```bash
npm install
```

### 3. Rodar em modo desenvolvimento

**Opção A: App Desktop Completo (Tauri v2 + WebView2)**
```bash
npm run tauri dev
```
*(ou `npx tauri dev` / `cargo tauri dev` se você tiver o CLI global instalado)*

**Opção B: Modo Web / Preview no Navegador**
```bash
npm run dev
```
Acesse `http://localhost:5173`. O app funciona tanto no desktop quanto diretamente no navegador com fallback de autenticação e conexão WebRTC LiveKit!

### 4. Build de produção

```bash
npm run tauri build
```

O instalador `.exe` será gerado em `src-tauri/target/release/bundle/`.

## Contas

Crie sua conta na tela de cadastro. Não são criadas contas de demonstração.

## Estrutura do Projeto

```
contalspeak/
├── src/                    # Frontend React/TypeScript
│   ├── App.tsx             # Layout principal estilo Discord
│   ├── main.tsx            # Entry point do React
│   └── index.css           # Tailwind CSS v4 + tema Discord
├── src-tauri/              # Backend Rust/Tauri
│   ├── src/main.rs         # Entry point do Tauri
│   ├── tauri.conf.json     # Configuração do app
│   └── icons/              # Ícones do app
├── crates/
│   └── contalspeak-core/   # Lógica de negócios compartilhada
├── scripts/
│   └── token-server.mjs    # Servidor de tokens JWT para dev
├── docker-compose.yml      # LiveKit Server + Token Server
├── livekit.yaml            # Configuração do LiveKit
├── Cargo.toml              # Workspace Rust
├── package.json            # Dependências do frontend
└── vite.config.ts          # Configuração do Vite
```

## Endpoints de Desenvolvimento

| Serviço | URL | Descrição |
|---------|-----|-----------|
| LiveKit SFU | `ws://localhost:7880` | WebSocket do SFU |
| Token Server | `http://localhost:3001/token?room=geral&identity=user1` | Gera token JWT |
| Health Check | `http://localhost:3001/health` | Status do token server |
| Vite Dev | `http://localhost:5173` | Frontend em dev mode |

## Credenciais de Desenvolvimento

As credenciais padrão estão no `livekit.yaml` e `token-server.mjs`:
- **API Key:** `devkey`
- **API Secret:** `secret`

⚠️ **Nunca use estas credenciais em produção.**

## Funcionalidades Implementadas

- [x] Autenticação SQLite local no Tauri v2 com hashing bcrypt e tokens JWT
- [x] Fallback transparente para execução no navegador (`npm run dev`)
- [x] Integração completa com LiveKit SFU WebRTC (`useVoiceStore`)
- [x] Canais de voz em tempo real com indicador visual de fala (green ring)
- [x] Controles de chamada: Mutar/Desmutar microfone, Ensurdecer, Câmera e Compartilhamento de Tela
- [x] Palco de voz (`VoiceStage`) estilo Discord com grade de participantes
- [x] Canais de texto interativos com envio de mensagens, cores de usuário e rolagem automática
- [x] Servidor de tokens JWT com suporte assíncrono corrigido no LiveKit Server SDK
- [x] Contas de teste pré-semeadas (`seed_users.py`)

## Próximos Passos

- [ ] Persistência de mensagens de chat em SQLite
- [ ] Configurar servidor STUN/TURN público para conexões fora da rede local
- [ ] Empacotamento final com instalador assinado (.msi/.exe)

## Licença

MIT
## Atualizações do Electron (Windows)

O instalador Electron usa `electron-updater` com GitHub Releases. Não é preciso manter servidor de atualização. Instale manualmente a versão 0.1.2 uma vez; ela consulta novas versões ao iniciar e a cada 30 minutos. O usuário escolhe baixar e reiniciar. Reiniciar encerra chamadas e transmissões.

Para publicar usando o próprio computador, sem GitHub Actions:

1. Atualize a versão em `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock` (pacotes do workspace) e `src-tauri/tauri.conf.json`.
2. Escreva `RELEASE_NOTES.md`.
3. Execute `npm ci`, `npm run build:audio`, `npm run verify` e `npm run build:electron`.
4. Faça commit, crie a tag `v<VERSÃO>` nesse commit e envie o commit e a tag ao GitHub.
5. Execute `npm run publish:electron` com o GitHub CLI autenticado. O script verifica os hashes, publica o instalador, o blockmap e `latest.yml` em um rascunho e só então torna a versão pública.

O empacotamento requer Windows x64, Visual Studio C++ Build Tools e Windows SDK 10.0.20348 ou posterior. O fluxo em `.github/workflows/release.yml` executa os mesmos passos se o GitHub Actions estiver disponível. Os pacotes Electron e Tauri possuem atualizadores distintos; `latest.yml` é exclusivo do Electron.

## Áudio das transmissões

O Electron captura vídeo sem áudio global. O helper `native/audio-capture/main.cpp` usa WASAPI process loopback para capturar somente a árvore do processo selecionado. Para monitores, enumera janelas visíveis no monitor predominante e atualiza a seleção a cada segundo, excluindo o processo do ContalK e seus filhos. Janelas minimizadas não entram nessa seleção. O áudio capturado vai para uma faixa LiveKit separada, sem ser reproduzido localmente.

É necessário Windows 10 build 20348 ou Windows 11. Janelas/abas do mesmo processo não podem ser isoladas umas das outras por esse método. Use compartilhamento de aba no navegador para áudio exclusivo de uma aba. Nunca há fallback para o som geral do computador; uma falha de captura aparece no seletor ou no palco de voz.

`npm run verify` verifica tipos do frontend e do Electron, o buffer de áudio e a inicialização nativa. O teste nativo usa apenas o próprio processo do teste. Para validação em chamada real, teste dois participantes e duas telas: voz da chamada, som de um aplicativo na tela compartilhada e som de outro aplicativo na outra tela; verifique também mover/fechar janelas, iniciar/parar/reiniciar a transmissão e ensurdecer durante uma nova assinatura de áudio.

## Perfis, presença e canais (0.1.3)

A sala LiveKit `contalk-community-presence-v1` mantém a presença dos clientes autenticados sem abrir o microfone. Nome, avatar e descrição são compartilhados por metadados; canais e mensagens usam mensagens confiáveis de dados. Avatares são recortados no navegador para 160 × 160 e compactados em JPEG antes de serem salvos. O menu de botão direito nos ocupantes da barra esquerda controla o volume recebido e o silenciamento local.

Não existe cadastro central de contas. Contas são armazenadas no computador; o diretório combina contas locais e pessoas conhecidas na presença. Clientes offline não recebem mensagens novas nem alterações imediatamente. Canais e histórico são persistidos no armazenamento local, e canais conhecidos são compartilhados ao conectar. Todos devem atualizar para a 0.1.3 para participar dessa sincronização. Um backend persistente ainda é necessário para cadastro global, histórico central, autenticação entre dispositivos e permissões de administração.

Validação manual recomendada: conectar três contas em computadores diferentes; alterar foto e nome durante uma chamada; verificar entrada/saída e reconexão; criar um canal, abrir no outro computador e entrar em voz; usar o botão direito para ajustar o volume; reiniciar e confirmar que foto e canais continuam salvos.

## Entrada do microfone (0.1.4)

Use a engrenagem na barra inferior esquerda para selecionar o microfone físico. O botão de teste usa apenas uma captura local e um medidor; não conecta o áudio aos alto-falantes nem publica a captura no LiveKit. A captura de voz é independente da captura de tela, com mono, supressão de ruído, cancelamento de eco e ganho automático desativado. As entradas de loopback conhecidas são rejeitadas pelo nome antes da publicação. Essa detecção não substitui a escolha correta do dispositivo e não garante rejeição de todo mixer virtual existente.

Para investigar vazamento do Discord sem transmissão: com fones, fique em silêncio enquanto outra pessoa fala no Discord e observe o medidor. Se ele reagir na entrada física correta, verifique o mixer/driver e o cabo/adaptador do headset. Não é possível separar com garantia vozes já misturadas pelo hardware na mesma entrada. O teste no equipamento afetado permanece necessário.

## Regressões de conexão (0.1.5)

Tokens de sala concedem `canUpdateOwnMetadata` por meio de `shared/livekit-grant.mjs` (Electron, navegador e servidor local); o Tauri usa o mesmo campo no JWT Rust. Não são concedidas permissões de administração. Atualizações de perfil não fazem parte do caminho crítico da conexão de voz/presença. Tentativas canceladas são descartadas por geração e conexões com falha são encerradas explicitamente.

`node tests/run-live-smoke.mjs` executa um diagnóstico opt-in no LiveKit configurado, em sala temporária isolada: confirma conexão, nome/metadados, envio de dados, publicação/remoção de uma faixa de áudio silenciosa gerada e desconexão. Não abre microfone nem câmera, não entra na sala de presença e remove a sala temporária ao terminar. Requer acesso de rede e o runtime Electron instalado. Os testes sem rede estão em `npm run verify`.

## Atualização silenciosa (0.1.6)

O botão de atualizar autoriza o ciclo completo: baixar, instalar silenciosamente (`quitAndInstall(true, true)`) e reabrir. A janela Electron exibe progresso real durante o download. Antes de sair, o aplicativo copia o helper Win32 e a logo para uma pasta temporária, inicia a janela independente e salva um marcador de versão/evento no diretório de dados do usuário. A nova versão sinaliza a conclusão somente após carregar a janela principal. A instalação tem barra animada, pois NSIS não expõe uma porcentagem real ao atualizador.

O hook `build/installer.nsh` converte apenas instalações `--updated` para silenciosas. Ele também mostra um indicador de instalação para clientes antigos que ainda chamam o instalador em modo interativo. Instalações manuais continuam com escolha de diretório. O helper usa evento nomeado e não instala arquivos; o instalador verificado pelo electron-updater continua responsável pela instalação. A ausência de confirmação após três minutos produz uma mensagem para verificar o aplicativo.

O build nativo (`npm run build:audio`) compila os helpers de áudio e atualização. Os testes verificam as flags de instalação, o início automático após download, recuperação de falhas e o encerramento da janela independente por evento. A atualização completa sobre uma instalação existente não é executada automaticamente pelos testes.
