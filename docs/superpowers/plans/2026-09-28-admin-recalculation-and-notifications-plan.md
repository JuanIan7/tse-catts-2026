# Plano: recálculo administrativo e notificações

1. Corrigir o espaço de revisão local para conservar marcações até a atualização, permitir exportação do PDF com elas e separar salvar/repetir do ato de marcar.
2. Criar migração para apontamentos do aluno, revisões de nota e histórico de entrega de notificações, com RLS separado entre aluno e administrador.
3. Extrair o recálculo determinístico que aplica marcações administrativas sobre a avaliação existente; testar valores, rastreabilidade e proteção contra erro.
4. Adicionar actions administrativas protegidas para recalcular, reenviar alertas e enviar a nota corrigida ao aluno; expor o apontamento simples na página de resultado.
5. Criar adaptador de e-mail Resend apenas no servidor, tolerante à ausência de credenciais, e modelos curtos de aviso ao administrador e de nota corrigida ao aluno.
6. Atualizar o painel com controles de recálculo, envio/reenvio e apontamentos do aluno; preservar os controles exclusivamente administrativos.
7. Documentar as três variáveis do Vercel e o procedimento de configuração do Resend.
8. Executar testes, lint e build; solicitar revisão independente antes de publicar.
