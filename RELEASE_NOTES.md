# ConTALK 0.1.19

- Preparação do chat de IA compartilhado para canais de texto, com modelo OpenAI configurado por canal e opção de enviar mensagens apenas aos colegas.
- Subchats de projeto privados com convites de leitura, colaboração e gestão. A copropriedade do ConTALK HQ não concede acesso automático aos projetos.
- Chave OpenAI pessoal protegida no computador de cada participante; limites de contexto e saída por pedido, consumo registrado, respostas em tempo real, fila e cancelamento.
- Anexos compatíveis de até 50 MB por pedido, verificados antes da geração. O histórico guarda apenas os metadados; para reutilizar um arquivo, anexe-o novamente.
- Correções na ativação inicial do compositor de IA e no envio dos limites pessoais e do identificador da execução à ponte Electron.

**Ativação:** o chat de IA só funcionará após o serviço da comunidade na VPS/Coolify receber esta mesma revisão. A implantação e a validação real da API foram adiadas a pedido do responsável pelo servidor. O instalador não implanta a VPS nem configura uma chave OpenAI. Até essa etapa, os recursos de IA não estão disponíveis no servidor existente.

Contas e perfis continuam locais. A comunicação de voz usa mediasoup/coturn e tickets temporários. Agentes, MCP, conectores de outras IAs, alterações de projetos, assinaturas e cobrança não fazem parte desta versão.

Validação local: tipos, 278 testes e build do cliente e do Electron. Os testes de IA usam um provedor simulado; não houve chamada paga real nem implantação na VPS nesta entrega.
