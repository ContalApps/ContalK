# Regras de trabalho do ContalK

Quando o usuário pedir PR e merge na main, isso também autoriza e exige gerar e publicar uma nova versão estável do aplicativo, salvo se ele excluir explicitamente a publicação.

O trabalho só está concluído depois de:
- Atualizar a versão de forma consistente, escrever as notas e validar tipos, testes e build.
- Abrir o PR, conferir os checks disponíveis e fazer merge sem ignorar proteções da branch.
- Criar uma tag da nova versão no commit integrado à main.
- Gerar o instalador Windows e publicar a release com o instalador, seu blockmap e latest.yml válidos.
- Confirmar que a release está pública, marcada como latest e com os três arquivos enviados.

Merge de código não equivale a atualização publicada. Nunca dizer que basta reiniciar o app antes de confirmar a release. Não sobrescrever instaladores de versões já publicadas. Se houver bloqueio de publicação, relatar o ponto exato e continuar as etapas possíveis. Preservar a branch de trabalho do usuário.

A regra vale também para PRs de preparação de release: eles integram a mesma publicação, sem gerar outra versão recursivamente.
