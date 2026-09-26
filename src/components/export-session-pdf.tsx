"use client";

import { jsPDF } from "jspdf";

type TranscriptTurn = {
  speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA";
  content: string;
};

type EvaluationItem = {
  titulo: string;
  estado: string;
  ajuste: number;
  evidencia: string;
};

type SevereError = { titulo?: string; evidencia?: string; ajuste?: number; aplicado?: boolean };

type Evaluation = {
  result: string;
  finalScore: number;
  calculation: {
    itens?: EvaluationItem[];
    erros_graves?: SevereError[];
    nota_base?: number;
    ajustes_itens?: number;
    deducoes_erros_graves?: number;
    nota_bruta?: number;
    motivo_encerramento?: string;
  };
};

type Props = {
  title: string;
  difficulty: string;
  transcript: TranscriptTurn[];
  evaluation: Evaluation;
};

const speakerLabel: Record<TranscriptTurn["speaker"], string> = {
  ALUNO: "Você",
  PERSONAGEM: "Tentante",
  NARRADOR: "Narrador",
  SISTEMA: "Sistema",
};

function fileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function ExportSessionPdf({ title, difficulty, transcript, evaluation }: Props) {
  function exportPdf() {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 16;
    const width = 210 - margin * 2;
    const bottom = 280;
    let y = margin;

    const addFooter = () => {
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`CATTS · Simulação didática · Página ${pdf.getNumberOfPages()}`, margin, 290);
      pdf.setTextColor(0);
    };
    const newPage = () => {
      addFooter();
      pdf.addPage();
      y = margin;
    };
    const text = (content: string, size = 10, indent = 0) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(content, width - indent);
      const lineHeight = size * 0.48;
      if (y + lines.length * lineHeight > bottom) newPage();
      pdf.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 2;
    };
    const heading = (content: string, size = 15) => {
      if (y + 12 > bottom) newPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(size);
      pdf.text(content, margin, y);
      pdf.setFont("helvetica", "normal");
      y += size * 0.55 + 3;
    };

    heading("Registro da abordagem", 18);
    text(`Ocorrência: ${title}`, 11);
    text(`Dificuldade: ${difficulty}`, 11);
    text(`Exportado em: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, 9);
    y += 3;
    heading("Transcrição da conversa", 14);

    if (transcript.length === 0) {
      text("Não houve falas confirmadas nesta simulação.");
    } else {
      transcript.forEach((turn) => {
        pdf.setFont("helvetica", "bold");
        text(speakerLabel[turn.speaker], 10);
        pdf.setFont("helvetica", "normal");
        text(turn.content, 10, 4);
        y += 1;
      });
    }

    newPage();
    heading("Avaliação final", 18);
    pdf.setFont("helvetica", "bold");
    text(`Nota final: ${evaluation.finalScore.toFixed(1)} / 10`, 16);
    pdf.setFont("helvetica", "normal");
    text(`Desfecho: ${evaluation.result === "EXITO" ? "saída digna aceita" : "simulação encerrada"}`, 11);
    if (evaluation.calculation.motivo_encerramento) text(`Motivo do encerramento: ${evaluation.calculation.motivo_encerramento}`, 10);

    heading("Composição da nota", 13);
    text(`Nota-base: ${(evaluation.calculation.nota_base ?? 0).toFixed(1)}`);
    text(`Pontos dos itens: ${(evaluation.calculation.ajustes_itens ?? 0).toFixed(1)}`);
    text(`Descontos por erros graves: ${(evaluation.calculation.deducoes_erros_graves ?? 0).toFixed(1)}`);
    text(`Nota bruta antes do limite 0–10: ${(evaluation.calculation.nota_bruta ?? evaluation.finalScore).toFixed(1)}`);

    heading("Itens pontuados e descontos", 13);
    const relevantItems = evaluation.calculation.itens ?? [];
    relevantItems.forEach((item) => {
      const sign = item.ajuste >= 0 ? "+" : "";
      pdf.setFont("helvetica", item.ajuste < 0 ? "bold" : "normal");
      text(`${sign}${item.ajuste.toFixed(1)} · ${item.titulo} — ${item.estado.replaceAll("_", " ")}`, 9);
      pdf.setFont("helvetica", "normal");
      text(item.evidencia, 8, 4);
    });

    const severeErrors = (evaluation.calculation.erros_graves ?? []).filter((error) => error.aplicado && (error.ajuste ?? 0) < 0);
    if (severeErrors.length > 0) {
      heading("Erros graves descontados", 13);
      severeErrors.forEach((error) => text(`${error.ajuste ?? 0} · ${error.titulo ?? "Erro grave"}${error.evidencia ? `: ${error.evidencia}` : ""}`, 9));
    }

    newPage();
    heading("Resumo final da avaliação", 18);
    pdf.setFont("helvetica", "bold");
    text(`Nota final: ${evaluation.finalScore.toFixed(1)} / 10`, 18);
    pdf.setFont("helvetica", "normal");
    text(`Nota-base: ${(evaluation.calculation.nota_base ?? 0).toFixed(1)} · itens: ${(evaluation.calculation.ajustes_itens ?? 0).toFixed(1)} · erros graves: ${(evaluation.calculation.deducoes_erros_graves ?? 0).toFixed(1)}`, 10);
    heading("O que foi descontado", 13);
    const negativeItems = relevantItems.filter((item) => item.ajuste < 0);
    const compactLine = (value: string) => value.length > 96 ? `${value.slice(0, 93)}...` : value;
    const compactDiscounts = [
      ...negativeItems.map((item) => `${item.ajuste.toFixed(1)} · ${item.titulo} (${item.estado.replaceAll("_", " ")})`),
      ...severeErrors.map((error) => `${error.ajuste ?? 0} · ${error.titulo ?? "Erro grave"}`),
    ];
    if (negativeItems.length === 0 && severeErrors.length === 0) {
      text("Não houve descontos registrados nesta simulação.", 10);
    } else {
      pdf.setFontSize(8);
      compactDiscounts.forEach((discount) => {
        pdf.text(compactLine(discount), margin, y);
        y += 4;
      });
      y += 2;
      pdf.setTextColor(100);
      pdf.setFontSize(8);
      pdf.text("As evidências de cada desconto constam nas páginas anteriores.", margin, y);
      pdf.setTextColor(0);
    }

    addFooter();
    pdf.save(`${fileName(title) || "abordagem"}-transcricao.pdf`);
  }

  return <button type="button" className="button-link" onClick={exportPdf}>Exportar conversa em PDF</button>;
}
