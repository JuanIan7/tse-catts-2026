# Recálculo administrativo e notificações de avaliação

## Objetivo

Permitir que o administrador corrija avaliações de forma auditável enquanto a
classificação automática ainda é aperfeiçoada. Cada simulação concluída avisa
o administrador, pode receber apontamentos do aluno, ser recalculada a partir
das marcações salvas e ter a nota corrigida enviada ao aluno.

## Escopo

### Notificação ao administrador

- Ao encerrar uma simulação, registrar uma notificação de revisão e tentar
  enviar um e-mail para `ADMIN_NOTIFICATION_EMAIL`.
- O e-mail contém aluno, nota, horário e link direto ao relatório no painel.
- A indisponibilidade de `RESEND_API_KEY` ou uma falha no provedor nunca
  impede o encerramento da simulação. O painel exibe o estado pendente/erro e
  permite reenvio.
- As configurações serão lidas de `RESEND_API_KEY`, `RESEND_FROM` e
  `ADMIN_NOTIFICATION_EMAIL` (inicialmente `juanhanzi@gmail.com`).

### Revisão administrativa

- Somente administradores podem ver os controles de revisão.
- O painel conserva as marcações locais até a atualização da página e permite
  salvar as marcações no histórico.
- O botão **Recalcular nota** usa a transcrição original e as marcações
  administrativas persistidas para produzir e salvar uma nova avaliação.
- O relatório guarda a nota anterior, a nota recalculada, data e administrador
  responsável para rastreabilidade.
- O botão **Enviar nova nota por e-mail** envia o resumo atualizado ao e-mail
  autenticado do aluno. Sem e-mail de conta, informa a indisponibilidade sem
  alterar a avaliação.

### Apontamento pelo aluno

- No resultado da simulação, há um bloco compacto: **Faltou avaliar alguma
  ferramenta?**
- O aluno pode selecionar uma ou mais ferramentas e enviar o apontamento.
- O envio não altera nota, transcrição ou marcações; cria um registro de
  pendência associado à avaliação e dispara/agenda o aviso ao administrador.
- O painel mostra os apontamentos para orientar a revisão manual.

## Dados e permissões

- Uma migração acrescentará ao relatório de avaliação os metadados de revisão
  e uma tabela de apontamentos do aluno.
- Políticas RLS permitem que o aluno crie e consulte somente apontamentos da
  própria simulação; administrador consulta todos e executa recálculo/envio.
- Histórico de envio registra destinatário, tipo, tentativa, estado e erro
  sanitizado. Chaves de e-mail nunca são expostas ao navegador.

## Tratamento de erros

- Marcação local não desaparece por falha de persistência e entra no PDF.
- Falhas de e-mail ficam visíveis no painel e podem ser reenviadas.
- Falhas no recálculo não substituem a nota existente.
- A interface não oferece controles administrativos ao aluno.

## Validação

- Testes unitários para a composição da nota com marcações revisadas.
- Testes de permissão para ações administrativas e apontamentos do aluno.
- Testes do adaptador de e-mail com provedor simulado, incluindo falha sem
  interromper o encerramento.
- Build de produção e verificação manual dos fluxos de recálculo, reenvio e
  apontamento.
