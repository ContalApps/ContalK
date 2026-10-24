# Sistema de cargos do ConTALK

## Referência e decisão inicial

O documento fornecido `Sistema de Cargos.docx` foi lido integralmente, incluindo o catálogo de permissões, regras de hierarquia, exceções, categorias, cargos gerenciados e roteiro de validação. A implementação tem validação local de interface, serviços e voz; sua ativação em produção ainda depende da infraestrutura e da migração descritas ao final.

O usuário determinou que **todos os participantes do ConTALK HQ sejam proprietários por enquanto**. Por isso, o servidor `srv-1` começa com a política explícita `all-members`: participantes conhecidos são coproprietários; um identificador desconhecido não recebe essa condição. Essa decisão é do ConTALK e difere da propriedade exclusiva descrita no documento do Discord. Um nome de cargo não altera a propriedade.

As regras fundamentais foram conferidas na [referência técnica de permissões](https://docs.discord.com/developers/topics/permissions): combinar permissões, avaliar exceções por canal e membro em ordem, conservar bits extensos como strings decimais e respeitar hierarquia na administração. A [visão geral de cargos](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions) orienta a organização visual e os limites administrativos. Os [estados de permissão por canal](https://support.discord.com/hc/en-us/articles/10543994968087-Channel-Permissions-Settings-101) distinguem autorização, negação e herança. Consulta em 23 de outubro de 2026.

## Modelo e cálculo

Cada servidor possui um cargo-base `@everyone`, obrigatório e não atribuível manualmente. Os demais cargos têm identificador, nome de até 100 caracteres, posição, permissões, cores, estilo, ícone, destaque na lista, opção de menção e origem de gerenciamento. A referência limita a estrutura a 250 cargos por servidor. A cor visível vem do cargo mais alto que forneça uma cor; cargos sem cor não apagam as cores inferiores. Organização visual não concede autoridade.

O cálculo parte do cargo-base e combina as permissões dos cargos atribuídos. Proprietários e Administrador possuem exceções explícitas. No canal, aplicam-se as decisões de `@everyone`, depois as negações e autorizações agregadas dos demais cargos e, por último, a exceção individual. Um cargo superior não cancela por si só um inferior. A atribuição de uma autorização pode prevalecer sobre a negação de outro cargo no mesmo nível de avaliação.

A ausência de visualização impede as ações dependentes do canal. A ausência de envio impede anexos, prévias e outras formas dependentes de publicação. Conectar e falar são permissões separadas. Timeout é um estado com prazo, separado dos cargos; não deve remover as atribuições do membro. O cálculo precisa distinguir as restrições temporárias da alteração permanente de uma função.

As categorias possuem suas próprias exceções. Canais sincronizados acompanham a categoria; os demais conservam suas decisões locais. Editar as exceções de um canal deve indicar que ele foi desassociado da sincronização. A opção de sincronizar novamente deve ser explícita.

## Administração e identidade visual

Criar, editar, reordenar, excluir, atribuir e remover cargos são operações distintas. Gerenciar cargos permite atuar abaixo do cargo mais alto do operador. O operador não pode conceder capacidades que não possui. Administrador ignora as exceções de canal, mas não elimina todas as restrições de hierarquia em ações contra outros membros. A exclusão deve limpar as atribuições e as exceções que referenciam o cargo, preservar `@everyone` e exigir confirmação.

A administração deve oferecer busca de membros, múltiplas atribuições, identificação de cargos gerenciados, agrupamento por cargo destacado e pré-visualização como um ou vários cargos. A pré-visualização não deve conceder privilégios reais ao observador nem simular estado de áudio individual inexistente. As cores e os ícones precisam aparecer de maneira consistente nas mensagens, perfis e listas de membros.

Menções de cargo dependem da opção de cargo mencionável ou da permissão de menções amplas do emissor. Receber notificações de menções de cargo também depende da preferência do destinatário. Menções não podem expor canais aos quais o destinatário não tem acesso.

## Catálogo de capacidades

O módulo de cálculo contempla o catálogo do documento, incluindo bits superiores a 32: servidor e canais, cargos, auditoria, convites, expulsão, banimento, apelidos, timeout, leitura, histórico, publicação, links, anexos, menções, reações, enquetes, fixação, modo lento, tópicos, voz, vídeo, transmissão, moderação de voz, eventos, expressões, aplicações, webhooks, atividades e análises. Uma permissão só deve ser apresentada como uma função executável quando a operação correspondente estiver implementada e autorizada no destino que a processa.

O documento também descreve recursos específicos do ecossistema Discord: impulsionamento, assinaturas, bots, integrações, conexões verificadas e palcos. No ConTALK, não se deve simular uma assinatura, uma conexão de conta ou uma verificação externa apenas pelo navegador. Cargos desse tipo exigem uma origem identificada e uma concessão verificada; cargos gerenciados não devem ser concedidos ou removidos manualmente como cargos comuns. Estilos gradientes, holográficos e ícones podem existir como apresentação do ConTALK sem alegar que o aplicativo oferece os planos comerciais do Discord.

## Autoridade e sincronização

No modo legado, presença e mensagens usam transporte LiveKit entre clientes, e o cliente participa da emissão dos tokens de sala. Esconder botões não transforma esse transporte em uma autoridade confiável. No modo central, operações, destinatários e capacidades são validados no serviço que entrega mensagens, autorizações de arquivos, tokens de voz e mudanças administrativas. As restrições de canal impedem a entrega a destinatários sem acesso; a migração das credenciais legadas continua necessária para proteger a voz contra clientes antigos alterados.

Para o HQ, a política atual de copropriedade permite administrar a estrutura sem escolher um dono arbitrário. Essa exceção não deve ser utilizada como prova de que servidores com propriedade restrita já estão seguros. A migração deve manter histórico, IDs dos canais e preferências existentes, registrar alterações administrativas e sobreviver à reconexão e a clientes com dados antigos.

## Validação obrigatória da entrega

Os testes devem demonstrar combinação de cargos, precedência individual, conflitos entre autorizações e negações, proteção de `@everyone`, limites de hierarquia, prevenção de elevação, cargos gerenciados, sincronização de categorias, timeout, menções, apresentação e atualização após revogação. Também devem verificar operações entre clientes reais e tentativas de contornar a interface. A conclusão exige editor e atribuição de cargos, aplicação nas ações reais, sincronização e auditoria; testes do cálculo puro não bastam.

Estado atual: o cálculo e os comandos foram ligados a um serviço HTTP autenticado, com persistência, revisões, SSE e auditoria. O editor do Electron já cria, edita, ordena, exclui e atribui cargos; o menu do membro oferece atribuições e restrição temporária. Há regras de canal em três estados, categorias sincronizáveis, prévia sem privilégios do observador, cores, ícones, agrupamento e menções validadas no servidor. No modo de comunidade configurada, canais e mensagens usam comandos centrais e a voz solicita tokens com fontes limitadas pelas permissões. A interface e o serviço foram validados juntos com dois clientes autenticados.

Os downloads novos podem ser vinculados à autoridade da comunidade: o serviço de arquivos revalida o acesso tanto ao emitir o link quanto ao entregar o conteúdo. Os testes HTTP cobrem revogação, links já emitidos, compartilhamento direto e tentativa de republicar um arquivo privado sem acesso. Arquivos legados preservam sua política anterior; esse comportamento não equivale à migração dos arquivos existentes.

O teste com o LiveKit oficial executado localmente também passou: publicação de microfone sintético, interrupção ao revogar Falar, recusa de republicação, desconexão ao revogar Conectar e recusa de novo token. É uma validação com SFU real, isolado da produção. O projeto Cloud atual recusou novas conexões com HTTP 429 e `connection minutes limit exceeded`; essa restrição externa permanece.

O usuário escolheu hospedar o serviço em uma VPS e informar o endereço posteriormente. O [pacote de implantação](community-vps.md) prepara configuração e chaves sem exigir o endereço, conserva os dados em volume e oferece proxy HTTPS. No aplicativo, a engrenagem do servidor permite configurar essa conexão posteriormente. Permanecem pendentes a implantação na VPS, a migração das credenciais de voz distribuídas nos clientes anteriores e a ativação em produção. O login real da conta Telegram ainda precisa ser configurado. Recursos de plataforma inexistentes permanecem identificados como indisponíveis; não foram simuladas integrações verificadas, assinaturas ou impulsionamentos. Consulte [a execução e validação do serviço](community-service.md).
