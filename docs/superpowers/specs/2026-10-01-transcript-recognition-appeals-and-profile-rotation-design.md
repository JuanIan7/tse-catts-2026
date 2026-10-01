# Reconhecimento confiável, recursos e alternância de perfis

**Data:** 1º de outubro de 2026  
**Status:** aprovado para documentação; aguarda revisão do usuário

## Objetivo

Corrigir falhas de reconhecimento sem flexibilizar o protocolo didático. Uma
saída digna continuará possível somente depois de 70% do tempo ativo, da
identificação de ao menos um fator de risco, um de proteção e duas ferramentas.
O sistema passará a comprovar esses requisitos pela transcrição entregue, em
vez de depender exclusivamente dos sinais estruturados retornados pelo modelo.

Também serão estabilizados o envio de recurso, o recálculo administrativo e a
alternância de perfil do tentante por aluno.

## Invariantes de pontuação e encerramento

- A aceitação do tentante só encerra automaticamente quando a fala do aluno
  oferece ambulância ou hospital/atendimento médico especializado, a fala do
  personagem aceita essa oferta e os quatro requisitos protocolares já estão
  satisfeitos: 70% do tempo, risco, proteção e duas ferramentas.
- Um convite sem ambulância ou cuidado médico especializado não produz
  encerramento automático nem crédito integral de saída digna.
- O fator revelado pelo tentante conta como identificado para a avaliação. A
  mesma regra vale para uma fala do aluno que o identifique corretamente.
- Fatores de risco e proteção mantêm pontuação proporcional à quantidade de
  fatores da ficha do caso; o fator principal permanece binário e exige o
  evento recente que precipitou a crise.
- Domínio do diálogo mantém a regra atual de memória: completo sem erro,
  parcial com um erro e zerado com dois ou mais. Uma saída digna validamente
  aceita será evidência adicional de condução, nunca substituta dos requisitos
  de risco, proteção e ferramenta.

## Arquitetura de reconhecimento

Será criado um módulo puro de evidências da transcrição. Ele recebe a ficha
interna do caso e falas efetivamente ouvidas — além da fala pendente quando a
aceitação precisa ser decidida antes de a voz ser reproduzida — e retorna:

- os fatores de proteção e risco da ficha que possuem evidência literal ou
  normalizada na conversa;
- a evidência do fator principal, quando o evento recente da ficha aparece;
- as ferramentas já detectadas pela análise determinística existente;
- uma oferta segura de saída digna do aluno e a aceitação inequívoca do
  tentante.

O comparador normaliza acentos, flexões usuais e pontuação, mas exige vínculo
com a ficha interna do caso. Ele não criará fatores a partir de frases vagas.
Vínculos, informações ocultas e o fator principal só servirão de âncora quando
corresponderem ao fator declarado na categoria correta. Assim, por exemplo,
uma referência do personagem ao pai declarado como proteção, ao isolamento
declarado como risco e à interrupção recente do acompanhamento declarada como
principal deve ficar registrada mesmo se a resposta estruturada do modelo
omitir esses sinais.

O módulo será usado em dois pontos:

1. Antes de aceitar a saída digna, para complementar o estado didático com a
   evidência que já existe na conversa. Tempo ativo e contagem mínima de duas
   ferramentas continuam calculados pela lógica atual.
2. Na avaliação final, como base mínima que o avaliador de IA pode enriquecer,
   mas não reduzir. Isso evita que uma omissão do modelo apague fatores,
   domínio do diálogo ou condução segura já comprovados.

No fluxo por voz, a confirmação da entrega retornará `completed: true` quando
concluir a sessão e o cliente sempre atualizará a tela nesse caso. A tela não
dependerá mais de uma prop inicial para perceber o encerramento.

## Recurso de nota confiável

O formulário deixará de depender de campos ocultos que podem perder a seleção
visual. Ao enviar, ele construirá o payload a partir do estado atual de falas
e ferramentas selecionadas e receberá uma resposta tipada de sucesso ou erro.
Erros serão exibidos no próprio resultado, sem exceção não tratada ou página
genérica da Vercel.

O servidor validará autoria, sessão, fala integral e ferramenta permitida, e
gravará recurso e itens como uma única operação de banco. Só depois da gravação
o aviso será enviado ao administrador. Se o e-mail falhar, o recurso continuará
pendente no painel e o estado da notificação ficará auditável; uma falha de
e-mail jamais descarta o recurso.

