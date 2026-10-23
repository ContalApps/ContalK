# Interface e transmissões do ConTALK

A família padrão é Google Sans, fornecida em `Google_Sans.zip` pelo responsável pelo projeto. Os arquivos variáveis normal e itálico são distribuídos localmente em `public/fonts/`, junto à licença OFL. O aplicativo não depende de baixar fontes durante o uso.

O texto comum usa peso 400, controles usam 500, destaques usam 600 e títulos usam 650–700. O tamanho óptico é automático, respeitando o intervalo 17–18 da fonte fornecida. Rótulos pequenos usam o eixo GRAD para ganhar contraste sem alterar sua largura. Código e teclas preservam uma fonte monoespaçada.

O canal de voz lista todas as transmissões em duas colunas. Cada nova dupla ocupa uma linha; a grade tem rolagem vertical independente. Uma única transmissão aproveita a área disponível. A lateral de membros e os controles do card de usuário permanecem acessíveis.

O botão de tela cheia de cada transmissão abre o palco inteiro com aquela pessoa selecionada. O seletor permite acrescentar ou remover pessoas e escolher **Ver todas**, que também acompanha transmissões iniciadas depois. A última tela selecionada não pode ser desmarcada; se todas as escolhidas pararem, o palco acompanha as transmissões restantes. Quando ninguém está transmitindo, aparece um estado vazio. Esc ou o botão de saída restaura a interface.

As notas da release seguem no estado do atualizador do Electron até o renderer. Ao receber uma versão nova, o sino abre um aviso abaixo dele uma vez por versão durante aquela sessão. Fechar o aviso não faz com que ele reabra em cada consulta; o sino continua disponível. O aviso informa a versão e mostra as notas como texto, sem executar HTML remoto. Notas ausentes têm uma mensagem explícita. O caminho alternativo Tauri usa o corpo da atualização.

O nome exibido, atalhos, título da janela, instalador e documentação usam **ConTALK**. Identificadores técnicos de armazenamento, `appId`, URLs do repositório e eventos do atualizador legado permanecem estáveis para preservar dados locais e a atualização de instalações anteriores. O servidor padrão salvo com a grafia anterior passa a se chamar ConTALK HQ; nomes personalizados são preservados.

Validação: `npm run verify`, `npm run build` e `node tests/run-ui-smoke.mjs`. Quando o runtime não estiver em `node_modules/electron/dist`, o diagnóstico aceita `ELECTRON_PATH` com o caminho de um executável Electron local. O diagnóstico usa dados temporários, verifica fonte embarcada, grade com 12 transmissões, seleção em tela cheia e avisos de atualização, e salva capturas em `release/ui-smoke/`.
