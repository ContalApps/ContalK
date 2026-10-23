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

## Contas de Teste Pré-Configuradas

O banco SQLite local (`auth.db`) e o modo Web já possuem contas de teste prontas:

| Usuário | Senha | Nome de Exibição |
|---------|-------|------------------|
| `alice` | `alice123` | Alice Silva |
| `bob` | `bob12345` | Bob Santos |
| `carol` | `carol123` | Carol Oliveira |
| `dave` | `dave1234` | Dave Lima |

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