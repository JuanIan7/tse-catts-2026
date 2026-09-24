# Plano de implementação — plataforma completa TSE

## Objetivo de entrega

Entregar uma versão privada e utilizável do TSE em celular e desktop: acesso aprovado, identidade CATTS, criação e retomada de ocorrência, conversa por texto/voz, avaliação determinística automática, ranking protegido, histórico e administração. A plataforma continua sendo ferramenta didática fictícia, com conteúdo e imagens seguros.

## Regras de execução

- Preservar `src/lib/tse/barema.v0.3.json` sem alteração semântica; qualquer extensão fica em módulo novo e é testada.
- Ficha interna, instruções completas, gabarito e dados administrativos não chegam ao navegador, nem pela sessão Realtime. A voz cliente recebe somente estado sanitizado e credencial efêmera.
- Eventos do navegador e do data channel são candidatos não confiáveis. Só o servidor persiste fala do personagem, evidências, transições, desfecho, avaliação e ranking.
- Áudio bruto não é armazenado. Antes do primeiro uso da voz, o aluno aceita termo específico para transcrição e envio à IA. Na beta, transcrições e relatórios ficam retidos por 180 dias e são excluíveis pelo administrador; a exclusão remove sessão, objetos privados e derivados associados.
- Não copiar para o produto detalhes de métodos, lesões, táticas ou instruções presentes em referências. Casos, imagens, voz e relatórios usam linguagem segura.
- Cada migração é aditiva, validada no Supabase antes do código que dela depende; cada marco produz commit pequeno e passa por testes proporcionais.

## 1. Fixar a base e os ativos de marca

**Arquivos principais:** `public/brand/tse-catts-logo.png`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/app-shell.tsx`, `.gitignore`.

1. Copiar o emblema aprovado para `public/brand/`, conservando o original do usuário fora do repositório.
2. Adicionar tokens de cor e tipografia: grafite/preto, dourado, superfícies claras, alerta, foco acessível e preferência de movimento reduzido.
3. Criar shell reutilizável com cabeçalho, aviso institucional, área de conteúdo e rodapé CVV.
4. Adaptar layout para viewport móvel, toque e teclado; ignorar os temporários `.superpowers/`.

**Validação:** login, painel e sessão em 320 px e desktop; contraste, foco e nenhuma URL externa de imagem.

## 2. Evoluir o esquema com transições e sequência atômicas

**Arquivos principais:** `supabase/migrations/202609240001_complete_training.sql`, tipos de domínio e consultas app/admin.

1. Inspecionar schema aplicado e sessões existentes antes da migração.
2. Acrescentar somente estados intermediários ausentes (`RECONEXAO`, `AVALIACAO_PENDENTE`); manter os terminais existentes `ENCERRADA_COM_EXITO`, `ENCERRADA_SEM_EXITO` e `CANCELADA`, sem estados duplicados.
3. Criar metadados de retomada, modo de voz, versão de cenário e `next_transcript_sequence` por sessão.
4. Criar RPC/transação server-only para transição legal de sessão e outra para anexar transcrição usando incremento atômico; proibir o padrão “ler máximo + 1”.
5. Acrescentar a origem e a entrega do turno (`PENDENTE`, `OUVIDO`, `INTERROMPIDO`) às transcrições. Fala de personagem só vira definitiva depois de confirmação de reprodução concluída; interrupção descarta conteúdo não ouvido e registra somente evento de sistema.
6. Criar `scenario_library` com conteúdo anonimizado, lição, autor, versão e status. Leitura e gestão são somente admin/servidor; no início de uma sessão, a versão publicada é copiada imutavelmente para `training_session_secrets`.
7. Criar consentimento de voz por perfil, data de expiração de retenção, índices e RLS. Substituir/revogar a função pública atual de ranking que devolve `display_name`; criar uma função anonimizada para aluno e outra exclusiva de administrador.

**Validação:** aplicar SQL em ambiente de teste, testar RLS como aluno/aluno alheio/admin, concorrência de duas abas, sessão antiga e exclusão em cascata de uma sessão de teste.

## 3. Consolidar contratos server-only do domínio TSE

**Arquivos principais:** `src/lib/tse/session-case.ts`, novos `progress-engine.ts`, `evaluation-engine.ts`, `session-state.ts`, `types.ts` e testes.

1. Separar schemas públicos e internos para briefing, caso, evento de voz, estado de progresso e evidência de avaliação.
2. Selecionar cenário seguro por estrutura ou por versão publicada da biblioteca, sempre guardando dificuldade e versão na sessão.
3. Implementar `progress-engine` puro para vínculo, cobertura, ferramentas e reset por erro grave; a UI só recebe estado explicável, nunca ficha oculta.
4. Implementar gate de desfecho por dificuldade e aceitação explícita de Saída Digna; desfecho negativo é institucional, não gráfico.
5. Criar `evaluation-engine` que valida evidência estruturada, chama cálculo v0.3 e grava memória de cálculo auditável. Encerramento e disponibilidade de avaliação são operações separadas.

**Testes:** requisitos por dificuldade, ganho/perda/reset de vínculo, desfecho precoce bloqueado, limites 0–10, transição legal e self-tests v0.3.

## 4. Criar operações idempotentes e autoritativas de sessão

**Arquivos principais:** `src/app/app/actions.ts`, rotas `src/app/api/sessions/[sessionId]/`, `src/lib/auth/authorization.ts`.

1. Extrair verificação única de sessão: usuário aprovado, proprietário, estado permitido e segredo disponível.
2. Criar operações idempotentes de criar, iniciar, retomar, receber candidato de transcrição, confirmar reprodução, interromper resposta, encerrar e concluir.
3. Validar tamanho, origem, timestamp e estado de cada candidato do cliente. O servidor gera e persiste texto do personagem, classificação, progresso e respostas; cliente jamais os declara como fato.
4. Executar transições via RPC/transação e rejeitar turno fora de estado, token expirado, duplicata ou sessão de terceiro.
5. Após estado final, disparar avaliação; falha registra `AVALIACAO_PENDENTE` sem reabrir sessão. Remover todo botão que avalie sem confirmação.

**Testes:** duplicatas, duas abas, aluno alheio, usuário bloqueado, evento de personagem forjado, token vencido, falha de avaliação e reload.

## 5. Construir a interface de marca, login e painel

**Arquivos principais:** `src/app/globals.css`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/auth-form.tsx`, `src/app/app/page.tsx`, componentes de painel.

