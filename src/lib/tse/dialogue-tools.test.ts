import { describe, expect, it } from "vitest";
import { detectDialogueTools, dialogueControlState, hasDialogueMemoryError, questionKinds } from "./dialogue-tools";

describe("ferramentas de diálogo", () => {
  it("classifica perguntas de sim ou não sem limitar o assunto a uma lista fixa", () => {
    const questions = questionKinds([
      { speaker: "ALUNO", content: "Você pratica esportes?" },
      { speaker: "ALUNO", content: "Você prefere que eu fique aqui?" },
      { speaker: "ALUNO", content: "Como esse esporte ajudava você antes?" },
    ]);
    expect(questions.simple).toBe("Você pratica esportes?");
    expect(questions.complex).toBe("Como esse esporte ajudava você antes?");
    expect(questionKinds([{ speaker: "ALUNO", content: "Sua avó ainda é viva?" }]).simple).toBe("Sua avó ainda é viva?");
    expect(questionKinds([{ speaker: "ALUNO", content: "Qual é seu nome?" }]).simple).toBe("Qual é seu nome?");
    expect(questionKinds([{ speaker: "ALUNO", content: "O que aconteceu com sua avó?" }]).simple).toBeNull();
    expect(questionKinds([{ speaker: "ALUNO", content: "Qual é seu nome?" }, { speaker: "ALUNO", content: "Qual é seu maior medo?" }]).complex).toBeNull();
    for (const followUp of [
      "Quais tarefas do trabalho eram mais importantes para você?",
      "Quando começou esse trabalho?",
      "Quanto desse trabalho ainda faz parte da sua rotina?",
      "De que forma esse trabalho mudou sua vida?",
    ]) {
      expect(questionKinds([{ speaker: "ALUNO", content: "Você trabalha?" }, { speaker: "ALUNO", content: followUp }]).complex).toBe(followUp);
    }
  });

  it("reconhece perguntas diretas depois de vocativo e comentário, como nas abordagens históricas", () => {
    expect(questionKinds([{ speaker: "ALUNO", content: "Amigo, você trabalha aqui?" }]).simple).toBe("Amigo, você trabalha aqui?");
    expect(questionKinds([{ speaker: "ALUNO", content: "Percebo que você se preocupa com o cachorro. Qual o nome dele?" }]).simple).toContain("nome dele");
    expect(questionKinds([{ speaker: "ALUNO", content: "Você trabalha aqui? Como foi o seu último dia de trabalho?" }]).complex).toContain("último dia");
  });

  it("reconhece paráfrase fiel sem exigir uma fórmula fixa de abertura", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Eu tinha uma oficina e ensinava o Davi a consertar bicicletas." },
      { speaker: "ALUNO", content: "A oficina era seu lugar de trabalho e também onde você ensinava o Davi. Entendi direito?" },
    ]);
    expect(tools.parafrase).toContain("oficina");
  });

  it("reconhece lembrança positiva ligada ao que o tentante contou", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Quando minha filha se formou, fiquei orgulhoso e fomos comemorar juntos." },
      { speaker: "ALUNO", content: "Você falou da formatura da sua filha e do orgulho que sentiu. Como foi aquele dia para vocês?" },
    ]);
    expect(tools.memoria).toContain("formatura");
  });

  it("reconhece reflexão encadeada sem exigir duas alternativas prontas", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Meu pai está preocupado comigo, mas não sabe como ajudar." },
      { speaker: "ALUNO", content: "Se seu pai estivesse aqui agora, o que você pediria a ele para te acompanhar até o atendimento?" },
    ]);
    expect(tools.teia).toContain("pai");
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Tenho medo do hospital." },
      { speaker: "ALUNO", content: "Se você chegar ao hospital, como é a segurança de lá?" },
    ]).teia).toBeNull();
  });
  it("reconhece paráfrase resumida seguida de confirmação", () => {
    const tools = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Minha filha me ama e tivemos momentos felizes juntos." }, { speaker: "ALUNO", content: "Certo, então deixa eu ver se eu entendi. Você ama sua filha e viveu momentos felizes com ela. É isso mesmo?" }]);
    expect(tools.parafrase).toContain("deixa eu ver se eu entendi");
  });

  it("reconhece a teia de indução por alternativas positivas", () => {
    const tools = detectDialogueTools([{ speaker: "ALUNO", content: "Você prefere procurar ajuda com um especialista ou fazer essa busca junto com sua irmã?" }]);
    expect(tools.teia).toContain("especialista");
  });

  it("não confunde frase de efeito ou alternativas sem solução com as ferramentas", () => {
    const tools = detectDialogueTools([{ speaker: "ALUNO", content: "Deixa eu ver se eu entendi, está bem?" }, { speaker: "ALUNO", content: "Você pode ficar aí ou ir embora?" }]);
    expect(tools.parafrase).toBeNull();
    expect(tools.teia).toBeNull();
  });

  it("não dá teia quando uma das alternativas é negativa", () => {
    const tools = detectDialogueTools([{ speaker: "ALUNO", content: "Você prefere ficar sozinho ou procurar ajuda com um especialista?" }]);
    expect(tools.teia).toBeNull();
  });

  it("não concede memória ou maiêutica sem ligação verificável ao diálogo", () => {
    const tools = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Estou muito cansado." }, { speaker: "ALUNO", content: "Você consegue se lembrar de uma viagem qualquer?" }, { speaker: "ALUNO", content: "Então quer dizer que você conhece advogados?" }]);
    expect(tools.memoria).toBeNull();
    expect(tools.teia).toBeNull();
  });

  it("exige memória positiva e sequência para maiêutica", () => {
    const memory = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Estou cansado." }, { speaker: "ALUNO", content: "Você se lembra de quando ficou cansado?" }]);
    const maieutic = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Tenho medo de procurar ajuda." }, { speaker: "ALUNO", content: "Você conhece alguém que já procurou ajuda?" }]);
    expect(memory.memoria).toBeNull();
    expect(maieutic.teia).toBeNull();
  });

  it("não aceita futuro negativo ou perguntas sem encadeamento como ferramentas", () => {
    const memory = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Eu me sinto sozinho." }, { speaker: "ALUNO", content: "Imagine você sozinho para sempre?" }]);
    const maieutic = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Tenho medo de procurar ajuda." }, { speaker: "ALUNO", content: "Como você dormiu?" }, { speaker: "ALUNO", content: "Você conhece alguém que procurou ajuda?" }]);
    expect(memory.memoria).toBeNull();
    expect(maieutic.teia).toBeNull();
  });

  it("detecta pergunta repetida e troca explícita de nome", () => {
    expect(hasDialogueMemoryError([{ speaker: "ALUNO", content: "Qual é o seu trabalho?" }, { speaker: "ALUNO", content: "Qual é o seu trabalho?" }])).toBe(true);
    expect(hasDialogueMemoryError([{ speaker: "PERSONAGEM", content: "Meu nome é Igor." }, { speaker: "ALUNO", content: "Seu nome é Carlos, certo?" }])).toBe(true);
    expect(hasDialogueMemoryError([{ speaker: "PERSONAGEM", content: "Minha ex-mulher se mudou." }, { speaker: "ALUNO", content: "Sua mulher está em casa?" }])).toBe(true);
  });

  it("resolve domínio como feito, parcial ou não feito", () => {
    const items = { fatores_protecao: { estado: "encontrou_explorou" }, fatores_risco: { estado: "encontrou_isolou" }, parafrase_resumida: { estado: "feito" } };
    expect(dialogueControlState(items, [{ speaker: "ALUNO", content: "Como está?" }, { speaker: "PERSONAGEM", content: "Mal." }, { speaker: "ALUNO", content: "O que aconteceu?" }, { speaker: "PERSONAGEM", content: "Estou triste." }, { speaker: "ALUNO", content: "Deixa eu ver se entendi?" }, { speaker: "PERSONAGEM", content: "Sim." }])).toBe("feito");
    expect(dialogueControlState(items, [{ speaker: "ALUNO", content: "Qual é seu trabalho?" }, { speaker: "PERSONAGEM", content: "Sou bombeiro." }, { speaker: "ALUNO", content: "Qual é seu trabalho?" }, { speaker: "PERSONAGEM", content: "Já respondi." }, { speaker: "ALUNO", content: "Vamos procurar ajuda?" }, { speaker: "PERSONAGEM", content: "Talvez." }])).toBe("parcial");
    expect(dialogueControlState(items, [{ speaker: "ALUNO", content: "Como está?" }, { speaker: "ALUNO", content: "Vamos procurar ajuda?" }])).toBe("nao_feito");
    expect(dialogueControlState(items, [{ speaker: "ALUNO", content: "Como está?" }, { speaker: "PERSONAGEM", content: "Mal." }, { speaker: "ALUNO", content: "O que aconteceu?" }, { speaker: "PERSONAGEM", content: "Estou triste." }, { speaker: "SISTEMA", content: "Resposta interrompida.", delivery_status: "INTERROMPIDO" }, { speaker: "ALUNO", content: "Vamos procurar ajuda?" }, { speaker: "PERSONAGEM", content: "Talvez." }])).toBe("parcial");
  });
});
