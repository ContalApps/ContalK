# ConTALK 0.1.20

- Seleção de provedor e modelo por canal de texto ou projeto: OpenAI, Claude, Gemini e Grok.
- Suporte a APIs que implementam OpenAI Responses ou Chat Completions, com endpoint HTTPS autorizado pelo administrador da VPS.
- Chaves pessoais separadas por provedor, protegidas no armazenamento seguro do Electron; a chave OpenAI anterior é migrada automaticamente.
- Verificação prévia de anexos e limites por provedor, com falhas identificadas antes de iniciar uma geração incompatível.
- Streaming, contagem e consumo dos provedores integrados ao histórico compartilhado, preservando as regras de acesso dos projetos.

**Ativação:** é necessário implantar esta mesma revisão do serviço da comunidade na VPS/Coolify. A implantação e os testes com APIs reais foram adiados pelo responsável pelo servidor; o instalador não atualiza a VPS nem configura chaves pessoais. Até a implantação, os recursos de IA não estarão ativos no servidor existente.

Uma API com protocolo próprio exige um adaptador específico; informar sua URL não garante compatibilidade. Agentes, MCP, execução de comandos, alterações de arquivos, assinaturas e cobrança não fazem parte desta versão.

Validação local: tipos, 282 testes e build. Os testes dos provedores usam respostas simuladas; não houve chamada paga real nem implantação na VPS nesta entrega.