1. Aplicar emblema e identidade operacional ao login, com recuperação de senha e status de solicitação claros.
2. Reestruturar painel: “Nova ocorrência”, seletor de dificuldade, retomada, histórico, progresso e ranking; atalho admin só após confirmação server-side.
3. Mostrar preparação de ocorrência de modo honesto; imagem ausente usa cena visual neutra e não bloqueia o exercício.
4. Criar termo de voz acessível, apresentado antes da primeira permissão de microfone, com aceite registrado e opção de seguir por texto.

**Validação:** login, pendência, bloqueio, aluno/admin, revogação do consentimento e tela sem sessões.

## 6. Implementar console “Diálogo primeiro”

**Arquivos principais:** `src/app/app/sessions/[sessionId]/page.tsx`, novos `simulation-console.tsx`, `session-briefing.tsx`, `conversation-transcript.tsx`, `session-controls.tsx`.

1. Carregar briefing, imagem privada assinada, estado e transcrição exclusiva do proprietário; falha de imagem recebe fallback seguro.
2. Construir topo escuro com TSE, temporizador do servidor e estado inequívoco. Contexto observável fica recolhível.
3. Manter voz e diálogo acima da dobra. Mostrar balões, resposta pendente, rolagem controlada e escolha de ocultar transcrição.
4. Implementar encerramento voluntário com confirmação e consequência explícita, separado de avaliação.
5. Restaurar sessão, temporizador e controles em `RECONEXAO`, sem duplicar turnos.

**Validação:** celular/desktop, sessão sem imagem, transcrição longa, texto, cancelamento/confirmacão e URL direta.

## 7. Reescrever a camada de voz com isolamento de segredo

**Arquivos principais:** `src/components/voice-conversation.tsx`, `src/app/api/realtime/session/route.ts`, rotas autenticadas de eventos e reprodução, adaptadores OpenAI server-only.

