# Progressão didática e marcação administrativa

## Objetivo

Tornar as três dificuldades treináveis e progressivas, creditar perguntas simples de forma confiável, substituir a marcação administrativa por um fluxo de balões completos e gerar um PDF-modelo de nota 10 para os alunos.

## Progressão das dificuldades

O comportamento do tentante terá regras verificáveis além da instrução ao modelo. Essas regras não inventam informações: controlam somente quando a pessoa responde e quanto resiste.

| Dificuldade exibida | Código | Abertura esperada |
| --- | --- | --- |
| Médio | `FACIL` | Responde toda pergunta simples e informa nome quando perguntado. Responde apenas ao assunto perguntado, sem entregar fatores não solicitados. |
| Difícil | `MEDIA` | Pode recusar a primeira pergunta sobre o nome e até duas perguntas simples iniciais. Na segunda pergunta sobre o nome, informa-o. Depois de duas recusas iniciais, responde às perguntas simples; mais adiante pode haver no máximo uma recusa isolada. |
| Muito difícil | `DIFICIL` | Inicia reativo. Pode recusar ou responder pouco às três ou quatro primeiras perguntas simples, mas em seguida começa a alternar resposta e resistência. Com vínculo e ferramentas adequadas, torna-se progressivamente mais aberto. |

Nenhuma dificuldade poderá bloquear cinco perguntas simples consecutivas. O personagem responde somente ao que foi perguntado, salvo quando uma ferramenta apropriada justificar aprofundamento emocional da própria resposta. Em todos os níveis, o objetivo é permitir prática, descoberta gradual de risco/proteção e oferta posterior de saída digna — nunca criar um bloqueio sem saída.

## Perguntas simples e avaliação

Uma pergunta simples é objetiva e admite resposta direta, normalmente sim ou não. O detector determinístico reconhecerá, entre outras, perguntas sobre:

- nome;
- ser casado, ter filho, pai/mãe/avós vivos;
- trabalho, prática de esporte, cachorro ou outro vínculo objetivo;
- estruturas equivalentes de “você tem…?”, “você é…?”, “seu/sua … é vivo(a)?”.

O reconhecimento será feito nos turnos do aluno antes da avaliação final, complementando — sem depender exclusivamente de — análise por modelo. Uma pergunta simples pontua 0,5. Uma pergunta simples acompanhada de aprofundamento relevante do mesmo tema, ou uma pergunta complexa identificada, completa 1,0 no item de correlação de perguntas. O histórico usado para avaliar registrará a evidência literal encontrada.

## Painel administrativo

A revisão de cada relatório passa a ter um espaço em duas colunas em telas largas:

- **Esquerda:** transcrição em área rolável, com um botão de marcação em cada balão de fala. O botão seleciona o conteúdo integral daquela fala.
- **Direita:** barra fixa durante a rolagem, com todas as ferramentas, cor, nome e explicação. Só é habilitada após selecionar um balão.

Ao escolher uma ferramenta, o balão inteiro muda imediatamente para a cor correspondente e recebe uma etiqueta textual. A ação é salva automaticamente; enquanto ela estiver sendo validada, o PDF permanece indisponível. Assim, o PDF contém somente marcações persistidas.

Uma mesma fala poderá receber múltiplas ferramentas. A primeira marcação define a cor de fundo do balão; as demais aparecem como etiquetas coloridas no próprio balão e no PDF. A mesma ferramenta poderá ser aplicada a várias falas sem limite. As categorias são: pergunta simples, pergunta complexa, paráfrase, memória linkada, maiêutica/TED, desistência/saída digna, fator de proteção, fator de risco, fator principal e observação.

Para permitir múltiplas ferramentas no mesmo balão, a persistência passará a registrar uma marcação de balão completo por tipo, sem bloquear categorias distintas na mesma fala. Continua proibida duplicidade idêntica para o mesmo balão e categoria. O acesso segue restrito ao administrador por `requireAdmin()` e RLS.

## PDF-modelo didático

Será criado fora do banco e fora do histórico de alunos um PDF fictício, pronto para distribuição. Ele conterá:

- contexto de uma ocorrência de nível muito difícil;
- personagem adulto agressivo, cuja homossexualidade é identidade, não risco;
- fatores de risco: luto recente pela mãe e conflito com o pai;
- fatores de proteção: amigos e alunos, pois o personagem é professor;
- transcrição didática completa, com apresentação, perguntas simples e complexas, paráfrase, memória linkada, maiêutica/TED, saída digna com ambulância e atendimento especializado;
- ficha item a item, evidências e nota final 10,0/10.

O material deixará explícito que é uma simulação didática e que saída/atendimento seguem o protocolo apresentado no curso. Não haverá instruções de autolesão, detalhes de método ou representação gráfica.

## Implementação e validação

1. Extrair regras puras para classificar pergunta simples, contar recusas e decidir abertura mínima por dificuldade; criar testes de limites para os três níveis.
2. Integrar essas regras ao prompt e à normalização das respostas do personagem, preservando respostas coerentes somente ao que foi perguntado.
3. Ajustar a avaliação final para usar as evidências determinísticas de perguntas simples/complexas.
4. Alterar a migração e ações administrativas para permitir várias categorias por balão inteiro, mantendo validação e RLS.
5. Refazer o componente de revisão e seus estilos em duas colunas, com seleção por ícone, aplicação imediata, etiquetas e bloqueio do PDF durante gravação.
6. Criar e revisar visualmente o PDF-modelo antes de entregá-lo.
7. Executar testes, lint direcionado, build de produção e revisão independente.

## Fora de escopo

- mudar notas já atribuídas em relatórios anteriores;
- expor marcações administrativas aos alunos;
- usar a orientação didática como aconselhamento para casos reais.
