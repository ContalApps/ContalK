# ConTALK 0.1.23

- Melhorado o tratamento de falhas do Gemini: respostas HTTP temporárias são tentadas novamente até duas vezes, com intervalo crescente.
- Erros persistentes agora mostram o código HTTP ou informam quando a API exige pagamento ou créditos, sem mostrar nem registrar a chave pessoal.

O ajuste precisa da mesma revisão do serviço da comunidade na VPS. Depois da atualização, uma nova chamada no canal de IA confirmará se o problema era transitório ou mostrará a causa que o provedor retornou. Não houve acesso à chave pessoal nem teste pago real durante a preparação desta versão.

Validação local: tipos, 294 testes e build. O teste de Gemini simula uma falha temporária seguida de sucesso, uma falha persistente e falta de créditos. Não houve chamada real à API nesta entrega.
