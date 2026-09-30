"use client";

import { jsPDF } from "jspdf";
import { annotationMeta, needsReviewPdfPageBreak, type ReviewAnnotation } from "@/lib/admin/evaluation-review";

type TranscriptTurn = {
  id?: string;
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

type ReviewAppeal = {
  status: "PENDENTE" | "ACEITO" | "PARCIAL" | "REJEITADO";
  createdAt: string;
  previousScore: number;
  recalculatedScore: number | null;
  items: { annotationType: keyof typeof annotationMeta; selectedText: string; decision: "PENDENTE" | "ACEITO" | "REJEITADO" }[];
};

type Props = {
  title: string;
  difficulty: string;
  transcript: TranscriptTurn[];
  evaluation: Evaluation;
  review?: { annotations: ReviewAnnotation[]; generalNote: string | null; appeals?: ReviewAppeal[] };
  disabled?: boolean;
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

export function ExportSessionPdf({ title, difficulty, transcript, evaluation, review, disabled = false }: Props) {
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
        const marks = review?.annotations.filter((annotation) => annotation.transcriptId === turn.id) ?? [];
        const primary = marks[0] ? annotationMeta[marks[0].annotationType] : null;
        if (primary) {
          pdf.setFillColor(primary.color);
          pdf.roundedRect(margin - 2, y - 4, width + 4, 8, 1.5, 1.5, "F");
        }
        pdf.setFont("helvetica", "bold");
        text(speakerLabel[turn.speaker], 10);
        pdf.setFont("helvetica", "normal");
        text(turn.content, 10, 4);
        if (marks.length) text(`Marcações: ${marks.map((mark) => annotationMeta[mark.annotationType].label).join(" · ")}`, 8, 4);
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

    if (review) {
      newPage();
      heading("Marcações administrativas", 18);
      text("Estas observações são internas e não alteram a avaliação automática do aluno.", 10);
      if (review.annotations.length === 0) text("Nenhuma marcação foi salva.", 10);
      review.annotations.forEach((annotation) => {
        const meta = annotationMeta[annotation.annotationType];
        if (needsReviewPdfPageBreak(y, 18, bottom)) newPage();
        pdf.setFillColor(meta.color);
        pdf.rect(margin, y - 3, 4, 4, "F");
        text(meta.label, 10, 6);
        text(`“${annotation.selectedText}”`, 9, 6);
        if (annotation.note) text(annotation.note, 8, 10);
        y += 2;
      });
      heading("Observação geral", 13);
      text(review.generalNote || "Nenhuma observação geral salva.", 10);

      if (review.appeals?.length) {
        heading("Recursos de nota", 13);
        review.appeals.forEach((appeal, appealIndex) => {
          text(`Recurso ${appealIndex + 1}: ${appeal.status.toLowerCase()} · enviado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(appeal.createdAt))}`, 9);
          text(`Nota original: ${appeal.previousScore.toFixed(1)} / 10${appeal.recalculatedScore === null ? "" : ` · prévia: ${appeal.recalculatedScore.toFixed(1)} / 10`}`, 8, 4);
          appeal.items.forEach((item) => text(`${annotationMeta[item.annotationType].label} · ${item.decision.toLowerCase()} · “${item.selectedText}”`, 8, 4));
        });
      }
    }

    addFooter();
    pdf.save(`${fileName(title) || "abordagem"}-${review ? "revisao-administrativa" : "transcricao"}.pdf`);
  }

  return <button type="button" className="button-link" onClick={exportPdf} disabled={disabled}>{disabled ? "Salvando marcação..." : review ? "Exportar PDF da revisão" : "Exportar conversa em PDF"}</button>;
}
