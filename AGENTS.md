# Regras de trabalho do ConTALK

## Branches

- Branches de trabalho: `dev/vg` (do VG, dono do projeto) e `dev/caliari` (do Caliari). Trabalhe na branch de quem pediu; na dúvida, pergunte. Nunca altere, apague ou force push na branch da outra pessoa. Não crie outras branches.
- Manter apenas `main`, `dev/vg` e `dev/caliari`, localmente e no remoto. Integrar as alterações por PR da branch de trabalho para `main` e sincronizá-la após o merge.
- O merge na `main` faz deploy automático do serviço da comunidade no Coolify.
- Nunca editar diretamente a `main`; ela recebe as alterações pelo PR, respeitando as proteções existentes.

Quando o usuário pedir PR e merge na main, isso também autoriza e exige gerar e publicar uma nova versão estável do aplicativo, salvo se ele excluir explicitamente a publicação.

O trabalho só está concluído depois de:
- Atualizar a versão de forma consistente, escrever as notas e validar tipos, testes e build.
- Abrir o PR, conferir os checks disponíveis e fazer merge sem ignorar proteções da branch.
- Criar uma tag da nova versão no commit integrado à main.
- Gerar o instalador Windows e publicar a release com o instalador, seu blockmap e latest.yml válidos.
- Confirmar que a release está pública, marcada como latest e com os três arquivos enviados.

Merge de código não equivale a atualização publicada. Nunca dizer que basta reiniciar o app antes de confirmar a release. Não sobrescrever instaladores de versões já publicadas. Se houver bloqueio de publicação, relatar o ponto exato e continuar as etapas possíveis. Preservar a branch de trabalho do usuário.

A regra vale também para PRs de preparação de release: eles integram a mesma publicação, sem gerar outra versão recursivamente.
## Direção da interface

- Manter a interface leve e minimalista, com espaços moderados, ícones SVG discretos e botões compactos. Usar texto acessível em aria-label/title nos controles por ícone.
- Layout de referência (decisão do VG, 17/11/2026, substitui a de 27/10/2026): estrutura de barras igual à do Discord e estilo "palco primeiro". À esquerda, a coluna de servidores (Início e mensagens diretas no topo, um ícone por servidor com indicador de selecionado, não lidas e chamada, e "+" para criar ou entrar). Ao lado, a barra lateral muda conforme a seleção: Início, Amigos e mensagens diretas, ou o cabeçalho do servidor com canais e chamadas. No rodapé, "Voz conectada" durante a chamada (canal, desconectar, câmera, tela, abrir) e o card do usuário (perfil, microfone, áudio e configurações). Visual mais quadrado: raios de 6px em controles e 8px em painéis e diálogos; avatares continuam redondos. Durante uma chamada, abas "Conversa" e "Chamada" no topo da área principal: "Chamada" mostra o palco com a pílula compacta de controles (microfone, áudio, câmera, tela, desconectar) e o chat do canal numa gaveta à direita; fora dela, a chamada fica num mini-player flutuante que pode ser recolhido. Membros ficam num painel opcional à direita da conversa. Terminal continua no painel inferior.
- Temas: Menta (padrão) e Vice City (gradiente roxo, rosa e laranja, painéis translúcidos). Tokens em `src/shell.css` (`data-skin`); o CSS antigo segue ativo por baixo com `data-theme="classic"`. Toda tela, diálogo, menu e popover precisa ser conferido visualmente nos dois temas e na janela mínima (940×600) antes de dar o layout por concluído.
- Início em widgets que a pessoa recolhe ou oculta ("Personalizar início"); "Conversas recentes" começa oculta.
- Notificações (VG, 17/11/2026): entradas e transmissões na chamada são avisos rápidos que somem sozinhos, sem ir para o sino; o sino guarda mensagens diretas, menções, amizades, tópicos e eventos, e abrir o sino marca tudo como lido. Nova versão aparece como botão "Atualizar" ao lado do sino, sem abrir painel sozinha.
- Status da pessoa (Disponível, Ausente, Não perturbar, Invisível) no cartão de perfil do card do usuário; vai para os outros pelos metadados de presença. Não perturbar silencia avisos e notificações do sistema.
- Configurações do servidor em tela cheia, com menu lateral por seções (Perfil do servidor, Pessoas, Organização, Moderação), como no Discord.
- Minimizar, maximizar e fechar são desenhados pelo app (`WindowControls.tsx`); a sobreposição nativa do Windows foi desligada em `electron/title-bar.ts` para os botões seguirem o tema. As Configurações pessoais seguem o mesmo padrão das do servidor (menu à esquerda, seções com linhas, interruptores, X com ESC).
- Projetos (Kanban, Tarefas, Documentação, Roadmap) e o login social estão desativados em `src/features.ts` até serem retomados.
- Canais exibem uma engrenagem para abrir configurações, inclusive pelo menu de contexto. Renomeação e exclusão ficam nesse painel; exclusão sempre requer confirmação separada, sem lixeira de acesso direto na lista.
- No ConTALK HQ, por decisão explícita do usuário, todos os participantes são coproprietários nesta fase. O sistema de cargos deve conservar essa política inicial; não selecionar um proprietário exclusivo automaticamente. Não apresentar cargos ou permissões individuais como disponíveis antes de implementá-los de fato.

## Retomada e escopo

- Antes de continuar funcionalidades, ler `docs/LLM_HANDOFF.md` e conferir Git, PR e release atuais. O fechamento local confirmado da entrega fica também em `release/HANDOFF_FINAL.md`, quando existente.
- Por decisão explícita do usuário, assinaturas, impulsionamentos e monetização permanecem indisponíveis até existir um sistema de cobrança. Não apresentá-los como implementados.
