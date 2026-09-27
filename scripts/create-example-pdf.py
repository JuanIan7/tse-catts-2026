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
story += [p("CATTS 2026", "TitleGold"), p("Exemplo didático de abordagem", "TitleGold"), p("Nota 10,0 / 10", "TitleGold"), p("Material fictício para estudo. Não substitui protocolo operacional, supervisão ou atendimento em situação real.", "Small"), Spacer(1, 7)]
story += [p("Ocorrência simulada", "HeadingGold"), p("Dificuldade: Muito difícil", "Small"), p("Ambiente: mirante urbano ao anoitecer, com circulação reduzida, iluminação regular e equipe de apoio preservando a privacidade. A pessoa permanece verbalmente acessível, porém inicia a conversa agressiva e desconfiada.", "BodyText"), p("Caso revelado ao final", "HeadingGold"), p("Personagem adulto, professor, agressivo e homossexual. O evento precipitante foi a morte recente da mãe. Há conflito persistente com o pai. Os únicos fatores de proteção são os amigos e os alunos, com quem mantém vínculo significativo. A orientação sexual integra sua identidade e não é fator de risco.", "BodyText"), p("Transcrição-modelo", "HeadingGold")]

turns = [
("Tentante", "Que porra é essa? Fica longe. Ninguém entende nada do que eu passei.", False),
("Você", "Meu nome é Rafael, sou do Corpo de Bombeiros e estou aqui para te ouvir. Vou ficar a uma distância segura. Posso conversar com você?", True),
("Tentante", "Conversar não muda nada. Minha mãe morreu esta semana e meu pai só sabe cobrar. Eu cansei.", False),
("Você", "Você trabalha como professor?", True),
("Tentante", "Trabalho. Dou aula, mas até isso parece inútil agora.", False),
("Você", "Você tem amigos com quem costuma conversar?", True),
("Tentante", "Tenho dois amigos, o Davi e a Camila. Eles mandaram mensagem, mas eu nem respondi.", False),
("Você", "E seus alunos: existe algum momento em que você percebeu que seu trabalho fez diferença para eles?", True),
("Tentante", "Teve uma turma que fez uma homenagem no fim do semestre. Eu fiquei emocionado. Eles confiam em mim.", False),
("Você", "Deixa eu ver se eu entendi: a morte da sua mãe aconteceu agora, o conflito com seu pai aumentou sua dor, mas você ainda tem o Davi, a Camila e alunos que reconhecem o professor que você é. É isso?", True),
("Tentante", "É... é isso. Eu só não consigo enxergar saída hoje.", False),
("Você", "Você consegue se lembrar de como se sentiu naquela homenagem da turma, quando percebeu que sua presença importava para eles?", True),
("Tentante", "Eu me senti necessário. Faz tempo que não sinto isso.", False),
("Você", "Então vamos pensar juntos: você pode aceitar minha mão e caminhar comigo até a ambulância, ou podemos ir lado a lado até ela. Em ambos os casos, você recebe atendimento médico especializado agora e depois pode decidir, com segurança, quem quer avisar.", True),
("Tentante", "Não quero falar com meu pai. Mas talvez eu consiga avisar o Davi depois.", False),
("Você", "Isso é possível. Você não precisa resolver tudo hoje. O passo de agora é sair daqui comigo para a ambulância e ir ao hospital, onde uma equipe de saúde vai cuidar de você. Você aceita fazer esse caminho agora?", True),
("Tentante", "Aceito. Vamos para a ambulância.", False),
]
for index, (label, text, student) in enumerate(turns):
    story += bubble(label, text, student)

story += [PageBreak(), p("Avaliação final", "TitleGold"), p("Nota final: 10,0 / 10", "TitleGold"), p("Desfecho: saída digna aceita. A proposta inclui ambulância e atendimento médico especializado, de forma voluntária e possível.", "BodyText"), p("Ferramentas identificadas", "HeadingGold")]
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
protocol_table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#EEE2A5")), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#D6D0B7")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
story += [protocol_table, Spacer(1, 10), p("Composição: itens protocolares 0,7 + ferramentas e fatores 9,3 = 10,0. Sem descontos por erros graves.", "BodyText"), p("Atenção: o exemplo mostra uma conversa fictícia de treinamento. Em uma situação real, siga o protocolo institucional, preserve a segurança da cena e acione a rede de apoio e saúde indicada.", "Small")]

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.HexColor("#746F5C")); canvas.drawCentredString(A4[0]/2, 10*mm, f"CATTS 2026 - Exemplo didático - Página {doc.page}"); canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=17*mm)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
