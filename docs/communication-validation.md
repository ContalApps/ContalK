# Relatório de validação — 24/10/2026

Branch de correção: `codex/corrigir-comunicacao-vps`, criada conforme autorização posterior do usuário. Base: `b821d90`; árvore inicialmente limpa e branches remotas `main`/`dev/caliari` no mesmo commit.

## Executado nesta sessão

| Verificação | Resultado |
| --- | --- |
| `npm run verify` | Tipos frontend/Electron aprovados; 112 testes, 109 aprovados, 3 ignorados por requisitos nativos de ambiente |
| `npm run build` | Frontend, processo principal e preload Electron compilados; aviso de chunk JS acima de 500 kB |
| `node tests/run-community-voice-smoke.mjs` | Quatro renderers Electron + worker nativo mediasoup, em loopback; aprovado |
| Integração de mídia | Microfones sintéticos, câmera e tela sintéticas com áudio, RTP recebido por todos os consumidores esperados, mute/unmute, reconexão, revogação SPEAK/CONNECT e recusa de ticket após revogação |
| Interface Electron | Smoke visual aprovado: controles compactos, navegação, listas, configurações e transmissões preservados |
| Sessões WebSocket | Transporte real nos testes: identidade vinculada, ticket de uso único, limite de quatro, dados direcionados e encerramento por revogação |
| Persistência | Testes existentes de HTTP/SSE, cargos/mensagens e reinício aprovados; não equivale a testar o volume da VPS |
| Bundle `dist`/`dist-electron` | Busca pelo provedor removido e valores das antigas credenciais extraídas da revisão base, sem imprimir valores: nenhuma ocorrência |
| `npm audit --omit=dev --json` | Zero vulnerabilidades reportadas nas dependências de produção; não é auditoria completa da aplicação |
| `node scripts/verify-community-vps.mjs` | `/health` público aprovado; sondagens autenticadas ignoradas por ausência de chave individual de produção |
| DNS | Comunidade → 74.0.5.249; domínio opcional voz não resolvido |

Os tickets e chaves dos testes são aleatórios e isolados, armazenados somente em arquivos ignorados sob `release`. O erro `Ticket denied` do diagnóstico Electron é esperado na verificação final de revogação; o resultado consolidado foi `ok: true` para quatro participantes. O cenário legado com outro servidor de mídia foi descartado após a orientação para remover o provedor; não fundamenta a aprovação da arquitetura final.

## Pendente e não declarado aprovado

- Build/execução Docker e coturn: não há Docker instalado neste ambiente. YAML analisado localmente, sem validação `docker compose config` ou runtime de containers.
- Acesso privado ao Coolify/SSH e autenticação real de produção: nenhuma credencial disponível nesta sessão. GitHub App, webhooks, portas, volumes e rollback da VPS não foram inspecionados ou modificados.
- Mídia externa e relay TURN/NAT na Meteor; TLS e Upgrade WebSocket em produção; quatro computadores/redes reais; microfones, alto-falantes, câmera e áudio isolado WASAPI físicos.
- Build Rust/Tauri: Cargo indisponível; Tauri não implementa a ponte de comunidade usada pelo cliente Electron. Removida apenas a assinatura privada antiga.
- Publicação Windows 0.1.16 autorizada posteriormente pelo usuário: instalador, merge, tag e release serão validados pelo workflow de release. Não substituir artefatos 0.1.15. A aprovação local não confirma a conclusão dessa publicação.

Procedimentos para concluir essas etapas, variáveis, portas, rollback e teste com quatro pessoas estão em [Meteor Cloud](meteor-voice.md). A correção local não significa que a VPS ou uma atualização do aplicativo já foram publicadas.
