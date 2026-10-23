# ContalK 0.1.11

- Interface mais próxima do novo design de referência: cores neutras, roxo nos destaques, cabeçalho compacto, canais agrupados e lista de membros mais leve.
- Microfone, áudio, câmera, compartilhamento e desconexão concentrados no card inferior esquerdo, com ícones discretos. As setas ao lado do microfone e fone abrem a seleção de dispositivos.
- Transmissões com participantes e controle de volume no rodapé. O estado de espera desaparece quando os primeiros quadros do vídeo chegam; não são exibidos valores fictícios de resolução ou latência.
- Configurações de cada canal pela engrenagem ou clique direito. Renomeação preserva o histórico e sincroniza entre clientes atualizados. Exclusão fica dentro do painel e requer confirmação separada. Qualquer membro pode administrar os canais por enquanto; não há cargos ou permissões individuais.
- Escala da interface de 80% a 125% em Configurações → Aparência, com restauração para 100% e preferência pessoal salva por conta neste computador.
- Instância única: abrir novamente pelo atalho restaura e focaliza o ContalK já aberto, inclusive quando está na bandeja.
- Indicador de fala da bandeja ligado diretamente ao estado de voz, com processamento ativo em segundo plano, independentemente da renderização da interface.

Validação: tipos, 64 testes automatizados, build de produção e teste de interface no Electron em janela oculta, incluindo escala, controles de voz, configuração/renomeação de canais e exclusão com confirmação. Instância única também verificada com dois processos reais do Electron.

O serviço central do Telegram continua dependendo de configuração e autenticação do administrador; esta atualização não ativa a hospedagem automaticamente. Alterações de canais são retransmitidas aos clientes conectados e dependem de clientes atualizados. A fala real com janela oculta e a instalação automática entre releases ainda exigem validação manual no computador do usuário.

Os auxiliares nativos permanecem idênticos aos da release anterior; o código-fonte não mudou. A geração do instalador local reutiliza os binários oficiais verificados anteriormente.
