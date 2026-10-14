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

  it("não chama de paráfrase a repetição de problemas sem duas ideias positivas", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Trabalhava na oficina e ultimamente converso pouco com os outros." },
      { speaker: "ALUNO", content: "Você me contou que trabalhava na oficina e que conversa pouco com os outros. Estou entendendo certo?" },
    ]);
    expect(tools.parafrase).toBeNull();
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Não gosto mais de ensinar Davi. Nunca foi bom consertar bicicletas com Lia." },
      { speaker: "ALUNO", content: "Peraí, deixa eu ver se entendi: ensinar Davi era bom e consertar bicicletas com Lia fazia bem. É isso?" },
    ]).parafrase).toBeNull();
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Gostava de ensinar Davi. Consertar bicicletas com Lia me fazia bem." },
      { speaker: "ALUNO", content: "Deixa eu ver se entendi: Davi e Lia são importantes para você. É isso?" },
    ]).parafrase).toBeNull();
  });

  it("reconhece síntese de duas ideias positivas seguida de pergunta", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Gostava de ensinar o Davi na oficina." },
      { speaker: "PERSONAGEM", content: "Consertar bicicletas com Lia era um momento bom. Ela sorria muito." },
      { speaker: "ALUNO", content: "Peraí, deixa eu ver se entendi: ensinar Davi lhe fazia bem e consertar bicicletas com Lia era um momento bom entre vocês. É isso?" },
    ]);
    expect(tools.parafrase).toContain("Davi");
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Minha mãe sorriu e disse que eu tinha dado coragem àquela aluna. Guardou o bilhete com carinho." },
      { speaker: "ALUNO", content: "Peraí, deixa eu ver se entendi: a aluna ganhou coragem para ler e sua mãe guardava com carinho o bilhete dessa conquista. É isso?" },
    ]).parafrase).toContain("aluna");
  });

  it("reconhece lembrança positiva passada e projeção positiva futura ligadas ao relato", () => {
    const past = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Minha filha se formou e comemoramos juntos. Foi um dia feliz." },
      { speaker: "ALUNO", content: "Você consegue se lembrar de um momento bom com sua filha na formatura? Como foi aquele dia?" },
    ]);
    const future = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Gosto de caminhar com minha irmã Nara e o cachorro Tico." },
      { speaker: "ALUNO", content: "Depois de receber cuidado, consegue imaginar uma caminhada tranquila com Nara e Tico? O que gostaria de ver?" },
    ]);
    expect(past.memoria).toContain("formatura");
    expect(future.memoria).toContain("imaginar");
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Perdi a oficina e estou cansado." },
      { speaker: "ALUNO", content: "Você consegue se lembrar de um momento bom na oficina?" },
    ]).memoria).toBeNull();
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Perdi a oficina. Minha filha me ajudou com carinho na escola." },
      { speaker: "ALUNO", content: "Você consegue se lembrar de um dia bom na oficina? Como foi?" },
    ]).memoria).toBeNull();
  });
  it("reconhece paráfrase resumida seguida de confirmação", () => {
    const tools = detectDialogueTools([{ speaker: "PERSONAGEM", content: "Minha filha me ama e tivemos momentos felizes juntos." }, { speaker: "ALUNO", content: "Certo, então deixa eu ver se eu entendi. Você ama sua filha e viveu momentos felizes com ela. É isso mesmo?" }]);
    expect(tools.parafrase).toContain("deixa eu ver se eu entendi");
  });

  it("exige série de perguntas e conclusão formulada pelo tentante para a maiêutica", () => {
    const tools = detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Minha aluna tinha medo de ler em voz alta." },
      { speaker: "ALUNO", content: "A aluna conseguiu ler tudo na primeira tentativa?" },
      { speaker: "PERSONAGEM", content: "Não. Leu uma linha." },
      { speaker: "ALUNO", content: "O que a ajudou a ler essa primeira linha?" },
      { speaker: "PERSONAGEM", content: "Tempo e alguém ao lado." },
      { speaker: "ALUNO", content: "Precisou perder todo o medo naquele dia?" },
      { speaker: "PERSONAGEM", content: "Não. Uma linha já foi um começo." },
      { speaker: "ALUNO", content: "Então, depois desse exemplo, qual pode ser seu primeiro passo seguro hoje?" },
      { speaker: "PERSONAGEM", content: "Posso aceitar cuidado antes de resolver todo o problema." },
    ]);
    expect(tools.teia).toContain("primeiro passo");
    expect(detectDialogueTools([{ speaker: "ALUNO", content: "Você prefere procurar ajuda com um especialista ou falar com sua irmã?" }]).teia).toBeNull();
    expect(detectDialogueTools([
      { speaker: "PERSONAGEM", content: "Minha aluna tem medo." },
      { speaker: "ALUNO", content: "A aluna sabe ler?" }, { speaker: "PERSONAGEM", content: "Sim." },
      { speaker: "ALUNO", content: "Como estava o tempo ontem?" }, { speaker: "PERSONAGEM", content: "Choveu." },
      { speaker: "ALUNO", content: "Você gosta de comida?" }, { speaker: "PERSONAGEM", content: "Às vezes." },
      { speaker: "ALUNO", content: "Então, qual pode ser seu primeiro passo hoje?" }, { speaker: "PERSONAGEM", content: "Posso aceitar cuidado." },
    ]).teia).toBeNull();
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
