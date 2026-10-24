# ConTALK 0.1.16

- Comunicação de voz, câmera e compartilhamento migrada para WebRTC auto-hospedado com mediasoup. Removidos LiveKit Cloud, SDKs e credenciais privadas do aplicativo.
- Sessões autenticadas pela comunidade com tickets temporários de uso único, limite de quatro participantes e permissões de mídia aplicadas no servidor.
- Reconexão com novos tickets e transportes; sair durante a recuperação encerra a captura do microfone.
- Preservados controles compactos, áudio isolado das transmissões, mensagens, cargos e política de coproprietários do HQ.
- Configuração Coolify com preservação explícita do volume existente, coturn, documentação de portas, implantação, testes e rollback.

Esta versão exige o backend de comunidade atualizado e as novas configurações de mídia da VPS. Clientes antigos não são compatíveis com o novo protocolo; atualize os quatro clientes junto do backend. A release do aplicativo não configura automaticamente Coolify, firewall, TURN ou armazenamento de anexos.

As contas, senhas com hash e perfis ainda são locais ao computador. Mensagens dos canais e cargos persistem no volume da comunidade; anexos dependem do serviço separado de arquivos/Telegram já previsto. Não há migração para contas centrais nesta versão.

Validação: tipos e build aprovados; 109 testes aprovados e 3 ignorados; quatro clientes Electron com worker real, mídia sintética, RTP, reconexão, permissões e encerramento da captura; interface Electron aprovada. Rede externa, TURN, áudio físico e volumes reais da VPS ainda precisam de validação no ambiente publicado. Credenciais antigas expostas precisam ser revogadas pelo responsável.
