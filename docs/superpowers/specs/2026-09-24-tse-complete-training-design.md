# TSE — desenho completo da plataforma de treinamento

## Decisão e propósito

O TSE é uma plataforma privada de treinamento fictício para o CATTS 2026. O aluno pratica conversas de abordagem com um personagem simulado; o instrutor aprova acessos, acompanha sessões e revisa relatórios. A plataforma é didática, não substitui protocolo, terapia ou atendimento real. Todas as telas exibem: “ferramenta didática fictícia · em caso de sofrimento real, ligue 188 (CVV)”.

O trabalho substitui a interface beta minimalista por uma experiência utilizável em celular e computador, mantendo o acesso privado, o barema determinístico e a ficha pedagógica protegida. O escopo inclui experiência do aluno, voz, avaliação, ranking e painel do instrutor.

## Direção visual aprovada

- Identidade: operacional escura, com grafite, preto e dourado do emblema do CATTS; áreas de leitura e formulários usam fundos claros para preservar legibilidade.
- O emblema enviado pelo usuário (`IMG_4443.png`) será exibido na entrada e reduzido no cabeçalho do aplicativo. O arquivo será incorporado como ativo local público, sem usar uma URL externa.
- A simulação segue o layout “Diálogo primeiro”: barra superior institucional, temporizador e estado da sessão; contexto observável recolhível; conversa e controle de voz acima da dobra; transcrição opcional.
- A aparência funciona primeiro em tela estreita e cresce para desktop. Nenhum controle essencial depende de hover, cor isolada ou área pequena de toque.

## Segurança, conteúdo e limites pedagógicos

- Casos, imagens, voz e transcrições mantêm foco em escuta, vínculo, comunicação e decisões seguras. Não exibem nem descrevem mecanismos, instruções, ferimentos, sangue ou execução de autoagressão.
- Não há armas, orientação tática operacional, promessa de desfecho real ou certificação do aluno.
- O personagem é sempre chamado de “tentante” dentro da simulação. A persona pode demonstrar resistência, tristeza, irritação ou desorganização de maneira humana e proporcional, mas não terá linguagem humilhante, conteúdo gráfico ou estigmatizante.
- Somente fatos observáveis entram no briefing. A ficha oculta, as instruções do modelo, o gabarito, a classificação interna e os dados administrativos nunca retornam ao navegador do aluno.
- Relatos usados para a biblioteca didática precisam ser anonimizados e resumidos pelo administrador antes de serem publicados como material de treinamento. Dados pessoais e narrativas de ocorrências reais não são enviados automaticamente a modelos.

## Acesso, papéis e privacidade

Supabase Auth e as políticas RLS existentes seguem como a camada de acesso. O servidor confirma autenticação, situação aprovada e propriedade da sessão antes de toda leitura ou gravação privilegiada.

- **Aluno:** solicita acesso, entra após aprovação, cria e retoma apenas suas próprias sessões, consulta seus relatórios e vê ranking com primeiro nome e inicial dos demais participantes.
- **Administrador:** aprova, recusa, bloqueia e convida usuários; redefine senha; lê pedidos com nome e e-mail; revisa sessões, transcrições, relatórios e ranking completo; administra a biblioteca didática.
- Segredos OpenAI e a service role do Supabase permanecem exclusivamente em variáveis de servidor. O navegador recebe, para voz, somente uma credencial temporária e limitada à sessão autorizada.

## Dados e estados

As tabelas atuais permanecem compatíveis. Migrações incrementais adicionarão apenas o necessário:

