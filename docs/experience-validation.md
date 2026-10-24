# Ajustes de experiência e validação

Alterações preparadas na branch `dev/caliari` para a versão 0.1.14. A disponibilidade pública é confirmada pela release no GitHub; a implantação do serviço de comunidade é uma etapa separada.

## Interface

- Escala numérica entre 80% e 120%, com passos de um ponto, espera de 400 ms e aplicação imediata ao confirmar. A troca de escala não passa mais por um reset intermediário para 100%.
- Barra de título sem avatar; salas sem selo CALL; painel do servidor com membros, sem cartão de informações.
- Colunas recolhíveis para ícones, primeiras letras dos canais e indicadores vermelhos de transmissão nos avatares. Preferências salvas por conta.
- Removidos os chips de participantes do rodapé das transmissões. Configurações pessoais e controles de volume por pessoa ficam no menu de contexto do perfil, também disponível em tela cheia.

## Notificações e bandeja

O sino reúne mensagens, pedidos e confirmações de amizade, entradas na chamada, transmissões e atualizações. As atividades abrem o destino correspondente. Mensagens não lidas têm contadores por canal; notificações e contadores são separados por conta. A leitura da área em foco limpa seus contadores. Mensagens de visualização única não expõem seu conteúdo nos avisos.

Os avisos do Windows podem ser desativados nas configurações pessoais, conservando o sino e os contadores. Avisos repetidos são deduplicados. A animação da bandeja começa no primeiro estado de microfone ativo, sem aguardar a detecção de fala, e para ao silenciar ou desconectar. O menu da bandeja controla microfone e saída de áudio e acompanha o estado efetivo do cliente.

## Erro durante atualizações

O teste com instalação real reproduziu `TypeError: Object has been destroyed`: a limpeza da bandeja acessava `BrowserWindow.webContents` depois da destruição da janela nativa. A limpeza agora usa a referência de `WebContents` obtida antes do encerramento. O atualizador também conserva tratamento para erros tardios e evita enviar eventos a janelas destruídas. Falhas são registradas em `updates.log` no diretório de logs do Electron.

O ciclo completo foi validado com instaladores Windows de duas versões de um aplicativo de teste separado: descoberta, download, instalação silenciosa, encerramento e reabertura na versão seguinte. Nenhuma release de produção foi alterada. O teste usa identidade, instalação, perfil e cache próprios; o cache isolado evita a restrição de renomeação observada no AppData deste ambiente.

## Verificações

- `npm run verify`: tipos e 110 testes passaram na conferência de 24/10/2026, incluindo cargos, serviço de comunidade, arquivos e histórico.
- `npm run build`: build do cliente, processo principal e preload passou.
- `node tests/run-ui-smoke.mjs`: cenários reais no Electron, incluindo escala, rolagem, tela cheia, menus, leitura e navegação por notificações. Se o runtime do pacote não estiver disponível, definir `ELECTRON_PATH` para um runtime Electron compatível.
- `node tests/run-update-live-smoke.mjs`: teste opcional Windows com dois instaladores NSIS e atualização local real. Requer os auxiliares nativos e o runtime descritos na configuração do projeto; não é executado por `npm test`.
- O Windows confirmou a exibição de uma notificação nativa em um teste separado.

Os resultados detalhados e capturas locais ficam em `release/ui-smoke` e `release/update-live-smoke`, ignorados pelo Git. O sistema de cargos tem editor e aplicação central validados localmente; consulte [o estudo](roles-study.md) e [os testes de serviço, interface e SFU](community-service.md). A hospedagem e a migração das credenciais de produção continuam pendentes.
