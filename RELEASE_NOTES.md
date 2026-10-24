# ConTALK 0.1.15

- A engrenagem do servidor permite acessar os cargos e configurar a comunidade mesmo antes de informar o endereço da VPS.
- Tela de conexão com estado de configuração pendente. O endereço HTTPS e a chave individual podem ser informados posteriormente, sem recompilar o aplicativo.
- Ao configurar ou trocar a conexão da comunidade, a presença é reconectada e a chamada anterior é encerrada para aplicar o acesso central. Alterações comuns de cargos não encerram a chamada.
- Preparação da VPS com geração de chaves individuais, proteção contra substituição de configurações existentes e endereço inicialmente opcional.
- Pacote de implantação com Docker Compose, volume persistente para cargos e histórico, verificação de saúde e proxy HTTPS. Inclui guia de configuração, backup e atualização.

O ConTALK HQ mantém todos os participantes provisionados como coproprietários nesta fase. A publicação não implanta nem ativa a VPS automaticamente: o endereço, as credenciais privadas de voz e os serviços opcionais de arquivos serão configurados posteriormente.

Validação: tipos, 113 testes automatizados, build de produção e testes de interface no Electron. O serviço real foi iniciado a partir da configuração gerada, recebeu alterações de duas contas e preservou cargos, atribuições e auditoria após reiniciar. O fluxo sem endereço e a conexão pelo painel de cargos também foram validados. A execução do contêiner e a emissão de certificado serão conferidas na implantação da VPS.