- `training_sessions`: estado de ciclo de vida (`CRIADA`, `EM_ANDAMENTO`, `RECONEXAO`, `ENCERRADA`, `AVALIACAO_PENDENTE`, `AVALIADA`, `INTERROMPIDA`), início, fim, modo de voz mais recente, imagem e resumo público.
- `training_transcripts`: sequência estável, locutor, conteúdo, origem (`TEXTO`, `VOZ`, `SISTEMA`) e marca de tempo. Eventos de conexão e interrupção usam entradas de sistema separadas, sem fingir falas do aluno ou do tentante.
- `evaluations`: estado da avaliação, evidências estruturadas, memória de cálculo, coberturas, deduções e resultado. A nota é rotulada permanentemente como “ESTIMATIVA DIDÁTICA — NÃO É NOTA OFICIAL DO CURSO”.
- `scenario_library`: conteúdo didático anonimizável, lição, status de rascunho/publicado, autor e timestamps. Uma sessão só usa uma versão publicada e registrada.

A página pode recarregar em qualquer momento: servidor recupera sessão, transcrição e estado. Uma sessão encerrada nunca volta para andamento; uma interrupção voluntária exige confirmação explícita.

## Fluxo do aluno

1. A tela de login exibe emblema, objetivo breve e links para login, solicitação de acesso e recuperação de senha.
2. Após aprovação, o painel mostra uma chamada clara para criar ocorrência, sessões recentes, progresso pessoal e acesso ao ranking. Administradores também enxergam o atalho do painel administrativo.
3. O aluno escolhe dificuldade. O servidor cria caso estável, ficha interna protegida, briefing público e imagem horizontal segura. Falha de geração de imagem mostra uma cena visual neutra; nunca bloqueia a sessão.
4. A tela de ocorrência exibe a cena, o contexto observável recolhível, estado da conversa, controle de áudio e, quando escolhido, a transcrição em balões.
5. A cada turno registrado, o servidor atualiza a sessão e aplica o motor de vínculo/gates. O aluno pode continuar em texto se voz não estiver disponível.
6. Um desfecho aceito encerra a conversa e inicia avaliação sem botão manual de “avaliar”. A interrupção voluntária fica separada de um desfecho pedagógico.
7. O aluno vê o relatório e pode iniciar outra ocorrência ou retornar ao painel.

## Voz e conversa ao vivo

A implementação usa a Realtime API via WebRTC. A rota de servidor valida sessão autorizada e emite uma credencial efêmera. A chave principal, a ficha interna e as instruções completas permanecem no servidor.

### Modos de entrada

- **Pressione para falar:** padrão. Enquanto o botão está pressionado, a faixa local é habilitada; ao soltar, o turno é enviado. É o caminho mais previsível para celular, navegador e ambiente ruidoso.
- **Microfone aberto — conversa ao vivo:** opção explicitamente ativada pelo aluno. A detecção de atividade de voz segmenta os turnos. Se o aluno começa a falar enquanto a resposta do tentante está em reprodução, a reprodução é interrompida, o evento é registrado e a próxima resposta pode reconhecer, de modo proporcional, que a fala foi interrompida ou que não está sendo ouvido.

O mecanismo observa apenas sobreposição de áudio e eventos de voz. Ele não afirma postura, distância, olhar, toque ou qualquer pista física não disponível no áudio. Em ambas as modalidades, a página mostra um único estado inequívoco: solicitando microfone, conectando, narrando, sua vez, tentante falando, reconectando ou indisponível.

Os eventos de transcrição e resposta vindos do data channel são validados e persistidos por rota autenticada de sessão. Falha de permissão, Safari/Chrome incompatível, queda de conexão, token vencido ou provedor indisponível troca para texto sem apagar a sessão. Controles de reconexão encerram faixas antigas antes de abrir nova conexão, evitando múltiplos microfones ou áudios sobrepostos.

## Motor de caso, vínculo e avaliação

O motor atual em TypeScript continua sendo a fonte determinística de valores, limites e cálculo. A IA só produz texto de personagem, ficha validada e evidências estruturadas. Nunca calcula a nota em texto livre.

