# ContalK 0.1.4

- Navegação separada: o balão abre mensagens diretas; Amigos abre a lista de pessoas. O botão de início permanece independente.
- Tela de amigos reformulada com cartões, fotos, filtros Online/Todos os conhecidos e busca por nome/usuário. Mensagens diretas usam o mesmo layout e mantêm a barra de canais e os controles de áudio.
- Configurações de áudio no botão de engrenagem: seleção explícita da entrada, teste local de nível, indicação do microfone em uso e detecção de entradas conhecidas de mistura/loopback.
- Captura de voz em mono, ganho automático desativado e cancelamento de eco/redução de ruído ativados.
- Entradas reconhecidas como Stereo Mix, Mixagem estéreo, CABLE Output e similares são interrompidas antes de serem publicadas como microfone. Não há fallback silencioso para outra entrada quando um dispositivo explicitamente selecionado está indisponível.
- O modo ensurdecido preserva o estado de mute anterior.
- Versão visível na barra superior para identificar instalações antigas.

O vazamento de áudio do Discord em um headset físico ainda precisa ser validado no equipamento afetado. Drivers, mixers virtuais e cabos podem entregar áudio já misturado na entrada; o aplicativo não consegue separar com garantia duas vozes que chegam na mesma faixa de microfone.
