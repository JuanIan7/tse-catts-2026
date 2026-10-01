"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { submitEvaluationAppeal } from "@/app/app/actions";
import { annotationMeta, type AnnotationType } from "@/lib/admin/evaluation-review";

type AppealTurn = { id: string; speaker: "ALUNO" | "PERSONAGEM"; content: string };

const tools: AnnotationType[] = ["PARAFRASE", "MEMORIA_LINKADA", "MAIEUTICA_TED", "SAIDA_DIGNA", "DOMINOU_DIALOGO", "CONDUZIU_SOLUCAO", "PERGUNTA_SIMPLES", "PERGUNTA_COMPLEXA", "FATOR_PROTECAO", "FATOR_RISCO", "FATOR_PRINCIPAL"];
const speakerLabel = { ALUNO: "Você", PERSONAGEM: "Tentante" } as const;

export function EvaluationAppealForm({ sessionId, turns }: { sessionId: string; turns: AppealTurn[] }) {
  const [selectedTurns, setSelectedTurns] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<AnnotationType[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const selectionDescription = useMemo(() => `${selectedTurns.length} fala(s) e ${selectedTools.length} ferramenta(s) selecionada(s).`, [selectedTools.length, selectedTurns.length]);
  const toggle = <T,>(value: T, current: T[], update: (next: T[]) => void) => update(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await submitEvaluationAppeal({ sessionId, transcriptIds: selectedTurns, tools: selectedTools });
      setMessage(result.message);
      if (result.ok) { setSelectedTurns([]); setSelectedTools([]); }
    });
  };

  return <section className="review-request-form appeal-form">
    <h3>Recurso de nota</h3>
    <p className="panel-subtitle">Selecione as falas e as ferramentas que deveriam ter sido consideradas. O administrador analisará item a item.</p>
    <form onSubmit={submit}>
      <div className="appeal-turn-list" aria-label="Falas disponíveis para recurso">
        {turns.map((turn) => {
          const selected = selectedTurns.includes(turn.id);
          return <button type="button" key={turn.id} className={selected ? "appeal-turn-selected" : "appeal-turn"} aria-pressed={selected} onClick={() => toggle(turn.id, selectedTurns, setSelectedTurns)}>
            <strong>{speakerLabel[turn.speaker]}</strong><span>{turn.content}</span>
          </button>;
        })}
      </div>
      <div className="appeal-tools" role="group" aria-label="Ferramentas alegadas">
        {tools.map((tool) => <label key={tool} style={{ borderColor: annotationMeta[tool].color }}><input type="checkbox" checked={selectedTools.includes(tool)} onChange={() => toggle(tool, selectedTools, setSelectedTools)}/>{annotationMeta[tool].label}</label>)}
      </div>
      <p className="panel-subtitle">{selectionDescription}</p>
      <button type="submit" disabled={pending || selectedTurns.length === 0 || selectedTools.length === 0}>{pending ? "Enviando recurso..." : "Enviar recurso para revisão"}</button>
      {message && <p className="review-status" role="status">{message}</p>}
    </form>
  </section>;
}
