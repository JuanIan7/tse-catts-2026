# TSE Web — beta privada: desenho técnico

## Objetivo e escopo

Converter o protótipo estático em uma aplicação Next.js privada para 3 a 5 avaliadores autorizados. A aplicação preserva literalmente a lógica do TSE v0.3: caso estável e oculto, revelação gradual, requisitos mínimos da ficha, encerramento positivo automático por Saída Digna explicitamente ofertada e aceita, e barema determinístico de 17 itens. A nota é sempre apresentada como **ESTIMATIVA DIDÁTICA — NÃO É NOTA OFICIAL DO CURSO**.

Não entram nesta primeira versão: conteúdo de ocorrências reais, importação de dados legados, publicação aberta, nem automação de decisão pedagógica pelo modelo.

## Arquitetura

- Next.js App Router e TypeScript, hospedado na Vercel.
- Supabase Auth para login individual; Postgres para dados; Storage privado somente para imagens de ocorrência, se necessário.
- Rotas de servidor Next.js para toda ação privilegiada e toda chamada OpenAI. Chaves OpenAI e Supabase service role existem exclusivamente como variáveis de ambiente do servidor.
- Cliente usa a chave anon/publishable do Supabase apenas para sua sessão autenticada; toda tabela usa RLS.
- OpenAI gera a ficha interna validada por schema, a introdução segura, a imagem POV e as evidências do barema. O motor TypeScript local, portado fielmente do Python v0.3, valida os estados e calcula a nota.

## Autorização e dados

`profiles` referencia `auth.users` e possui nome de exibição, papel (`ALUNO`/`ADMINISTRADOR`), situação (`PENDENTE`/`APROVADO`/`BLOQUEADO`), primeiro e último acesso.

`access_requests` guarda solicitações de acesso e decisão administrativa. `training_sessions` guarda dono, dificuldade, estado e timestamps. A ficha interna, o prompt operacional e a transcrição integral ficam em colunas protegidas e nunca são devolvidos por endpoints de aluno antes da avaliação. `evaluations` guarda os 17 estados, evidências, erros graves, memória de cálculo, cobertura e nota. `ranking_snapshots` ou consulta agregada entrega somente a visualização permitida, por dificuldade.

RLS:

- aluno lê e cria somente registros cujo `user_id = auth.uid()`;
- aluno não pode selecionar ficha interna, prompts, avaliações de outros usuários, pedidos administrativos nem transcrições de terceiros;
- administrador autenticado acessa os dados administrativos mediante função `is_admin()` baseada no próprio perfil;
- mutações de aprovação, bloqueio e revogação passam por rota de servidor que confirma o papel antes de usar privilégios administrativos.

## Fluxos

1. Cadastro/login cria ou atualiza pedido pendente. A aplicação não libera o menu até haver perfil aprovado.
2. Administrador aprova, recusa, bloqueia ou revoga. A mudança passa a valer na próxima requisição autenticada.
3. Aluno escolhe dificuldade. O servidor cria uma ficha interna que exige 1 fator principal, ao menos 2 riscos distintos, 2 proteções distintas, perfil, contexto, vínculos, observáveis, ocultos, progressão e condições de saída.
4. O servidor cria a imagem horizontal POV segura a partir apenas da parte visual permitida da ficha. A imagem não contém método, ferimentos, sangue, execução nem informação oculta.
5. Texto e voz produzem transcrição funcional. O estado da ocorrência é atualizado no servidor; o cliente recebe somente a resposta do personagem e metadados públicos.
6. Quando a proposta explícita de Saída Digna, continuidade concreta, vínculo, compreensão e proteção forem satisfeitos e houver aceitação inequívoca, o servidor encerra e dispara a avaliação automaticamente. O aluno não vê botão obrigatório para finalizar ou avaliar.
7. A IA devolve apenas evidências estruturadas para estados permitidos. O motor determinístico confere cobertura, evidência, valores, limites e arredondamento antes de persistir o resultado.

## Voz e OpenAI

A opção inicial é WebRTC com sessão criada por rota Next.js, usando a interface unificada da Realtime API. A rota confere sessão aprovada, registra identificador de segurança derivado do ID interno e negocia a sessão mantendo chave e instruções completas no servidor. O cliente transmite e recebe áudio por WebRTC e recebe eventos/transcrição pelo data channel. Uma rota lateral autenticada persiste a transcrição e executa alterações de estado autorizadas.

O caso e as instruções são estáveis por sessão; o personagem não infere postura, distância ou contato visual só pelo áudio. Voz é complementar a texto e dispõe de fallback textual quando WebRTC/microfone falhar.

## Segurança e falhas

Toda resposta de rota valida autenticação, situação aprovada e propriedade da sessão. Eventos inválidos, mudança de proprietário, ficha sem estrutura mínima, resultado fora do barema ou evidência ausente falham sem expor conteúdo interno. Acesso bloqueado encerra sessão e nega novas rotas. Mensagens de situação real interrompem a ficção e exibem orientação segura, sem tática operacional.

## Testes e entrega

1. Testes unitários do port do motor contra os quatro self-tests v0.3, mais validação de schema da ficha.
2. Testes de RLS com usuário aluno, aluno alheio e administrador.
3. Testes de rota para aprovação, criação de sessão, encerramento automático e persistência de avaliação.
4. Teste manual de WebRTC com navegador desktop e celular, interrupção e transcrição.
5. Deploy privado na Vercel somente após as variáveis de ambiente e o projeto Supabase existirem; proteção de acesso continua dentro da aplicação, nunca baseada em URL secreta.

## Variáveis necessárias no momento oportuno

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor;
- `OPENAI_API_KEY` apenas no servidor;
- URL pública autorizada da aplicação para callback e WebRTC.

Nenhum segredo deve ser colado em chat ou salvo no repositório.
