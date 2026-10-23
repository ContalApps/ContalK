# Barra de título do ConTALK

A janela principal usa `titleBarStyle: hidden` com `titleBarOverlay`. Minimizar, maximizar/restaurar e fechar continuam sendo controles nativos do Windows. Fechar segue o fluxo existente de esconder a janela na bandeja. A área livre da barra permite arrastar a janela; botões, campos e painéis são marcados como áreas sem arraste.

À esquerda ficam voltar e avançar; no centro, o servidor/canal ou a área aberta; à direita, busca, sino, ajuda e perfil. A barra mede 36 pixels de interface. As variáveis CSS da Window Controls Overlay reservam a área nativa, e o Electron ajusta a altura dos controles à escala escolhida pelo usuário. As cores acompanham o tema pessoal. A barra também existe na entrada e no carregamento do aplicativo.

O histórico guarda até 50 destinos, incluindo a conversa direta selecionada. Visitar uma área depois de voltar descarta o trecho de avanço. Restaurar um destino não entra nem sai de chamadas. Se o canal do destino já foi excluído, a navegação usa um canal existente ou o estado vazio.

Ctrl+K abre a busca, que filtra pessoas e mensagens da área aberta. F1 abre a ajuda local. Alt+seta esquerda/direita percorre o histórico sem interferir na edição de texto. Esc fecha o painel focado. Os atalhos de busca e ajuda continuam funcionando quando seus ícones são ocultados em Configurações → Aparência → Barra de título. A preferência é salva por conta neste computador; o sino permanece disponível.

Somente a janela principal e seu frame principal podem solicitar mudanças de tema e escala dos controles nativos. O preload expõe uma operação específica, validada no processo principal; não expõe comandos arbitrários da janela.

Validação: testes de navegação, persistência por conta e validação de IPC; diagnóstico no Electron com a configuração real da barra, espaço reservado nas escalas 80%/125%, busca, ajuda e restauração de conversa. Capturas em `release/ui-smoke/`.
