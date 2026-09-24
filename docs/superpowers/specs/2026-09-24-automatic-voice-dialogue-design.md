# TSE — diálogo de voz automático e avaliação rigorosa

## Objetivo

Transformar a sessão de abordagem em um fluxo de áudio contínuo, seguro e confiável no celular. O aluno faz um único toque inicial para liberar o áudio exigido por Safari e Chrome. Depois disso, a descrição, a fala do tentante e as respostas seguintes tocam automaticamente. O aluno escolhe entre pressionar para falar e microfone aberto.

O projeto mantém a simulação didática fictícia, a ficha interna protegida no servidor e a avaliação como estimativa didática — não como nota oficial do curso.

## Limite técnico do navegador

Safari e Chrome podem bloquear som sem interação prévia. Por isso, a sessão terá o botão inicial **Iniciar simulação com áudio**. Após esse toque, a reprodução automática será usada durante a sessão. Se o navegador ainda a bloquear, será exibido apenas um controle de recuperação para retomar o áudio; não haverá sequência de botões manuais no fluxo normal.

## Fluxo da sessão

1. A ocorrência carrega as imagens do local e do personagem em silêncio.
2. O aluno toca em **Iniciar simulação com áudio**.
3. A descrição do acionamento toca automaticamente.
4. Ao seu término, a fala inicial do tentante toca automaticamente.
5. O estado muda para **Sua vez de falar** e o aluno usa o modo escolhido:
   - **Pressione para falar:** segurar inicia a captura no primeiro toque; soltar encerra e envia a fala.
   - **Microfone aberto:** mantém uma única captura ativa e usa detecção de fala e pausa para separar turnos.
6. Cada fala válida do aluno é transcrita, salva, avaliada e respondida. A voz do tentante toca automaticamente ao fim do processamento.
7. Após a voz do tentante terminar, o modo escolhido volta a aguardar a fala do aluno. O microfone aberto permanece ligado até o aluno o desativar ou a simulação encerrar.

Não serão narrados avisos de carregamento. O estado visual indicará somente: narrando ocorrência, tentante falando, aluno falando, processando fala ou aguardando.

## Interrupções e reação por perfil

No microfone aberto, fala detectada durante a voz do tentante interrompe a reprodução e registra o evento didático. A fala do aluno é capturada até a pausa; só então o tentante reage. Não haverá fala sintetizada simultânea à fala do aluno.

- **Agressivo:** reage à falta de escuta, com repreensão, irritação e linguagem compatível, sem discurso de ódio ou ameaça detalhada.
- **Depressivo:** reduz a disposição para falar, pode chorar e se fechar.
- **Psicótico:** responde de forma mais fragmentada, apreensiva e desorganizada após a pausa do aluno.

A interrupção alimenta a avaliação como evidência objetiva de escuta e respeito à fala, sem supor tom, postura, contato visual ou outros sinais que o sistema não consegue comprovar.

## Qualidade de voz

A narração terá uma voz operacional estável. A síntese será preparada e reproduzida pelo controlador central; respostas com falha de reprodução terão uma tentativa automática adicional antes de oferecer recuperação ao aluno.

As instruções de voz do personagem refletem o perfil sem sacrificar inteligibilidade: agressivo tem intensidade controlada; depressivo, voz baixa e embargada; psicótico, ritmo fragmentado e receoso. A geração não deve produzir gritos contínuos, choro ininteligível ou ruído deliberado. O teste de aceitação inclui escuta em iPhone para identificar artefatos de síntese.

## Cenários e diversidade

O gerador de casos combinará perfil comportamental com contextos adultos variados: conflitos familiares, parentalidade, luto, trabalho, endividamento, jogos, uso problemático de substâncias e trabalho sexual. Personagens podem ter orientações sexuais, identidades e histórias diferentes, mas nenhuma característica protegida será tratada como doença, risco automático ou causa inerente da crise. O caso sempre terá fatores individualizados e contexto social explícito quando relevante.

## Dados, segurança e custos

- A ficha interna e as instruções do personagem permanecem no servidor; nunca seguem para o navegador.
- O áudio bruto continua descartado após o envio. A transcrição didática segue a retenção já informada ao aluno.
- Cada áudio do aluno gera transcrição; cada turno gera resposta de personagem; cada fala de personagem e a descrição geram síntese. Essas chamadas consomem o saldo pré-pago da API.
- Falhas por saldo esgotado mostram mensagem ao administrador, sem expor a chave da API ou detalhes técnicos.

## Entrega e confiabilidade

O controlador de áudio será responsável por uma única sequência de reprodução e uma única captura de microfone por sessão. Ele não poderá iniciar dois gravadores simultâneos nem atualizar a página no meio de uma entrega.

A confirmação de uma fala do tentante será idempotente: repetir a confirmação depois de queda de rede não pode corromper a sessão. O servidor devolverá o motivo real de falha ao cliente, e a fala permanecerá recuperável quando a reprodução não for confirmada.

## Avaliação

A nota é limitada a **0,0–10,0** e usa o Barema CATTS I/2026 já versionado. A nota parte de 10, recebe ajustes dos 17 itens e deduções adicionais por erros graves comprovados. Não há crédito presumido nem nota acima de 10.

O relatório final deve mostrar:

- nota final e cobertura da avaliação;
- itens acertados, parciais, não realizados e não observáveis, com evidência da conversa;
- erros graves comprovados e suas deduções;
- fatores de risco, proteção e fator principal que foram ou não explorados;
- consequências de interrupções relevantes;
- **O que treinar agora**, ordenado por impacto didático: erros graves, falhas de escuta/interrupção, técnicas não aplicadas e fatores não explorados.

## Arquivos e interfaces afetados

- `ScenarioMedia`: substitui o botão manual de descrição pelo início único da sessão e notifica o controlador quando a narração termina.
- `VoiceConversation`: passa a controlar os estados de inicialização, reprodução, captura, detecção de pausa, interrupção, recuperação e encerramento.
- Rotas de voz, fala e entrega: retornam erros específicos, fazem entrega idempotente e registram interrupções de forma consistente.
- Criação de sessão e conversa: a abertura do personagem é pendente até sua reprodução; o evento de interrupção chega ao gerador de personagem.
- Gerador de cenários e personagem: amplia variedade de contextos e aplica reação coerente a interrupções.
- Avaliação e tela final: incorporam evidências de interrupção e apresentam prioridades de treino sem alterar o máximo de 10,0.

## Testes de aceitação

1. Em Safari no iPhone, um toque inicial inicia descrição e fala inicial sem outros toques.
2. Pressionar para falar funciona no primeiro, segundo e terceiro turnos; soltar envia uma fala de até 90 segundos.
3. Microfone aberto processa vários turnos consecutivos sem criar dois gravadores.
4. Interromper o tentante registra o evento e produz reação distinta em cada perfil após a pausa do aluno.
5. Falha de reprodução, rede, saldo ou transcrição exibe mensagem compreensível e não perde a sessão.
6. A avaliação final é limitada a 10,0, apresenta evidências e prioriza o próximo treino.
7. Voz de narração e personagem é inteligível e sem artefatos perceptíveis no iPhone durante os cenários de teste.
