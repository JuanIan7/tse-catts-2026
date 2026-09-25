# Pontuação confiável, diversidade e silêncio inicial

## Objetivo

Evitar encerramentos e notas inconsistentes, reconhecer hostilidade verbal
grave, impedir repetição imediata de cenários e permitir registrar o silêncio
inicial exigido pelo barema.

## Ocorrências graves e encerramento

- Uma camada determinística inspeciona cada fala do aluno antes da resposta
  do personagem. Ofensas e palavrões dirigidos ao tentante produzem a
  ocorrência grave `hostilidade_verbal`, com a própria fala como evidência.
- Os sinais graves retornados pelo personagem continuam sendo registrados.
- Cada ocorrência é contabilizada, inclusive repetição da mesma categoria.
- As primeiras cinco ocorrências mantêm a sessão ativa. A sexta encerra a
  sessão imediatamente, persiste a transcrição, gera avaliação `SEM_EXITO`
  e fixa a nota final em `0.0`.
- A expressão textual “fim da abordagem” não é uma Saída Digna e não pode
  encerrar a sessão como êxito.

## Encerramento e avaliação

- Haverá uma ação explícita de encerramento manual, distinta da conversa.
  Ela encerra como parcial e calcula a nota apenas das evidências salvas.
- Os itens textualmente observáveis do diálogo sem evidência ficam como
  `nao_feito`; itens corporais/acústicos permanecem `nao_observavel`.
- A avaliação final não pode exibir `10.0` quando não houver conduta positiva
  registrada. A pontuação usa os estados persistidos e erros graves
  determinísticos; a análise final da IA apenas complementa evidências, sem
  apagar fatos já confirmados.
- A ficha mostra pontuação grande, motivo do encerramento, cada estado,
  ajuste e evidência. Feito é verde, parcial amarelo e não feito/vermelho.

## Diversidade de casos

- A biblioteca passa de três a pelo menos nove cenários: três por perfil
  comportamental, com contextos, fatores centrais, vínculos e briefings
  distintos.
- Ao criar uma sessão, o sistema consulta os últimos três títulos do usuário
  e escolhe somente entre cenários não usados nesse conjunto quando houver
  opção disponível. Assim, duas sessões consecutivas nunca repetem o mesmo
  cenário.

## Silêncio inicial

- Antes da primeira fala do aluno, a tela oferece o comando `Registrar
  silêncio inicial`.
- A ação só pode ser aplicada uma vez, persiste a evidência de sistema e
  marca o item `silencio_inicial` como `feito`.
- Não cria texto atribuído ao tentante nem resposta de voz artificial.
- Depois do primeiro turno do aluno, o comando fica indisponível.

## Validação

- Teste unitário: seis ofensas em sequência encerram e resultam em 0.0.
- Teste unitário: falta de evidência de diálogo não recebe crédito implícito.
- Teste unitário: silêncio inicial só registra uma vez e somente antes do
  primeiro turno.
- Teste unitário: seleção de cenário exclui os títulos recentes quando há
  alternativas.
- Checagem de tipos, testes existentes e build da Vercel devem passar.
