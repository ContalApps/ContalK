# ConTALK 0.1.17

- Corrigida a implantação na VPS com mediasoup e coturn, incluindo a rede privada de mídia e a seleção da interface do relay.
- Ajustada a configuração Compose do Coolify para preservar o volume existente da comunidade e carregar as variáveis de implantação corretamente.
- Mantida a autenticação de mídia por tickets temporários e credenciais TURN geradas pelo servidor.

O protocolo do aplicativo permanece compatível com a versão 0.1.16. Esta publicação acompanha as correções de infraestrutura; o instalador sozinho não configura a VPS.

As contas, senhas com hash e perfis ainda são locais ao computador. Mensagens dos canais e cargos persistem no volume da comunidade; anexos dependem do serviço separado de arquivos/Telegram já previsto. Não há migração para contas centrais nesta versão.

Validação: tipos, 111 testes aprovados (três ignorados) e build frontend/Electron aprovados. Na VPS, quatro clientes Electron trocaram mídia sintética por conexão direta e relay TURN forçado, em UDP e TCP, com reconexão. O volume existente foi preservado. Microfones físicos, captura WASAPI e quatro redes independentes ainda precisam de teste com os participantes. O instalador Windows é gerado pelo workflow de release.
