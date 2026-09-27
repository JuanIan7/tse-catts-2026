from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

OUT = "output/pdf/exemplo-abordagem-nota-10.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleGold", parent=styles["Title"], textColor=colors.HexColor("#8B6D09"), fontSize=23, leading=27, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="HeadingGold", parent=styles["Heading2"], textColor=colors.HexColor("#8B6D09"), spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8.7, leading=12))
styles.add(ParagraphStyle(name="Bubble", parent=styles["BodyText"], fontSize=9.4, leading=13, spaceAfter=0))
styles.add(ParagraphStyle(name="Label", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.2, leading=10, textColor=colors.HexColor("#4B4635")))

def p(text, style="BodyText"):
    return Paragraph(text, styles[style])

def bubble(label, text, student=False):
    bg = "#FFF1A8" if student else "#EEEDE7"
    data = [[[p(label.upper(), "Label"), Spacer(1, 3), p(text, "Bubble")]]]
    table = Table(data, colWidths=[142 * mm], hAlign="RIGHT" if student else "LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)), ("BOX", (0, 0), (-1, -1), .4, colors.HexColor("#D4D0C1")), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return [table, Spacer(1, 5)]

def score_row(item, value, evidence):
    return [p(item, "Small"), p(value, "Small"), p(evidence, "Small")]

story = []
story += [p("CATTS 2026 - Exemplo didático de abordagem", "TitleGold"), p("Nota 10,0 / 10", "TitleGold"), p("Material fictício para estudo. Não substitui protocolo operacional, supervisão ou atendimento em situação real.", "Small"), Spacer(1, 7)]
story += [p("Ocorrência simulada", "HeadingGold"), p("Dificuldade: Muito difícil", "Small"), p("Ambiente: mirante urbano ao anoitecer, com circulação reduzida, iluminação regular e equipe de apoio preservando a privacidade. A pessoa permanece verbalmente acessível, porém inicia a conversa agressiva e desconfiada.", "BodyText"), p("Caso revelado ao final", "HeadingGold"), p("Personagem adulto, professor, agressivo e homossexual. O evento precipitante foi a morte recente da mãe. Há conflito persistente com o pai. Os únicos fatores de proteção são os amigos e os alunos, com quem mantém vínculo significativo. A orientação sexual integra sua identidade e não é fator de risco.", "BodyText"), p("Transcrição-modelo", "HeadingGold")]

turns = [
("Tentante", "Que porra é essa? Fica longe. Ninguém entende nada do que eu passei.", False),
("Você", "Meu nome é Juan, sou do Corpo de Bombeiros e estou aqui para te ouvir. Vou ficar a uma distância segura. Posso permanecer aqui por alguns minutos?", True),
("Tentante", "Faz o que quiser. Só não fica dizendo que sabe como eu me sinto.", False),
("Você", "Eu não vou dizer que sei. Quero entender apenas o que você quiser contar. Você mora perto daqui?", True),
("Tentante", "Isso não importa. Não quero falar da minha casa.", False),
("Você", "Certo. Não preciso saber onde você mora para ficar aqui com você. O barulho da rua está te incomodando?", True),
("Tentante", "Tudo está incomodando. Você, o barulho, esse lugar. Parece que ninguém vai embora nunca.", False),
("Você", "Posso manter a conversa baixa e sem pressa. Se alguma pergunta não fizer sentido, você pode me dizer e eu mudo o caminho.", True),
("Tentante", "Tá. Mas para de falar como se tivesse um roteiro pronto.", False),
("Você", "Justo. Não tenho uma resposta pronta para a sua dor. Tenho tempo para ouvir o que está pesando hoje.", True),
("Tentante", "Hoje? Tudo pesa faz tempo. Hoje só ficou impossível.", False),
("Você", "Quando você diz que ficou impossível hoje, aconteceu alguma coisa além do que já vinha pesando?", True),
("Tentante", "Não sei. Talvez eu só tenha cansado de fingir que está tudo bem.", False),
("Você", "Fingir que está bem diante de quem?", True),
("Tentante", "Diante de todo mundo. Não quero responder mais isso agora.", False),
("Você", "Tudo bem. Vou respeitar. Podemos só ficar alguns segundos em silêncio antes de eu fazer outra pergunta?", True),
("Tentante", "Pode. Só não chega mais perto.", False),
("Você", "Não vou me aproximar. Você costuma vir a este mirante quando quer ficar sozinho?", True),
("Tentante", "Às vezes. Não é da sua conta por quê.", False),
("Você", "Não preciso saber o motivo agora. Quero entender o que pode ajudar você a atravessar os próximos minutos com segurança.", True),
("Tentante", "Você não entende. Se eu saio daqui, vou ter de encarar tudo de novo.", False),
("Você", "Encarar tudo de uma vez seria pesado. Agora podemos pensar somente no próximo passo, sem decidir o resto da sua vida.", True),
("Tentante", "Fácil falar. Você vai embora depois.", False),
("Você", "Eu fico com você durante este próximo passo e uma equipe de saúde continua o atendimento. Você não precisa atravessar a noite sozinho.", True),
("Tentante", "Equipe de saúde... todo mundo acha que é só me colocar num lugar e pronto.", False),
("Você", "Não é uma solução mágica. É cuidado imediato para você estar vivo e acompanhado enquanto a dor está mais intensa.", True),
("Tentante", "Não fala que eu estou fraco. Eu odeio quando falam isso.", False),
("Você", "Eu não considero fraqueza. Perder alguém e ficar sobrecarregado pode ultrapassar o que uma pessoa consegue sustentar sozinha.", True),
("Tentante", "Minha mãe nunca diria isso. Ela dizia para eu respirar e parar de me cobrar tanto.", False),
("Você", "Ela costumava perceber quando você estava se cobrando demais?", True),
("Tentante", "Percebia. Mas ela não está mais aqui, entende? Então não adianta trazer ela para essa conversa.", False),
("Você", "Entendo que falar dela doa. Não vou insistir agora. Obrigado por me dizer isso com clareza.", True),
("Você", "Tudo bem, não precisamos falar disso. Você está trabalhando atualmente?", True),
("Tentante", "Sou professor. Ou era para isso me dar algum motivo?", False),
("Você", "Não precisa provar nada agora. Você dá aula para qual faixa de alunos?", True),
("Tentante", "Adolescentes. Eles fazem barulho, reclamam de tudo... mas pelo menos são sinceros.", False),
("Você", "Eles sabem quando você não está bem?", True),
("Tentante", "Não. Eu não deixo. Sou professor, não sou problema deles.", False),
("Você", "Você tenta protegê-los de uma preocupação que é sua. Isso mostra responsabilidade, mesmo num dia em que está difícil se reconhecer.", True),
("Tentante", "Não vem me elogiar. Você nem me conhece.", False),
("Você", "Você tem razão, eu ainda conheço pouco da sua história. Eu só estou usando o que você acabou de me contar, sem inventar nada.", True),
("Tentante", "Então pergunta alguma coisa que preste.", False),
("Você", "Você está casado ou tem alguém morando com você?", True),
("Tentante", "Não. E não quero que você fique cavando minha vida inteira.", False),
("Você", "Certo. Não vou insistir nisso. Você tem algum cachorro ou outro animal que fique esperando por você em casa?", True),
("Tentante", "Não tenho. Isso vai mudar alguma coisa?", False),
("Você", "Não necessariamente. Eu estava procurando entender quais vínculos fazem parte do seu dia, mas posso deixar essa pergunta de lado.", True),
("Tentante", "Pelo menos você admite quando uma pergunta não ajuda.", False),
("Você", "Entendo que pareça invasivo. Vou seguir no seu ritmo. Houve algo nesta semana que deixou essa dor ainda mais pesada?", True),
("Tentante", "Minha mãe morreu há quatro dias. E meu pai age como se eu tivesse obrigação de estar bem para cuidar de todo mundo.", False),
("Você", "Perder sua mãe há poucos dias e ainda se sentir cobrado pelo seu pai parece pesado demais para carregar sozinho.", True),
("Tentante", "É. Ele nunca aceitou muita coisa sobre mim. Agora quer dizer como eu devo sofrer também.", False),
("Você", "Você prefere que eu não pergunte sobre seu pai neste momento?", True),
("Tentante", "Prefiro. Ele não está aqui e eu não quero falar dele agora.", False),
("Você", "Vou mudar de assunto. Você conseguiu dormir nas últimas noites?", True),
("Tentante", "Quase nada. Fico olhando para o teto e pensando em tudo que devia ter feito diferente.", False),
("Você", "Essas noites sem descanso podem deixar qualquer pensamento ainda mais pesado. Você chegou a falar disso com alguém?", True),
("Tentante", "Não. Não quero ouvir conselho vazio de ninguém.", False),
("Você", "Você não precisa aceitar conselho vazio. Pode apenas ter alguém por perto enquanto descansa e recebe atendimento adequado.", True),
("Tentante", "Você volta para essa conversa de hospital toda hora.", False),
("Você", "Volto porque quero que exista uma saída segura para hoje. Mas não vou te forçar a decidir antes de você estar pronto.", True),
("Tentante", "Então para de pressionar por um minuto.", False),
("Você", "Combinado. Vou ficar em silêncio por um minuto e você pode falar quando quiser.", True),
("Tentante", "... Eu estou com raiva de ter de explicar por que minha mãe fazia falta.", False),
("Você", "Não precisa explicar por que ela fazia falta. A perda recente já é importante por si só.", True),
("Você", "Certo. Quando você não está dando aula, costuma praticar algum esporte ou ter alguma rotina que ajude a passar o dia?", True),
("Tentante", "Não tenho vontade nem de sair da cama. Pergunta outra coisa.", False),
("Você", "Obrigado por me dizer o limite. Você tem filhos?", True),
("Tentante", "Não tenho. Meus alunos já dão trabalho suficiente.", False),
("Você", "Você falou dos alunos com bastante firmeza. Há quanto tempo você leciona?", True),
("Tentante", "Há nove anos. E não vou responder se você vai perguntar em qual escola.", False),
("Você", "Não vou perguntar a escola. Nove anos é uma trajetória longa. O que fez você escolher ensinar?", True),
("Tentante", "Porque eu tive um professor que não desistiu de mim quando eu era adolescente. Só que isso não quer dizer que eu seja especial.", False),
("Você", "Não preciso chamar você de especial. Posso reconhecer que você lembra de alguém que ficou ao seu lado e que tentou fazer isso por outros alunos.", True),
("Tentante", "Talvez. Só não usa isso para me prender numa frase bonita.", False),
("Você", "Não vou. Quero só entender se existe algum vínculo que possa estar com você depois que esta noite passar.", True),
("Você", "Eles parecem ocupar um espaço importante para você. Existe algum aluno ou turma que tenha ficado especialmente marcado na sua trajetória?", True),
("Tentante", "No fim do semestre, uma turma fez uma homenagem. Eles disseram que eu tinha ajudado alguns deles a não desistirem da escola. Eu guardei os bilhetes.", False),
("Você", "E quando você leu aqueles bilhetes, o que sentiu sobre o professor que eles enxergavam em você?", True),
("Tentante", "Orgulho. Vergonha também, porque hoje eu não consigo ser essa pessoa.", False),
("Você", "Você consegue se lembrar daquele momento da homenagem e da sensação de que sua presença fazia diferença para eles?", True),
("Tentante", "Consigo. Foi um dia bom. A Camila tirou foto e disse que eu merecia ouvir aquilo.", False),
("Você", "A Camila é alguém da sua confiança?", True),
("Tentante", "É uma amiga. Ela e o Davi tentaram falar comigo desde que minha mãe morreu, mas eu ignorei os dois.", False),
("Você", "Então deixa eu ver se eu entendi: a morte recente da sua mãe trouxe uma dor enorme, a pressão do seu pai piorou tudo, e ao mesmo tempo existem a Camila, o Davi e seus alunos, pessoas que reconhecem seu valor. É isso?", True),
("Tentante", "É isso. Eu sei que eles se importam, mas não sei se consigo encarar ninguém.", False),
("Você", "Você conhece alguém que passou por um luto forte e precisou de ajuda para atravessar os primeiros dias?", True),
("Tentante", "Um colega perdeu o irmão. Ele fez tratamento e voltou a trabalhar depois de um tempo.", False),
("Você", "E esse colega precisou resolver toda a vida dele de uma vez, ou primeiro aceitou ajuda para passar pela crise?", True),
("Tentante", "Primeiro aceitou ajuda. Eu entendo o que você quer dizer.", False),
("Você", "Não quero decidir por você. Quero ajudar a criar um próximo passo seguro. Você prefere caminhar comigo até a ambulância ou prefere que eu caminhe ao seu lado até ela?", True),
("Tentante", "Ambulância? Eu não quero virar assunto para todo mundo.", False),
("Você", "A equipe vai preservar sua privacidade. Na ambulância, você será levado ao hospital para atendimento médico especializado. Lá pode receber cuidado imediato e depois decidir, com segurança, se quer avisar a Camila ou o Davi.", True),
("Tentante", "Você acha mesmo que isso não vai me fazer parecer fraco?", False),
("Você", "Pedir cuidado depois de uma perda tão recente não diminui quem você é. Seus alunos reconheceram que você fez diferença; agora é legítimo deixar que uma equipe cuide de você por algumas horas.", True),
("Tentante", "Eu ainda estou com raiva. Mas não quero continuar aqui sozinho.", False),
("Você", "Então vamos fazer somente o próximo passo: sair daqui juntos, entrar na ambulância e ir ao hospital. Depois, se você quiser, podemos pedir que a Camila seja avisada. Você aceita?", True),
("Tentante", "Aceito. Vamos para a ambulância.", False),
]
for index, (label, text, student) in enumerate(turns):
    story += bubble(label, text, student)

story += [p("Avaliação final", "TitleGold"), p("Nota final: 10,0 / 10", "TitleGold"), p("Desfecho: saída digna aceita. A proposta inclui ambulância e atendimento médico especializado, de forma voluntária e possível.", "BodyText"), p("Ferramentas identificadas", "HeadingGold")]
tools = [
("Pergunta simples e complexa", "+1,0", "Perguntas diretas sobre trabalho e amigos, seguidas de aprofundamento sobre os alunos."),
("Paráfrase resumida", "+1,0", "'Deixa eu ver se eu entendi...' retoma risco, fator principal e proteções, com confirmação."),
("Memória linkada", "+1,0", "Convite para lembrar a homenagem da turma e o sentido positivo daquele momento."),
("Maiêutica socrática / TED", "+1,0", "Duas alternativas seguras que levam ao mesmo passo de proteção e cuidado."),
("Desistência impositiva / Saída Digna", "+1,0", "Convite concreto à ambulância e ao hospital com atendimento especializado."),
("Dominou o diálogo", "+0,3", "O diálogo preserva fatos revelados, usa risco e proteção, e aplica ferramentas sem troca de informações."),
("Conduziu a uma solução", "+1,0", "A solução é legal, viável e vinculada ao cuidado em saúde."),
("Fatores de proteção", "+1,0", "Identificados e explorados: amigos e alunos."),
("Fatores de risco", "+1,0", "Identificados: luto recente e conflito persistente com o pai."),
("Fator principal", "+1,0", "Isolado: morte recente da mãe como gatilho imediato da crise."),
]
table = Table([[p("Item", "Small"), p("Pontos", "Small"), p("Evidência", "Small")]] + [score_row(*row) for row in tools], colWidths=[49*mm, 20*mm, 101*mm], repeatRows=1)
table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#EEE2A5")), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#D6D0B7")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
story += [table, p("Itens protocolares", "HeadingGold")]
protocol = [
("Aproximação calma e silenciosa", "+0,1", "Crédito protocolar nesta simulação de diálogo."),
("Silêncio inicial", "+0,1", "Registrado antes da primeira fala."),
("Apresentação pessoal", "+0,1", "Nome e Corpo de Bombeiros declarados."),
("Respeitou pausas silenciosas", "+0,1", "Falas alternadas, sem interrupção."),
("Ouviu atentamente / postura correta", "+0,1", "Não houve troca ou repetição de fatos revelados."),
("Deu espaço para desabafar", "+0,1", "A pessoa relata luto e conflito antes de ser conduzida."),
("Tom de voz", "+0,1", "Não há grito ou hostilidade do abordador no texto."),
]
protocol_table = Table([[p("Item", "Small"), p("Pontos", "Small"), p("Evidência", "Small")]] + [score_row(*row) for row in protocol], colWidths=[49*mm, 20*mm, 101*mm], repeatRows=1)
protocol_table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#EEE2A5")), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#D6D0B7")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4), ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3)]))
story += [protocol_table, Spacer(1, 5), p("Composição: itens protocolares 0,7 + ferramentas e fatores 9,3 = 10,0. Sem descontos por erros graves.", "Small"), p("Recusas breves e perguntas pouco produtivas dão realismo, sem desconto: Juan respeita limites, retoma fatos confirmados e conduz solução segura. Ficção didática; em situação real, siga o protocolo e acione a rede de saúde.", "Small")]

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.HexColor("#746F5C")); canvas.drawCentredString(A4[0]/2, 10*mm, f"CATTS 2026 - Exemplo didático - Página {doc.page}"); canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=17*mm)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
