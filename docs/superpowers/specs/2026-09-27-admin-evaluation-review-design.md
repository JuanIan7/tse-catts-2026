# Revisão administrativa de avaliações

## Objetivo

Permitir que somente administradores revisem os cinco relatórios concluídos mais recentes, comparem a avaliação automática com a conversa, marquem trechos que evidenciem ferramentas e salvem essas marcações para análise posterior. A revisão não altera a nota nem o relatório original do aluno.

## Escopo

O painel administrativo ganha a seção **Revisão de avaliações**. Ela mostra, em ordem decrescente de conclusão, no máximo cinco sessões que já possuem avaliação. Para cada sessão, o administrador vê:

- aluno, data, dificuldade, desfecho e nota automática;
- ficha revelada: fator principal, fatores de risco e fatores de proteção previstos no caso;
- mensagem/relatório produzido pelo sistema, incluindo itens, acertos, ajustes e linha de evolução quando existirem;
- transcrição completa, ordenada por sequência;
- botão para gerar um PDF da revisão.

Não entram na lista sessões ativas, incompletas ou sem avaliação. Dados de sessões mais antigas continuam sujeitos à retenção já existente; a ferramenta não cria uma cópia do conteúdo do aluno.

## Acesso e isolamento

A rota continua sob `requireAdmin()` no servidor. Todas as ações de leitura, criação, alteração e remoção de marcações repetem essa verificação no servidor. O banco terá RLS ativado nas novas tabelas, com políticas exclusivas para `public.is_admin()`; alunos não recebem políticas de leitura nem de escrita para essas tabelas.

O uso de um cliente administrativo para a página não substitui essas verificações. As ações validarão que a sessão, a transcrição e o trecho pertencem ao relatório selecionado antes de gravar. A nota, `item_states`, `calculation` e a transcrição original permanecem imutáveis por esta interface.

## Dados persistidos

Uma migração cria `public.admin_evaluation_annotations`:

| Campo | Regra |
| --- | --- |
| `id` | UUID primário |
| `session_id` | sessão existente, exclusão em cascata |
| `transcript_id` | turno existente da mesma sessão, exclusão em cascata |
| `annotation_type` | um dos tipos fechados abaixo |
| `start_offset`, `end_offset` | posições válidas dentro do texto do turno |
| `selected_text` | cópia do trecho selecionado, entre 1 e 500 caracteres |
| `note` | observação opcional, até 1.500 caracteres |
| `created_by`, `created_at`, `updated_at` | auditoria administrativa |

Também será criada `public.admin_evaluation_notes`, com uma observação geral por sessão (`session_id` único, texto, autor e datas). Ela atende anotações que não correspondam a um trecho específico.

Tipos, cores e finalidade:

| Tipo | Cor | Finalidade |
| --- | --- | --- |
| `PARAFRASE` | verde-azulado | paráfrase resumida |
| `MEMORIA_LINKADA` | azul | lembrança positiva de passado ou futuro |
| `MAIEUTICA_TED` | roxo | maiêutica socrática ou técnica/teia de indução |
| `SAIDA_DIGNA` | dourado | convite seguro de saída/atendimento |
| `PERGUNTA_SIMPLES` | amarelo | pergunta que admite resposta direta, como sim ou não |
| `PERGUNTA_COMPLEXA` | azul-petróleo | aprofundamento de uma informação já obtida |
| `FATOR_PROTECAO` | verde | fator protetivo identificado ou explorado |
| `FATOR_RISCO` | vermelho | fator de risco identificado ou explorado |
| `FATOR_PRINCIPAL` | laranja | evento precipitador principal |
| `OBSERVACAO` | cinza | comentário de revisão sem classificação de ferramenta |

As cores derivam do tipo no código, em vez de serem livres no banco, para manter consistência entre painel e PDF.

## Experiência de revisão

A seção terá uma lista compacta dos cinco relatórios. Ao escolher um, abre-se o relatório completo e a transcrição. Cada fala é um bloco independente. O administrador seleciona texto dentro de uma única fala e escolhe uma categoria na barra de marcação; o trecho fica realçado com a cor correspondente e pode receber uma observação curta.

Restringir a seleção a uma fala evita marcações frágeis entre blocos ou que mudariam quando o texto for renderizado em outro dispositivo. Ao salvar, o painel confirma visualmente a marcação. Marcações existentes podem ser removidas pelo administrador para corrigir uma análise. A observação geral é salva separadamente, sem exigir seleção.

Uma legenda fixa, visível acima da transcrição, mostra cada cor acompanhada do nome da ferramenta. Os botões da barra exibem o nome completo e uma descrição curta ao toque ou ao passar o cursor; após escolher uma cor, o painel repete o nome da ferramenta selecionada antes de salvar. Cada trecho já salvo também traz um selo textual com sua categoria, além do realce. Portanto, cor alguma é a única forma de identificar uma marcação.

O botão **Exportar PDF da revisão** reutiliza a geração de PDF existente. O PDF inclui a transcrição e uma página final com nota, itens descontados e uma seção **Marcações administrativas**, listando tipo, cor, trecho e observação. O PDF regular que o aluno já baixa não é modificado.

## Fluxo do servidor

1. A página administrativa chama `requireAdmin()` e busca cinco avaliações recentes, com sessão, perfil e transcrição.
2. O componente cliente exibe a revisão e as marcações já salvas.
3. Ao criar uma marcação, uma server action confirma autorização, verifica que offsets e texto correspondem exatamente ao turno guardado e grava a anotação.
4. Ao editar a nota geral ou remover uma marcação, a action repete a autorização e limita a alteração à sessão escolhida.
5. A página é revalidada após cada gravação para manter lista, marcações e PDF consistentes.

## Componentes e arquivos previstos

- migração Supabase para as duas tabelas, índices e políticas RLS;
- consulta tipada dos cinco relatórios administrativos;
- server actions administrativas para criar/remover marcações e salvar a nota geral;
- componente cliente de revisão, seleção de texto e destaques;
- extensão opcional do exportador de PDF para a variante administrativa;
- integração da nova seção em `src/app/admin/page.tsx`.

## Validação

- teste de validação de offsets e correspondência literal do trecho;
- teste das categorias permitidas e da limitação a uma fala;
- teste de consulta: somente cinco relatórios concluídos, em ordem de data;
- teste das server actions sem papel administrativo, que devem falhar;
- verificação manual: salvar uma marcação, recarregar o painel, remover a marcação e exportar o PDF da revisão;
- verificação de regressão: aluno continua vendo somente o próprio relatório e o PDF regular sem marcações administrativas.

## Fora de escopo

- recalcular ou substituir notas automáticas;
- expor revisões ou observações aos alunos;
- armazenar PDFs no banco;
- revisar mais que os cinco relatórios mais recentes nesta primeira versão.