- Cada caso tem um fator principal recente, riscos e proteções distintos, contexto observável, condições de evolução e condições de saída. A revelação é gradual e coerente com o histórico salvo.
- O personagem começa resistente e não oferece encerramento positivo prematuramente. Perguntas repetidas, tom inadequado, aceleração, promessas impraticáveis e interrupções afetam vínculo por regras explícitas; uma interrupção isolada do áudio não é automaticamente uma penalidade.
- O servidor mede os gates mínimos por dificuldade: tempo, vínculo, exploração genuína, perguntas, paráfrase, memória, alternativas seguras e Saída Digna. Um resultado positivo só vale quando todos os gates aplicáveis estão satisfeitos.
- Aceitação explícita de uma Saída Digna, quando os gates forem cumpridos, encerra positivamente a sessão e inicia avaliação automática.
- A avaliação grava estados e evidências dos itens permitidos; o código soma apenas descontos conforme o barema v0.3, limita entre 0 e 10 e armazena o cálculo auditável.
- Caso o serviço de análise falhe, a sessão permanece encerrada. A tela informa “avaliação em processamento” e permite nova tentativa administrativa ou automática; não expõe erro técnico nem perde o histórico.

## Ranking, relatórios e histórico

O ranking é global: uma entrada por aluno, usando a melhor sessão avaliada. Filtros por dificuldade e perfil só usam dados permitidos. Para alunos, participantes aparecem como primeiro nome mais inicial; administradores veem nome e e-mail completos.

O relatório do aluno contém resultado, estimativa, itens do barema, evidências resumidas, itens a praticar e aviso didático. O painel administrativo mostra transcrição completa, eventos de conexão, resultado e progresso do aluno. O administrador não altera silenciosamente uma nota calculada; ajustes pedagógicos eventuais são anotados como observação separada.

## Painel administrativo

O painel mantém os fluxos já existentes e passa a ser dividido em áreas objetivas:

- **Acessos:** solicitações com nome, e-mail, data e situação; aprovar, recusar, bloquear, convidar e enviar redefinição de senha.
- **Acompanhamento:** alunos, últimas sessões, sessões em curso/interrompidas, relatórios e ranking.
- **Biblioteca didática:** criar, revisar, publicar, arquivar e versionar cenários anonimizados, com lição pedagógica resumida.
- **Auditoria:** decisões de acesso e ações administrativas já registradas, com o mínimo necessário de dados.

## Componentes e fronteiras

- `AppShell` e componentes visuais: cabeçalho, navegação, alertas, cartões, estados vazios e avisos de segurança.
- `SessionCreator`: cria sessão e mostra progresso real de preparação, incluindo fallback de imagem.
- `SimulationConsole`: reúne briefing recolhível, temporizador, conversa, estado e finalização segura.
- `VoiceConversation`: isola WebRTC, permissão, modos de entrada, data channel, áudio remoto, reconexão e limpeza de recursos.
- Rotas de sessão: token de voz, persistência de eventos/transcrições, criação de turno textual e retomada.
- `case-engine`, `progress-engine` e `evaluation-engine`: módulos server-only com contratos estruturados para ficha, evidências, gates e cálculo determinístico.
- Páginas administrativas: acesso, alunos/sessões, ranking e biblioteca, todas protegidas por verificação de papel no servidor.

## Testes e publicação

Antes de cada entrega serão executados teste unitário do barema, schemas de caso, gates e cálculo; testes de rota para propriedade, aprovação, recuperação e persistência; build de produção; e validação manual em Safari iOS e Chrome Android/desktop.

Os cenários manuais incluem: negar/aceitar permissão de microfone, pressionar para falar, microfone aberto, interrupção da fala remota, reconectar, alternar para texto, recarregar página, encerrar, avaliar, visualizar ranking e impedir acesso de outro aluno. O deploy ocorre pelo repositório conectado à Vercel. URLs de produção e callbacks de autenticação serão mantidos no Supabase com domínio estável da Vercel.

## Fora do escopo desta implementação

- Certificação, nota oficial, recomendação clínica ou uso em atendimento real.
- Exposição pública, acesso sem aprovação ou compartilhamento de ficha interna.
- Importação automática de ocorrências reais, envio de PII para IA, ou geração de imagens que revelem métodos de autoagressão.
