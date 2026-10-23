# ContalK 0.1.9

- Nova tela de configurações do usuário pela engrenagem: Aparência, Voz e áudio, Minha conta e Sobre o ContalK.
- Tema Vice City inspirado no GTA VI, com pôr do sol, litoral e palmeiras em cores foscas, sem neon. O tema clássico continua disponível. A escolha é salva por conta neste computador e não altera a aparência dos outros usuários.
- Preferências pessoais de redução de animações e tamanho de texto. Edição de perfil/foto e seleção de microfone acessíveis pelas configurações.
- Excluir canais de texto e voz pelo botão ao lado do canal, pelo botão direito ou pelo cabeçalho. A confirmação mostra o que será removido. O histórico salvo do canal é apagado, e participantes em clientes atualizados saem da chamada ao receber a exclusão.
- Exclusões ficam salvas e sincronizam na presença, na reconexão e periodicamente; anúncios antigos de canais não recriam canais excluídos. Um servidor sem canais mostra opções para criar novos canais.
- Mantida a correção da 0.1.8: o volume da transmissão começa recolhido e só abre ao clicar no botão de áudio.

Todos devem atualizar para a 0.1.9 para sincronizar exclusões. A sincronização depende de pelo menos um cliente com a exclusão salva estar conectado. Preferências, histórico e registros de exclusão continuam no armazenamento local; esta versão não adiciona um backend persistente.

Validação: 46 testes automatizados; teste de interface das configurações, tema e exclusão com cancelamento, histórico, voz ativa e último canal; teste real de criação e exclusão entre dois clientes em sala LiveKit temporária; build Windows.
