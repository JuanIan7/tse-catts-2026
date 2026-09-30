# Personagem, recursos e fluxo de revisão

**Data:** 29 de setembro de 2026  
**Status:** aprovado para documentação; aguarda revisão final do usuário

## Objetivo

Eliminar inversões de papel e identidade do tentante, tornar as ocorrências
mais variadas e transformar o apontamento simples do aluno em um fluxo de
recurso auditável, que o administrador decide antes de recalcular e enviar a
nova nota.

## Escopo

### Personagem e repertório

- A ficha interna de cada ocorrência passa a conter uma identidade estável do
  tentante: nome, apresentação e perfil. O nome é coerente com a apresentação
  definida na ficha, não é o nome do abordador e só é revelado conforme a
  dificuldade.
- A geração continua exclusivamente no papel de tentante. Ela reage ao que foi
  dito, mas não acolhe, entrevista, orienta ou faz perguntas típicas de
  abordador.
- Uma validação pós-geração identifica inversão de papel, frases de acolhimento
  ao aluno, perguntas de entrevista e identidade incompatível. Respostas
  inválidas são refeitas uma vez e, se continuarem inválidas, substituídas por
  uma fala segura do personagem.
- O catálogo de casos é ampliado com locais, imagens seguras, nomes, temas de
  perguntas e perfis. A criação evita repetir recentemente para o mesmo aluno.

### Recurso do aluno

- O resultado da simulação terá a ação **Recurso de nota**.
- O aluno poderá selecionar uma ou várias falas, tanto próprias quanto do
  tentante. Cada item terá o identificador da transcrição, o texto exato,
  emissor e uma ou mais ferramentas alegadas.
- O envio não altera a nota automática. O recurso nasce como `PENDENTE` e
  gera o aviso administrativo já existente.

### Revisão administrativa

- O painel mostra as oito abordagens concluídas mais recentes, com data e
  horário local de encerramento, e destaca recursos pendentes.
- Para cada item do recurso, o administrador escolhe `ACEITO` ou `REJEITADO`.
  O resultado do recurso é derivado: todos aceitos = `ACEITO`; todos rejeitados
  = `REJEITADO`; mistura = `PARCIAL`.
- Aceitar itens cria ou conserva as marcações administrativas correspondentes,
  permitindo que o recálculo use apenas o que foi aprovado.
- A nota recalculada é exibida no painel como prévia. O administrador decide,
  em uma ação separada, se envia a nota atualizada ao aluno por e-mail.
- A revisão manual permanece disponível mesmo sem recurso enviado.

### Marcação administrativa

- Os ícones de fala funcionam como seleção persistente e múltipla.
- A barra fixa mostra quantas falas estão selecionadas, permite limpar a
  seleção e aplica uma ferramenta a todas as falas selecionadas sem removê-las
  da seleção.
- Cada marcação continua visível localmente até ser removida, salva ou a página
  ser atualizada. O PDF inclui as marcações visíveis e os recursos decididos.

### E-mail e auditoria

- Todo envio registra `SENT`, `PENDING` ou `FAILED`, com o motivo técnico
  sanitizado retornado pelo provedor.
- A interface exibe uma mensagem compreensível e preserva o detalhe no painel
  administrativo. A falha de e-mail não desfaz nota, recurso ou decisão.
- Continuam usados `RESEND_API_KEY`, `RESEND_FROM` e
  `ADMIN_NOTIFICATION_EMAIL`.

## Modelo de dados

Novas entidades:

- `evaluation_appeals`: recurso por sessão, autor, situação, decisão,
  pontuação anterior/recalculada e carimbos de data/hora.
- `evaluation_appeal_items`: falas e ferramentas alegadas, com a decisão por
  item e a marcação administrativa gerada quando aceita.

As tabelas de marcações, recálculos e logs de notificação existentes permanecem
como fonte de auditoria. Políticas RLS garantem que alunos criem/leiam apenas
os próprios recursos, enquanto administradores leem e decidem todos eles.

## Fluxo

1. O aluno seleciona falas e ferramentas e envia o recurso.
2. O recurso e seus itens são persistidos; o administrador recebe aviso.
3. O administrador abre o recurso, aceita ou rejeita item a item.
4. Itens aceitos viram marcações válidas; o sistema recalcula a prévia.
5. O administrador confirma o recálculo e, quando desejar, envia a nova nota.
6. Nota, decisão e tentativa de e-mail ficam auditáveis.

## Tratamento de falhas

- Recurso inválido (fala de outra sessão, texto adulterado ou ferramenta
  inexistente) é recusado no servidor.
- O recálculo exige um administrador autenticado e uma avaliação existente.
- Se o Resend recusar o envio, a causa é registrada e exibida; o botão pode ser
  usado novamente após a configuração ser corrigida.
- A resposta do personagem nunca é gravada antes de passar pela validação de
  papel e identidade.

## Testes

- Personagem: inversão de papel, pergunta de entrevistador, nome do aluno e
  identidade incompatível são bloqueados; fala segura é usada como fallback.
- Recursos: várias falas, ambos emissores, várias ferramentas e bloqueio de
  sessão/aluno indevidos.
- Decisão: aceita, rejeitada e parcial; só itens aceitos influenciam a prévia.
- Painel: oito sessões exibem data/hora; seleção múltipla não se perde ao
  aplicar ferramenta.
- E-mail: sucesso, configuração ausente e recusa do provedor mantêm o estado
  correto e não duplicam o recálculo.

## Fora de escopo

- Notificações por WhatsApp.
- Alterar avaliações já concluídas sem decisão administrativa explícita.
- Expor ficha interna, prompts ou dados de outros alunos ao aluno recorrente.