1. Trocar o Realtime atual por fluxo separado: cliente usa WebRTC apenas com configuração neutra de captura/transcrição; não recebe caso interno nem prompt de personagem.
2. O servidor valida transcrição e chama o personagem com ficha interna. A resposta textual e a avaliação existem apenas no servidor.
3. O servidor sintetiza áudio da resposta e entrega um recurso temporário privado para reprodução. Ao receber confirmação de fim de reprodução, confirma o turno do personagem e envia próxima transcrição pública. Nunca persistir uma resposta que não foi efetivamente ouvida.
4. Implementar **Pressione para falar** como padrão, habilitando a faixa local somente durante o botão.
5. Implementar **Microfone aberto** desligado por padrão com VAD. Fala local enquanto áudio remoto toca cancela reprodução, informa o servidor, grava `INTERRUPCAO` e faz a próxima resposta considerar apenas conteúdo que chegou a ser confirmado.
6. Limpar tracks, áudio remoto, timers e handlers antes de reconectar. Exibir erro específico para permissão, navegador, rede, token e provedor; texto permanece sempre disponível.

**Validação manual obrigatória:** Safari iOS, Chrome Android e Chrome desktop; negar/aceitar permissão, alterar modo, interromper, recarregar, trocar de rede, expirar token e seguir por texto. Confirmar que não há inferência de pistas físicas nem armazenamento de áudio bruto.

## 8. Integrar personagem, progresso e relatório automático

**Arquivos principais:** `src/lib/tse/character.ts`, schemas de saída, rotas de turno, página e componentes de relatório.

1. Exigir saída estruturada do modelo para fala, evidências, fatores revelados, regressões, erro grave e aceitação. Validar schema, limitar campos e descartar resposta inválida.
2. Passar ficha e histórico somente a chamadas do servidor. Aplicar segurança e revelação gradual em cada turno.
3. Usar evidências no motor puro, nunca como nota. Se modelo sugerir fim antes do gate, manter estado em andamento e gerar continuação coerente.
4. No desfecho válido, encerrar pela transação e iniciar avaliação. Exibir relatório ou “em processamento” com atualização segura.
5. Criar relatório com desfecho, estimativa, checklist, evidências e pontos de prática; sem ficha/prompt ocultos.

**Testes:** schema inválido, evidência ausente, encerramento precoce, falha no turno/avaliação, avaliação pendente e tentativa de vazar ficha por rota ou serialização.

## 9. Completar ranking, histórico e painel administrativo

**Arquivos principais:** `src/app/admin/page.tsx`, `src/app/admin/actions.ts`, novas páginas admin, consultas de ranking/biblioteca e tabelas.

1. Manter pedidos com nome, e-mail, decisão, convite e redefinição; comunicar falha de envio sem segredo ou resposta bruta do provedor.
2. Criar alunos/sessões com filtros, tela de sessão com transcrição finalizada, eventos e relatório; admin não pode reescrever cálculo silenciosamente.
3. Criar ranking global de melhor sessão por aluno. A função do aluno retorna primeiro nome e inicial; função admin retorna identificação completa. Testar ausência de nomes completos por RPC/JSON.
4. Criar biblioteca com rascunho, revisão, publicação, arquivamento e versões imutáveis. Arquivamento preserva sessões já vinculadas; exclusão é proibida se houver referência.
5. Criar tela de retenção/exclusão que remove sessão e derivados após confirmação administrativa, registrando auditoria mínima sem conteúdo técnico sensível.

**Validação:** RLS aluno/alheio/admin, ranking vazio/empate/anonimização, biblioteca vazia/arquivada e exclusão de teste.

## 10. Garantia de qualidade e publicação privada

**Arquivos principais:** testes em `src/lib/tse/*.test.ts`, testes de rota/componentes, `.env.example`, documentação de deploy.

1. Executar testes do domínio e ampliar cobertura para isolamento, transições concorrentes, eventos forjados, token de voz e anonimização.
2. Rodar `npm run test` e `npm run build` em cada marco material; corrigir antes de seguir.
3. Fazer checklist manual: acesso, senha, consentimento, sessão, imagem, texto, voz, interrupção, retomada, desfecho, relatório, ranking, admin e exclusão.
4. Conferir Vercel Production/Preview, domínio estável, Site URL e Redirect URLs no Supabase. Segredos não entram em log ou repositório.
5. Push para branch conectada, acompanhar deploy e testar URL pública com usuário não autenticado, aluno e admin em dispositivo externo.

## Ordem de entrega

Executar 1–4 para tornar dados e operações seguros; 5–8 para o fluxo completo do aluno; 9–10 para gestão e publicação. Não convidar toda a turma até voz, recuperação, consentimento e autenticação passarem com ao menos uma conta de teste em celular e outra em desktop.
