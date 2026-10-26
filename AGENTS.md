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
- Concentrar microfone, saída de áudio, câmera, compartilhamento e desconexão no card do usuário no canto inferior esquerdo; não recriar barras grandes de controles no palco de voz.
- Canais exibem uma engrenagem para abrir configurações, inclusive pelo menu de contexto. Renomeação e exclusão ficam nesse painel; exclusão sempre requer confirmação separada, sem lixeira de acesso direto na lista.
- No ConTALK HQ, por decisão explícita do usuário, todos os participantes são coproprietários nesta fase. O sistema de cargos deve conservar essa política inicial; não selecionar um proprietário exclusivo automaticamente. Não apresentar cargos ou permissões individuais como disponíveis antes de implementá-los de fato.

## Retomada e escopo

- Antes de continuar funcionalidades, ler `docs/LLM_HANDOFF.md` e conferir Git, PR e release atuais. O fechamento local confirmado da entrega fica também em `release/HANDOFF_FINAL.md`, quando existente.
- Por decisão explícita do usuário, assinaturas, impulsionamentos e monetização permanecem indisponíveis até existir um sistema de cobrança. Não apresentá-los como implementados.
