# Encerramento por ocorrências graves e ficha de avaliação

## Objetivo

Evitar que uma abordagem com condutas graves repetidas siga até o cronômetro, tornar o resultado zero explícito e organizar a ficha final de modo visualmente inequívoco.

## Regra de encerramento

- Cada erro grave com evidência literal confirmado na resposta estruturada do personagem conta uma ocorrência grave.
- As cinco primeiras ocorrências são registradas e a simulação continua.
- A sexta encerra imediatamente a sessão com resultado sem êxito e nota final `0.0/10`, independentemente da pontuação parcial.
- A avaliação final preserva a lista de evidências e identifica o encerramento como `LIMITE DE OCORRÊNCIAS GRAVES`.

## Áudio aberto

- O detector só conclui a fala após uma pausa contínua de seis segundos, desde que já tenha detectado voz por tempo mínimo.
- Isto reduz encerramentos causados por respiração ou pausa curta entre frases, sem remover o limite máximo de 90 segundos por trecho.

## Ficha visual

- A nota fica em destaque e mostra explicitamente o valor final e o máximo de 10.
- Cada item mostra o estado, a evidência e o ajuste de pontuação.
- Estados satisfatórios recebem painel verde; estados não feitos, inadequados ou ausentes recebem painel vermelho; estados parciais recebem amarelo.
- Em encerramento por limite grave, a nota e o motivo aparecem acima dos itens e as seis ocorrências ficam listadas.

## Dados e fluxo

1. `recordStudentTurn` aplica sinais e erros graves no estado didático.
2. Quando a contagem acumulada passa de cinco, o servidor finaliza a sessão usando cálculo forçado de zero.
3. A página recebe o cálculo já persistido e apenas o apresenta; não recalcula nota no navegador.

## Testes

- Teste unitário da sexta ocorrência forçando nota zero e status terminal.
- Teste de pontuação normal sem sexta ocorrência.
- Build de produção e verificação visual por classes de estado.
