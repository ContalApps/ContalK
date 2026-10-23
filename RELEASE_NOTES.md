# ConTALK 0.1.12

- Google Sans variável como fonte padrão, distribuída com o aplicativo: pesos para textos, controles e títulos, tamanho óptico automático e itálico.
- Todas as transmissões do canal de voz em duas colunas, com rolagem vertical para alcançar as demais linhas.
- Tela cheia com seleção de uma, várias ou todas as transmissões. O modo “Ver todas” acompanha novas transmissões automaticamente.
- O sino abre um aviso quando uma nova versão chega, com a versão e as notas de melhorias. Fechar o aviso evita sua repetição nas consultas seguintes daquela sessão; ele continua acessível pelo sino.
- Nome ConTALK padronizado na interface, janela, atalhos, instalador e documentação. Dados locais, identificadores de atualização e nomes personalizados são preservados.
- Conteúdo central junto às barras laterais, com menos margens e espaçamentos nos canais de texto, transmissões e painel de membros.

Validação: tipos, 66 testes automatizados, build de produção e diagnóstico da interface no Electron com 12 transmissões simuladas, incluindo rolagem, seleção real em tela cheia, fonte local e aviso automático com notas da versão.

O armazenamento central no Telegram continua dependendo da configuração do administrador. O diagnóstico das 12 transmissões valida a interface com faixas simuladas; não é um teste de desempenho com 12 emissores reais. A atualização automática entre instalações deve ser conferida no computador do usuário após a publicação.

Empacotamento local: o auxiliar de áudio permanece idêntico ao binário oficial validado anteriormente. Na ausência do MSVC neste computador, o auxiliar de progresso oficial da v0.1.11 recebe somente três substituições de texto UTF-16, de mesmo tamanho, para exibir ConTALK; código executável e eventos de compatibilidade permanecem iguais. O script scripts/rebrand-update-helper.mjs exige o SHA-256 exato do original antes de ajustar os textos. O ciclo de vida do auxiliar é testado no Windows. O fluxo normal do GitHub Actions compila os dois auxiliares a partir do código-fonte.
