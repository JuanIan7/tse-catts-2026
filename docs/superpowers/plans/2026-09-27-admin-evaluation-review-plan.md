# Plano: revisão administrativa de avaliações

1. Criar migração para anotações por trecho e nota geral, com RLS exclusivo para administradores.
2. Criar tipos, validação determinística de trecho e server actions protegidas por `requireAdmin()`.
3. Criar componente cliente para selecionar um trecho de uma fala, classificá-lo e salvar/remover marcações; incluir legenda e rótulos acessíveis.
4. Consultar os cinco relatórios concluídos mais recentes no painel administrativo e renderizar a revisão.
5. Estender a exportação em PDF somente para incluir uma variante de revisão com marcações e nota geral.
6. Cobrir as regras puras com testes, executar lint, testes e build, e solicitar revisão independente.