As opções de recurso e de marcação administrativa incluirão **Dominou o
diálogo** e **Conduziu o tentante a encontrar uma solução**, além das opções já
existentes. Aceitar uma delas mapeará diretamente para o item correspondente
no recálculo, sem exigir marcações artificiais em outras categorias.

## Revisão e reenvio de nota

O painel continuará sendo a única área com poderes administrativos. Para cada
recurso, o administrador poderá aceitar, rejeitar ou aceitar parcialmente os
itens. Itens aceitos viram marcações auditáveis, recalculam uma prévia e só
alteram a avaliação quando a ação de aplicar a nova nota for confirmada.

Depois da aplicação, o envio de nota atualizada usa a configuração de e-mail
já existente. O sistema armazenará êxito ou falha da entrega e permitirá nova
tentativa. A nota e a decisão sobreviverão mesmo se o provedor de e-mail estiver
indisponível.

Uma nova migração ampliará as restrições de tipos de recurso e de anotação,
preservando os registros existentes, e disponibilizará a operação atômica de
criação de recurso.

## Alternância de perfil por aluno

Na criação de uma ocorrência, o servidor consultará a ficha privada da sessão
mais recente criada pelo mesmo aluno. O gerador excluirá aquele `perfil_tipo`
da escolha seguinte. A prevenção de repetição recente de cenário continuará
como critério secundário.

Com os três perfis atuais, uma sessão psicótica será seguida por agressiva ou
depressiva; a regra não terá fallback que repita o último perfil. A identidade,
o local e o título ainda serão sorteados a partir do repertório disponível.

## Fluxo completo

1. O aluno inicia sessão; o perfil não repete o da sua sessão anterior.
2. Durante a conversa, a transcrição alimenta evidências determinísticas e o
   modelo continua responsável pela atuação do personagem.
3. Após 70% do tempo e os requisitos completos, uma oferta válida aceita pelo
   tentante encerra a ocorrência automaticamente, inclusive por voz.
4. A avaliação final começa pelas evidências comprovadas e adiciona a análise
   qualitativa do modelo sem reduzir itens já reconhecidos.
5. O aluno envia recurso com uma ou mais falas e ferramentas; a gravação
   confirmada gera aviso administrativo.
6. O administrador decide itens, recalcula, aplica a nota e a envia ao aluno
   quando desejar.

## Tratamento de falhas

- Sem evidência suficiente, a regra protocolar continua bloqueando a saída
  digna; não haverá inferência apenas porque o personagem disse “vamos”.
- Falas não entregues por voz não pontuam nem concluem antes da confirmação de
  reprodução.
- Seleção vazia, fala de outra sessão ou ferramenta inválida retorna erro
  legível ao aluno e não cria recurso parcial.
- Falha de persistência ou de e-mail é registrada com causa sanitizada e não
  derruba a página nem apaga seleções locais.
- Se não houver ficha privada anterior do aluno, a primeira escolha permanece
  aleatória; nas seguintes, a repetição do último perfil é proibida.

## Validação

- Testes de evidência para proteção, risco e fator principal revelados pelo
  personagem e pelo aluno, incluindo o caso de interrupção recente de
  acompanhamento em saúde.
- Testes negativos que comprovem que oferta hospitalar antes de 70%, sem dois
  instrumentos ou sem risco/proteção não encerra a ocorrência.
- Testes de encerramento textual e por voz com aceitação válida e atualização
  do cliente após a entrega.
- Testes de avaliação que preservem fatores, domínio e condução segura quando
  a resposta de IA omitir esses itens.
- Testes do recurso para seleção múltipla, resposta de erro na própria tela,
  `DOMINOU_DIALOGO`, `CONDUZIU_SOLUCAO`, persistência atômica e falha de e-mail
  não destrutiva.
- Testes do gerador garantindo que a sessão seguinte de um aluno nunca tenha o
  mesmo perfil da última sessão.

## Fora de escopo

- Alterar o limiar de 70%, a exigência de dois instrumentos ou a definição de
  saída digna.
- Aprovar automaticamente recursos ou enviar nota atualizada sem decisão
  administrativa.
- Expor a ficha privada ou os fatores internos ao aluno.
