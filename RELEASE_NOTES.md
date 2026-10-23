# ContalK 0.1.10

- Chat com escolha de prévias de links, imagens e arquivos; edição/exclusão pelo autor, menções e visualização única por usuário.
- Preparação do armazenamento central em canal privado do Telegram, com serviço separado, sessão criptografada, anexos selecionados de até 2 GB e downloads temporários. A conta central e o serviço precisam ser configurados pelo administrador antes dos uploads.
- Sino de atualizações no cabeçalho. Verificações periódicas e ao focar o app; download, instalação silenciosa e reinício automático a partir da notificação.
- Seleção de entrada pelo botão Microfone e saída pelo botão Áudio, com controles de silenciamento disponíveis no painel.
- Fechar a janela mantém o ContalK na bandeja, preservando a chamada. O menu do ícone permite Fechar ContalK e o indicador anima durante a fala local.
- Feed das novas instalações atualizado para o repositório ContalApps/ContalK.

Limitações: visualização única é uma restrição de interface, sem impedir cópia do histórico local ou captura de tela. Edição e exclusão sincronizam entre clientes conectados. A integração real com o Telegram depende da configuração central e ainda requer validação de upload/download com a conta do administrador. Imagens coladas têm limite de 1 MB.

Validação: tipos, 55 testes aprovados, incluindo os auxiliares nativos, teste de interface em janela oculta do Electron, build de produção e empacotamento Windows. Os auxiliares nativos de áudio/atualização, cujo código permanece idêntico à v0.1.9, foram recuperados do instalador oficial anterior após verificação SHA-256. Hardware físico e atualização real entre instalações ainda exigem validação manual.
