# Plano corrigido — diálogo automático TSE

## Meta

Entregar a conversa de voz automática no celular: um toque inicial para liberar som, descrição e abertura encadeadas, captura estável por pressão ou microfone aberto sem fones, reação didática a interrupções e relatório rigoroso limitado a 10,0.

## Invariantes

- Ficha interna, prompt completo e barema permanecem no servidor.
- Áudio bruto não é salvo; somente transcrição autorizada e eventos didáticos são persistidos.
- O botão inicial libera só a reprodução. Consentimento continua obrigatório antes de capturar microfone.
- Microfone aberto deve funcionar sem fones com cancelamento de eco e limiar de voz calibrado. Em sinal ambíguo, nunca registrar interrupção falsa.
- Interrupção é evidência objetiva; não permite inferir postura, olhar ou tom não capturado.
- Nota final é calculada pelo barema v0.3, sempre entre 0,0 e 10,0.

## 1. Corrigir contratos server-side de turno

**Arquivos:** `src/app/app/actions.ts`, `src/lib/tse/conversation.ts`, `src/app/api/sessions/[sessionId]/delivery/route.ts`, nova migração e testes.

- Criar a fala de abertura como `PENDENTE`.
- Fazer a confirmação de entrega idempotente com atualização atômica: repetir `OUVIDO` ou `INTERROMPIDO` não falha nem duplica efeito didático.
- Ao interromper, preservar a fala do personagem como `INTERROMPIDO` e registrar um evento `SISTEMA` separado. Nunca substituir a fala existente por evento de sistema.
- Validar dono e estado antes de enviar áudio à OpenAI.
- Retornar erro JSON específico da confirmação, transcrição e síntese.

**Testes:** entrega inicial, repetição de confirmação, interrupção, duas abas, sessão alheia e sessão encerrada.

## 2. Centralizar a experiência de sessão no cliente

**Arquivos:** novo `SessionExperience`, `scenario-media.tsx`, `voice-conversation.tsx`, CSS e testes de estados.

- O novo componente pai substitui a coordenação implícita entre os atuais componentes irmãos.
- A máquina de estados terá `PRONTA`, `NARRANDO`, `TENTANTE`, `CAPTURANDO`, `ENVIANDO`, `RECUPERACAO` e `ENCERRADA`.
- Usar uma única instância de reprodução e uma única captura de microfone; limpar tracks, timers, blobs e operações obsoletas no desmontar/trocar modo.
- Remover `router.refresh()` do caminho entre transcrição, criação de áudio e reprodução.

## 3. Início único e reprodução automática

**Arquivos:** `SessionExperience`, rotas de fala existentes e página da sessão.

- Imagens e briefing carregam em silêncio.
- O aluno toca **Iniciar simulação com áudio**.
- Dentro desse gesto, desbloquear o contexto de áudio e preparar narração e abertura no mesmo reprodutor; encadear a abertura após o `ended` da narração.
- Ao terminar a abertura, liberar captura. No caminho normal, não exibir “Ouvir descrição” nem “Tocar resposta”.
- Se o navegador negar reprodução, apresentar um único controle de recuperação com o áudio já preparado.
- Após cada turno aceito, a resposta do personagem deve tocar sozinha; só depois da conclusão ela é confirmada como ouvida.

**Teste manual:** Safari iPhone, Chrome Android e Chrome desktop, com áudio bloqueado/liberado e retorno de segundo plano.

## 4. Captura de voz e microfone aberto sem fones

**Arquivos:** controlador de áudio e rota de voz.

- Pressionar-para-falar inicia a gravação no primeiro toque após o consentimento; `pointercapture` impede seleção de texto e perda de soltar.
- Microfone aberto usa `echoCancellation`, `noiseSuppression`, `autoGainControl`, calibração inicial de ruído e voz sustentada acima de limiar dinâmico para abrir turno.
- A saída do alto-falante sozinha não deve abrir turno. Ao detectar sinal ambíguo, o modo continua ouvindo sem interromper a fala do personagem.
- Fala humana comprovada durante a voz do personagem interrompe o áudio, registra o evento e é capturada até a pausa. A resposta só ocorre depois da transcrição.
- Proibir gravadores paralelos; respeitar 90 segundos e limites de tamanho; explicar erro de permissão, formato, arquivo vazio, rede, saldo e API.

**Testes:** primeiro, segundo e terceiro turno; pausa curta; cancelamento de toque; sem fones; com fones; negação de permissão; interrupção real e eco do alto-falante.

## 5. TTS e reações por perfil

**Arquivos:** `briefing-speech/route.ts`, `speech/route.ts`, `character.ts`, adaptador de síntese e testes.

- Centralizar escolha de voz/formato e cache local do blob para repetir uma fala sem nova cobrança.
- Usar narração operacional estável; segmentar apenas em fronteiras naturais, sem avisos falados de carregamento.
- Aplicar prosódia inteligível: agressivo firme/irritado; depressivo baixo/embargado; psicótico fragmentado/apreensivo.
- Receber o evento de interrupção no gerador e reagir após a pausa: repreensão agressiva, fechamento/choro depressivo ou desorganização psicótica.
- Em falha transitória de TTS, tentar uma vez; não repetir automaticamente falhas de crédito, chave ou permissão.

## 6. Casos e avaliação orientada ao treino

**Arquivos:** `session-case.ts`, `character.ts`, `didactic-state.ts`, componente de relatório e testes.

- Variar contexto adulto: família, parentalidade, luto, trabalho, endividamento, jogos, substâncias e trabalho sexual.
- Tratar orientação sexual e identidade como características humanas/contextuais, nunca diagnóstico nem risco inerente.
- Mapear interrupções comprovadas deterministicamente aos itens de escuta e pausa permitidos pelo barema; manter itens físicos sem evidência como não observáveis.
- Preservar fórmula: base 10, ajustes dos 17 itens, deduções por erros graves, limite 0–10 e uma casa decimal.
- Exibir no relatório nota, cobertura, evidências, deduções e **O que treinar agora**, ordenado por impacto: erro grave, escuta/interrupção, técnica ausente e fator não explorado.

## 7. Validação e deploy

- Rodar testes, checagem de tipos e build em cada marco material.
- Aplicar migração antes do código dependente.
- Testar uma ocorrência externa completa: imagens, início, descrição, abertura, três turnos por modo, interrupção, retomada, saída digna e relatório.
- Comparar custo da API antes/depois de uma única ocorrência; não abrir a beta à turma antes da aprovação do teste em celular.

## Ordem de commits

1. Contratos e migração.
2. Controlador de áudio e captura.
3. Encadeamento automático.
4. TTS, perfis e interrupção.
5. Casos, avaliação e relatório.
6. Testes, deploy e teste externo.
